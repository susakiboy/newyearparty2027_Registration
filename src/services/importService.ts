import * as XLSX from 'xlsx';
import {
  ImportPreviewRow,
  ImportResult,
  Team,
  SubTeam,
  Registration,
  AdminUser,
} from '../types';
import {
  getLocalCollection,
  setLocalCollection,
  getNextRegistrationCode,
  STORAGE_KEYS,
} from './storage';
import { eventService } from './eventService';
import { auditService } from './auditService';
import { normalizeName } from './registrationService';

export const importService = {
  async parseExcelFile(file: File, eventId: string): Promise<ImportPreviewRow[]> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert sheet to json array of objects
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS).filter(
      (t) => t.event_id === eventId && t.status === 'ACTIVE'
    );
    const subTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS).filter(
      (st) => st.status === 'ACTIVE'
    );
    const existingRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS).filter(
      (r) => r.event_id === eventId && r.registration_status !== 'CANCELLED'
    );

    const previewRows: ImportPreviewRow[] = [];
    const seenInFile = new Map<string, number>();

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // header is row 1
      // Match column names flexibly (Thai / English)
      const firstName = String(
        row['ชื่อ'] || row['First Name'] || row['first_name'] || row['firstname'] || ''
      ).trim();
      const lastName = String(
        row['นามสกุล'] || row['Last Name'] || row['last_name'] || row['lastname'] || ''
      ).trim();
      const teamName = String(
        row['ทีม'] || row['Team'] || row['team_name'] || row['team'] || ''
      ).trim();
      const subTeamName = String(
        row['ทีมย่อย'] || row['Sub Team'] || row['sub_team'] || row['subteam'] || ''
      ).trim();

      // Skip completely empty rows
      if (!firstName && !lastName && !teamName) return;

      const errors: string[] = [];
      let matchedTeam: Team | undefined;
      let matchedSubTeam: SubTeam | undefined;

      if (!firstName) errors.push('ไม่ได้ระบุชื่อ');
      if (!lastName) errors.push('ไม่ได้ระบุนามสกุล');
      if (!teamName) {
        errors.push('ไม่ได้ระบุทีม');
      } else {
        matchedTeam = teams.find(
          (t) =>
            t.name.toLowerCase() === teamName.toLowerCase() ||
            t.color.toLowerCase() === teamName.toLowerCase()
        );
        if (!matchedTeam) {
          errors.push(`ไม่พบทีม "${teamName}" ในระบบ`);
        }
      }

      if (subTeamName && matchedTeam) {
        matchedSubTeam = subTeams.find(
          (st) =>
            st.team_id === matchedTeam!.id &&
            st.name.toLowerCase() === subTeamName.toLowerCase()
        );
        if (!matchedSubTeam) {
          errors.push(`ไม่พบทีมย่อย "${subTeamName}" ในทีม ${matchedTeam.name}`);
        }
      }

      // Strict Duplicate Name & Surname Verification (ห้ามบันทึกซ้ำเด็ดขาด)
      let isDuplicate = false;
      const normFirst = normalizeName(firstName);
      const normLast = normalizeName(lastName);

      if (normFirst && normLast) {
        const fileKey = `${normFirst}___${normLast}`;
        // 1. Check duplicate within the uploaded file itself
        if (seenInFile.has(fileKey)) {
          isDuplicate = true;
          const firstSeenRow = seenInFile.get(fileKey);
          errors.push(`ชื่อ-นามสกุลซ้ำกับแถวที่ ${firstSeenRow} ในไฟล์เดียวกัน ห้ามบันทึกซ้ำเด็ดขาด`);
        } else {
          seenInFile.set(fileKey, rowNum);
        }

        // 2. Check duplicate against existing registrations in database (regardless of team)
        const dbDuplicate = existingRegs.find(
          (r) =>
            r.registration_status !== 'CANCELLED' &&
            normalizeName(r.first_name) === normFirst &&
            normalizeName(r.last_name) === normLast
        );
        if (dbDuplicate) {
          isDuplicate = true;
          errors.push(
            `ชื่อ-นามสกุลนี้ลงทะเบียนไว้แล้วในระบบ (รหัส: ${dbDuplicate.registration_code}, สังกัด: ${dbDuplicate.team_name_snapshot || 'ไม่ระบุ'}) ห้ามบันทึกซ้ำเด็ดขาด`
          );
        }
      }

      previewRows.push({
        rowNumber: rowNum,
        first_name: firstName,
        last_name: lastName,
        team_name: teamName,
        sub_team_name: subTeamName,
        team_id: matchedTeam?.id,
        sub_team_id: matchedSubTeam?.id,
        isValid: errors.length === 0 && !isDuplicate,
        isDuplicate,
        errors,
      });
    });

    return previewRows;
  },

  async confirmImport(
    previewRows: ImportPreviewRow[],
    eventId: string,
    currentUser: AdminUser
  ): Promise<ImportResult> {
    const event = await eventService.getActiveEvent();
    const validRows = previewRows.filter((r) => r.isValid && !r.isDuplicate);

    const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
    const subTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);

    const newRegs: Registration[] = [];

    for (const row of validRows) {
      // Defensive check to strictly prevent duplicates
      const normFirst = normalizeName(row.first_name);
      const normLast = normalizeName(row.last_name);

      const existsInDb = registrations.some(
        (r) =>
          r.event_id === eventId &&
          r.registration_status !== 'CANCELLED' &&
          normalizeName(r.first_name) === normFirst &&
          normalizeName(r.last_name) === normLast
      );
      const existsInBatch = newRegs.some(
        (r) =>
          normalizeName(r.first_name) === normFirst &&
          normalizeName(r.last_name) === normLast
      );

      if (existsInDb || existsInBatch) {
        continue;
      }

      const team = teams.find((t) => t.id === row.team_id);
      const subTeam = subTeams.find((st) => st.id === row.sub_team_id);
      const regCode = getNextRegistrationCode(event.year || '2026');
      const qrToken = 'TKN-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now();

      newRegs.push({
        id: crypto.randomUUID ? crypto.randomUUID() : 'reg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        registration_code: regCode,
        event_id: eventId,
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: `${row.first_name} ${row.last_name}`,
        team_id: row.team_id!,
        team_name_snapshot: team ? team.name : row.team_name,
        sub_team_id: row.sub_team_id || null,
        sub_team_name_snapshot: subTeam ? subTeam.name : null,
        qr_token: qrToken,
        registration_status: 'CONFIRMED',
        check_in_status: 'PENDING',
        checked_in_at: null,
        checked_in_by: null,
        registered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Prepend new records
    setLocalCollection(STORAGE_KEYS.REGISTRATIONS, [...newRegs, ...registrations]);

    // Audit log
    await auditService.log({
      userId: currentUser.id,
      userName: currentUser.display_name,
      action: 'BULK_IMPORT_REGISTRATIONS',
      entityType: 'REGISTRATION',
      entityId: 'BULK',
      newData: {
        totalRows: previewRows.length,
        importedCount: validRows.length,
        errorCount: previewRows.length - validRows.length,
      },
    });

    const duplicateCount = previewRows.filter((r) => r.isDuplicate).length;
    const errorCount = previewRows.filter((r) => !r.isValid && !r.isDuplicate).length;
    const errorsList = previewRows
      .filter((r) => !r.isValid || r.isDuplicate)
      .map((r) => ({
        row: r.rowNumber,
        reason: r.errors.join(', '),
      }));

    return {
      totalRows: previewRows.length,
      successCount: validRows.length,
      duplicateCount,
      errorCount,
      errors: errorsList,
    };
  },

  downloadTemplate(): void {
    const templateData = [
      {
        'ชื่อ (First Name)': 'สมชาย',
        'นามสกุล (Last Name)': 'ใจดี',
        'ทีม (Team)': 'Team Purple',
        'ทีมย่อย (Sub Team)': 'Purple A',
      },
      {
        'ชื่อ (First Name)': 'สมหญิง',
        'นามสกุล (Last Name)': 'รักเรียน',
        'ทีม (Team)': 'Team Pink',
        'ทีมย่อย (Sub Team)': 'Pink Alpha',
      },
      {
        'ชื่อ (First Name)': 'วิชัย',
        'นามสกุล (Last Name)': 'เก่งกาจ',
        'ทีม (Team)': 'Team Yellow',
        'ทีมย่อย (Sub Team)': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import_Template');
    XLSX.writeFile(wb, 'Sports_Day_Import_Template.xlsx');
  },

  downloadErrorReport(errors: { row: number; reason: string }[]): void {
    const ws = XLSX.utils.json_to_sheet(
      errors.map((e) => ({
        'แถวที่ (Row)': e.row,
        'สาเหตุข้อผิดพลาด (Reason)': e.reason,
      }))
    );
    ws['!cols'] = [{ wch: 15 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, 'Import_Errors_Report.xlsx');
  },
};
