import {
  Registration,
  CheckInRecord,
  CheckInMethod,
  AdminUser,
  Team,
} from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { auditService } from './auditService';
import { getLocalCollection, setLocalCollection, STORAGE_KEYS } from './storage';
import { luckyDrawService } from './luckyDrawService';

export interface CheckInResult {
  success: boolean;
  isDuplicate: boolean;
  message: string;
  firstCheckInTime?: string;
  checkedInBy?: string;
  registration?: Registration & { team_color_hex?: string };
}

/**
 * Safely parses and normalizes QR code contents or manual input into a valid
 * participant identifier (Registration Code, QR Token, or ID).
 */
export function parseScannedIdentifier(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // 1. JSON payload support: e.g. {"registration_code": "SD2026-000001"} or {"code": "SD2026-000001"}
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('%7B') && text.endsWith('%7D'))) {
    try {
      const unescaped = text.startsWith('%7B') ? decodeURIComponent(text) : text;
      const parsed = JSON.parse(unescaped);
      const val =
        parsed.registration_code ||
        parsed.code ||
        parsed.qr_token ||
        parsed.token ||
        parsed.id;
      if (val) return String(val).trim();
    } catch {
      // ignore JSON parse error
    }
  }

  // 2. URL payload support: e.g. https://domain.com/checkin?code=SD2026-000001
  if (text.includes('://') || text.includes('?') || text.startsWith('http')) {
    try {
      const url = new URL(text.startsWith('http') ? text : `https://${text}`);
      const codeParam =
        url.searchParams.get('code') ||
        url.searchParams.get('registration_code') ||
        url.searchParams.get('qr_token') ||
        url.searchParams.get('token') ||
        url.searchParams.get('id') ||
        url.searchParams.get('reg');
      if (codeParam) return codeParam.trim();

      const pathParts = url.pathname.split('/').filter(Boolean);
      for (const part of pathParts) {
        if (/^SD\d{4}-\d+$/i.test(part) || /^TKN-[A-Z0-9]+-\d+$/i.test(part)) {
          return part.trim();
        }
      }
    } catch {
      // not a valid URL
    }
  }

  // 3. Regex match for SD2026-xxxxxx anywhere in text
  const sdMatch = text.match(/SD\d{4}-\d+/i);
  if (sdMatch) {
    return sdMatch[0].toUpperCase();
  }

  // 4. Regex match for Token TKN-xxxx-xxxx
  const tknMatch = text.match(/TKN-[A-Za-z0-9]+-\d+/i);
  if (tknMatch) {
    return tknMatch[0].toUpperCase();
  }

  // 5. UUID match
  const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) {
    return uuidMatch[0].toLowerCase();
  }

  // 6. Return trimmed plain text
  return text;
}

export const checkInService = {
  async processCheckIn(
    identifier: string,
    currentUser?: AdminUser | null,
    method: CheckInMethod = 'QR_SCAN',
    deviceInfo: string = navigator.userAgent
  ): Promise<CheckInResult> {
    const clean = parseScannedIdentifier(identifier);
    if (!clean) {
      throw new Error('กรุณาระบุรหัสลงทะเบียนหรือ QR Code');
    }

    const adminDisplayName =
      currentUser?.display_name || currentUser?.email || 'เจ้าหน้าที่ (Admin)';
    const adminId = currentUser?.id || 'admin-system';

    // 1. Supabase Persistent Central Database Processing
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);

        let reg: any = null;

        // 1.1 If UUID format, search by ID first
        if (isUuid) {
          const { data, error } = await client
            .from('registrations')
            .select('*, teams(color_hex, name)')
            .eq('id', clean)
            .maybeSingle();
          if (!error && data) {
            reg = data;
          }
        }

        // 1.2 Search by registration_code or qr_token (case-insensitive safe match)
        if (!reg) {
          const { data, error } = await client
            .from('registrations')
            .select('*, teams(color_hex, name)')
            .or(`registration_code.ilike.${clean},qr_token.ilike.${clean},qr_token.ilike.%#LUCKY:${clean}%`)
            .maybeSingle();
          if (!error && data) {
            reg = data;
          }
        }

        // 1.3 Flexible padding search for digits (e.g. user entered "1" or "SD2026-0001" vs "SD2026-000001")
        if (!reg) {
          const digits = clean.match(/\d+$/);
          if (digits) {
            const num = parseInt(digits[0], 10);
            if (!isNaN(num)) {
              const pad6 = `SD2026-${String(num).padStart(6, '0')}`;
              const pad4 = `SD2026-${String(num).padStart(4, '0')}`;
              const padYear27_6 = `SD2027-${String(num).padStart(6, '0')}`;
              const { data } = await client
                .from('registrations')
                .select('*, teams(color_hex, name)')
                .or(`registration_code.ilike.${pad6},registration_code.ilike.${pad4},registration_code.ilike.${padYear27_6}`)
                .maybeSingle();
              if (data) {
                reg = data;
              }
            }
          }
        }

        if (reg) {
          if (reg.registration_status !== 'CONFIRMED') {
            throw new Error('รายการลงทะเบียนนี้ถูกยกเลิกแล้ว ไม่สามารถ Check-in ได้');
          }

          const enrichedReg = luckyDrawService.enrichRegistration({
            ...reg,
            team_color_hex: (reg as any).teams?.color_hex || '#64748b',
          });

          // Duplicate Check
          if (reg.check_in_status === 'CHECKED_IN') {
            return {
              success: false,
              isDuplicate: true,
              message: 'ผู้เข้าร่วมรายนี้ Check-in แล้ว',
              firstCheckInTime: reg.checked_in_at || undefined,
              checkedInBy: reg.checked_in_by || undefined,
              registration: enrichedReg,
            };
          }

          const now = new Date().toISOString();

          // Update registration in Supabase
          const { error: updateErr } = await client
            .from('registrations')
            .update({
              check_in_status: 'CHECKED_IN',
              checked_in_at: now,
              checked_in_by: adminDisplayName,
              updated_at: now,
            })
            .eq('id', reg.id);

          if (updateErr) {
            throw new Error(`ไม่สามารถบันทึก Check-in ในฐานข้อมูลได้: ${updateErr.message}`);
          }

          // Insert into permanent check_ins table
          try {
            await client.from('check_ins').insert({
              registration_id: reg.id,
              event_id: reg.event_id,
              checked_in_at: now,
              checked_in_by: adminDisplayName,
              method,
              device_info: deviceInfo,
            });
          } catch (insertErr) {
            console.warn('Could not insert into check_ins table:', insertErr);
          }

          // Keep local storage synchronized
          try {
            const localRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
            const idx = localRegs.findIndex(
              (r) => r.id === reg.id || r.registration_code === reg.registration_code
            );
            if (idx >= 0) {
              localRegs[idx].check_in_status = 'CHECKED_IN';
              localRegs[idx].checked_in_at = now;
              localRegs[idx].checked_in_by = adminDisplayName;
              setLocalCollection(STORAGE_KEYS.REGISTRATIONS, localRegs);
            }
          } catch (syncErr) {
            console.warn('Local cache sync error:', syncErr);
          }

          // Audit Log
          try {
            await auditService.log({
              userId: adminId,
              userName: adminDisplayName,
              action: 'CHECK_IN_PARTICIPANT',
              entityType: 'REGISTRATION',
              entityId: reg.id,
              newData: { method, time: now, code: reg.registration_code },
            });
          } catch {
            // Ignore audit error
          }

          return {
            success: true,
            isDuplicate: false,
            message: 'Check-in สำเร็จ',
            firstCheckInTime: now,
            checkedInBy: adminDisplayName,
            registration: {
              ...enrichedReg,
              check_in_status: 'CHECKED_IN',
              checked_in_at: now,
            },
          };
        }
      }
    }

    // Fallback if local offline development or if not found in Supabase
    const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);

    const regIndex = registrations.findIndex(
      (r) =>
        r.registration_code.toLowerCase() === clean.toLowerCase() ||
        r.qr_token === clean ||
        r.id === clean ||
        (luckyDrawService.extractLuckyNumber(r.qr_token) || r.lucky_number || '').toLowerCase() === clean.toLowerCase()
    );

    if (regIndex === -1) {
      throw new Error(`ไม่พบรหัสลงทะเบียนหรือหมายเลขรางวัล "${clean}" ในระบบ หรือข้อมูลไม่ถูกต้อง`);
    }

    const reg = registrations[regIndex];
    if (reg.registration_status !== 'CONFIRMED') {
      throw new Error('รายการลงทะเบียนนี้ถูกยกเลิกแล้ว ไม่สามารถ Check-in ได้');
    }

    const team = teams.find((t) => t.id === reg.team_id);
    const enrichedReg = luckyDrawService.enrichRegistration({
      ...reg,
      team_color_hex: team ? team.color_hex : '#64748b',
    });

    if (reg.check_in_status === 'CHECKED_IN') {
      return {
        success: false,
        isDuplicate: true,
        message: 'ผู้เข้าร่วมรายนี้ Check-in แล้ว',
        firstCheckInTime: reg.checked_in_at || undefined,
        checkedInBy: reg.checked_in_by || undefined,
        registration: enrichedReg,
      };
    }

    const now = new Date().toISOString();
    reg.check_in_status = 'CHECKED_IN';
    reg.checked_in_at = now;
    reg.checked_in_by = adminDisplayName;
    reg.updated_at = now;

    setLocalCollection(STORAGE_KEYS.REGISTRATIONS, registrations);

    const checkIns = getLocalCollection<CheckInRecord>(STORAGE_KEYS.CHECK_INS);
    checkIns.unshift({
      id: 'chk-' + Date.now(),
      registration_id: reg.id,
      event_id: reg.event_id,
      checked_in_at: now,
      checked_in_by: adminDisplayName,
      method,
      device_info: deviceInfo,
      created_at: now,
    });
    setLocalCollection(STORAGE_KEYS.CHECK_INS, checkIns);

    return {
      success: true,
      isDuplicate: false,
      message: 'Check-in สำเร็จ',
      firstCheckInTime: now,
      checkedInBy: adminDisplayName,
      registration: {
        ...enrichedReg,
        check_in_status: 'CHECKED_IN',
        checked_in_at: now,
      },
    };
  },

  // Realtime subscription for live check-in updates
  subscribeToCheckIns(onUpdate: (payload: any) => void): () => void {
    if (!isSupabaseConfigured()) return () => {};
    const client = getSupabase();
    if (!client) return () => {};

    const channelName = `realtime-checkins-${Math.random().toString(36).substring(2, 7)}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'check_ins' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  },

  // Check-in Statistics
  async getCheckInStats(eventId?: string): Promise<{
    total: number;
    checkedIn: number;
    notCheckedIn: number;
    percentage: number;
    teamBreakdown: {
      team_id: string;
      team_name: string;
      color_hex: string;
      total: number;
      checked_in: number;
      percentage: number;
    }[];
  }> {
    let registrations: Registration[] = [];
    let teams: Team[] = [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          let regQuery = client.from('registrations').select('*').eq('registration_status', 'CONFIRMED');
          let teamQuery = client.from('teams').select('*').eq('status', 'ACTIVE');
          if (eventId) {
            regQuery = regQuery.eq('event_id', eventId);
            teamQuery = teamQuery.eq('event_id', eventId);
          }
          const [regsRes, teamsRes] = await Promise.all([regQuery, teamQuery]);
          if (regsRes.data) registrations = regsRes.data as Registration[];
          if (teamsRes.data) teams = teamsRes.data as Team[];
        } catch (err) {
          console.error('Failed to load check-in stats from Supabase:', err);
        }
      }
    }

    if (registrations.length === 0 && !isSupabaseConfigured()) {
      const allRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
      const allTeams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
      registrations = allRegs.filter(
        (r) => (!eventId || r.event_id === eventId) && r.registration_status === 'CONFIRMED'
      );
      teams = allTeams.filter((t) => (!eventId || t.event_id === eventId) && t.status === 'ACTIVE');
    }

    const total = registrations.length;
    const checkedIn = registrations.filter((r) => r.check_in_status === 'CHECKED_IN').length;
    const notCheckedIn = total - checkedIn;
    const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    const teamBreakdown = teams
      .map((t) => {
        const teamRegs = registrations.filter((r) => r.team_id === t.id);
        const teamChecked = teamRegs.filter((r) => r.check_in_status === 'CHECKED_IN').length;
        return {
          team_id: t.id,
          team_name: t.name,
          color_hex: t.color_hex,
          total: teamRegs.length,
          checked_in: teamChecked,
          percentage: teamRegs.length > 0 ? Math.round((teamChecked / teamRegs.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      total,
      checkedIn,
      notCheckedIn,
      percentage,
      teamBreakdown,
    };
  },
};
