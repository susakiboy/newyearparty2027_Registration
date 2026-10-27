import * as XLSX from 'xlsx';
import { Registration, Team, CheckInRecord } from '../types';
import { getLocalCollection, STORAGE_KEYS } from './storage';

export const exportService = {
  formatDate(isoString: string | null): { date: string; time: string } {
    if (!isoString) return { date: '-', time: '-' };
    const d = new Date(isoString);
    const date = d.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { date, time };
  },

  exportRegistrationsToExcel(
    registrations: Registration[],
    fileNameSuffix: string = 'All',
    format: 'xlsx' | 'csv' = 'xlsx'
  ): void {
    const dataRows = registrations.map((r, index) => {
      const regTime = this.formatDate(r.registered_at);
      const checkInTime = this.formatDate(r.checked_in_at);

      return {
        'ลำดับ (No.)': index + 1,
        'Registration ID': r.registration_code,
        'หมายเลขของรางวัล (Lucky No.)': r.lucky_number || '-',
        'ชื่อ (First Name)': r.first_name,
        'นามสกุล (Last Name)': r.last_name,
        'ชื่อ-นามสกุล (Full Name)': r.full_name,
        'ทีม (Team)': r.team_name_snapshot,
        'ทีมย่อย (Sub Team)': r.sub_team_name_snapshot || '-',
        'สถานะการลงทะเบียน (Status)': r.registration_status === 'CONFIRMED' ? 'ยืนยันแล้ว' : 'ยกเลิก',
        'สถานะ Check-in': r.check_in_status === 'CHECKED_IN' ? 'Check-in แล้ว' : 'ยังไม่ Check-in',
        'วันที่ลงทะเบียน (Date)': regTime.date,
        'เวลาลงทะเบียน (Time)': regTime.time,
        'วันที่ Check-in': checkInTime.date,
        'เวลา Check-in': checkInTime.time,
        'ผู้ทำรายการ Check-in': r.checked_in_by || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);

    // Auto-size columns for high polish
    const colWidths = [
      { wch: 8 },  // No
      { wch: 18 }, // ID
      { wch: 16 }, // First Name
      { wch: 16 }, // Last Name
      { wch: 25 }, // Full Name
      { wch: 18 }, // Team
      { wch: 18 }, // Sub Team
      { wch: 16 }, // Status
      { wch: 18 }, // Check-in Status
      { wch: 15 }, // Reg Date
      { wch: 12 }, // Reg Time
      { wch: 15 }, // Check Date
      { wch: 12 }, // Check Time
      { wch: 20 }, // Staff
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');

    const sanitizedSuffix = fileNameSuffix.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');
    const fileName = `Sports_Day_2026_${sanitizedSuffix}.${format}`;

    if (format === 'csv') {
      XLSX.writeFile(workbook, fileName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' });
    }
  },

  exportExecutiveReport(eventId: string): void {
    const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS).filter(
      (r) => r.event_id === eventId && r.registration_status === 'CONFIRMED'
    );
    const teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS).filter(
      (t) => t.event_id === eventId && t.status === 'ACTIVE'
    );
    const checkIns = getLocalCollection<CheckInRecord>(STORAGE_KEYS.CHECK_INS).filter(
      (c) => c.event_id === eventId
    );

    const total = registrations.length;
    const checkedIn = registrations.filter((r) => r.check_in_status === 'CHECKED_IN').length;
    const notCheckedIn = total - checkedIn;
    const rate = total > 0 ? ((checkedIn / total) * 100).toFixed(1) + '%' : '0%';

    // Sheet 1: Executive Summary
    const summaryRows = [
      { 'หัวข้อสรุปภาพรวม (Metric)': 'กิจกรรม (Event)', 'ข้อมูล (Value)': 'SPORTS DAY 2026' },
      { 'หัวข้อสรุปภาพรวม (Metric)': 'จำนวนผู้ลงทะเบียนทั้งหมด', 'ข้อมูล (Value)': total },
      { 'หัวข้อสรุปภาพรวม (Metric)': 'จำนวนผู้ที่ Check-in แล้ว', 'ข้อมูล (Value)': checkedIn },
      { 'หัวข้อสรุปภาพรวม (Metric)': 'จำนวนผู้ที่ยังไม่ Check-in', 'ข้อมูล (Value)': notCheckedIn },
      { 'หัวข้อสรุปภาพรวม (Metric)': 'อัตราการเข้าร่วม (Check-in Rate)', 'ข้อมูล (Value)': rate },
      { 'หัวข้อสรุปภาพรวม (Metric)': 'จำนวนทีมทั้งหมด', 'ข้อมูล (Value)': teams.length },
      {
        'หัวข้อสรุปภาพรวม (Metric)': 'ส่งออกรายงานเมื่อ',
        'ข้อมูล (Value)': new Date().toLocaleString('th-TH'),
      },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 35 }, { wch: 30 }];

    // Sheet 2: Team Breakdown
    const teamRows = teams.map((team) => {
      const teamRegs = registrations.filter((r) => r.team_id === team.id);
      const teamChecked = teamRegs.filter((r) => r.check_in_status === 'CHECKED_IN').length;
      return {
        'ชื่อทีม (Team Name)': team.name,
        'สี (Color)': team.color,
        'จำนวนผู้ลงทะเบียน (Total)': teamRegs.length,
        'Check-in แล้ว (Checked)': teamChecked,
        'ยังไม่ Check-in': teamRegs.length - teamChecked,
        'อัตรา Check-in (%)':
          teamRegs.length > 0 ? ((teamChecked / teamRegs.length) * 100).toFixed(1) + '%' : '0%',
      };
    });
    const wsTeams = XLSX.utils.json_to_sheet(teamRows);
    wsTeams['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];

    // Sheet 3: Registrations List
    const regRows = registrations.map((r, i) => {
      const regTime = this.formatDate(r.registered_at);
      const checkInTime = this.formatDate(r.checked_in_at);
      return {
        'No.': i + 1,
        'Registration ID': r.registration_code,
        'ชื่อ-นามสกุล': r.full_name,
        ทีม: r.team_name_snapshot,
        ทีมย่อย: r.sub_team_name_snapshot || '-',
        'สถานะ Check-in': r.check_in_status === 'CHECKED_IN' ? 'Check-in แล้ว' : 'ยังไม่ Check-in',
        วันที่ลงทะเบียน: regTime.date,
        เวลา: regTime.time,
        'เวลา Check-in': checkInTime.time,
      };
    });
    const wsRegs = XLSX.utils.json_to_sheet(regRows);
    wsRegs['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 25 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
    ];

    // Sheet 4: Check-in Logs
    const checkInRows = checkIns.map((c, i) => {
      const reg = registrations.find((r) => r.id === c.registration_id);
      const time = this.formatDate(c.checked_in_at);
      return {
        'No.': i + 1,
        'Registration ID': reg ? reg.registration_code : '-',
        'ชื่อผู้เข้าร่วม': reg ? reg.full_name : '-',
        ทีม: reg ? reg.team_name_snapshot : '-',
        'วิธีการ Check-in': c.method,
        'ผู้บันทึก (Staff)': c.checked_in_by,
        วันที่: time.date,
        เวลา: time.time,
      };
    });
    const wsCheckIns = XLSX.utils.json_to_sheet(checkInRows);
    wsCheckIns['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 25 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsTeams, 'Team_Breakdown');
    XLSX.utils.book_append_sheet(wb, wsRegs, 'Registrations');
    XLSX.utils.book_append_sheet(wb, wsCheckIns, 'CheckIn_Logs');

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Sports_Day_2026_Executive_Report_${todayStr}.xlsx`);
  },

  exportSummaryReport(eventId: string): void {
    return this.exportExecutiveReport(eventId);
  },

  exportSummaryToExcel(summaryRows: any[], teams: Team[]): void {
    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    if (teams && teams.length > 0) {
      const teamRows = teams.map((t) => ({
        'รหัสทีม': t.id,
        'ชื่อทีม': t.name,
        'สีประจำทีม': t.color,
        'สถานะ': t.status,
      }));
      const wsTeams = XLSX.utils.json_to_sheet(teamRows);
      XLSX.utils.book_append_sheet(wb, wsTeams, 'Teams');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Sports_Day_2026_Summary_${todayStr}.xlsx`);
  },
};
