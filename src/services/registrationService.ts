import {
  Registration,
  RegistrationFilter,
  Pagination,
  AdminUser,
  Team,
  SubTeam,
} from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { eventService } from './eventService';
import { auditService } from './auditService';
import { getLocalCollection, setLocalCollection, STORAGE_KEYS } from './storage';
import { luckyDrawService } from './luckyDrawService';

export interface RegisterDTO {
  eventId: string;
  firstName: string;
  lastName: string;
  teamId: string;
  subTeamId?: string | null;
}

export function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const registrationService = {
  async checkDuplicate(
    firstName: string,
    lastName: string,
    eventId?: string,
    excludeId?: string
  ): Promise<Registration | null> {
    const normFirst = firstName?.trim();
    const normLast = lastName?.trim();
    if (!normFirst || !normLast) return null;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        let query = client
          .from('registrations')
          .select('*')
          .ilike('first_name', normFirst)
          .ilike('last_name', normLast)
          .eq('registration_status', 'CONFIRMED');

        if (eventId) {
          query = query.eq('event_id', eventId);
        }
        if (excludeId) {
          query = query.neq('id', excludeId);
        }

        const { data, error } = await query.limit(1);
        if (!error && data && data.length > 0) {
          return data[0] as Registration;
        }
        return null;
      }
    }

    // Fallback inspection if offline
    const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    return (
      registrations.find((r) => {
        if (r.registration_status === 'CANCELLED') return false;
        if (excludeId && r.id === excludeId) return false;
        if (eventId && r.event_id !== eventId) return false;
        return (
          normalizeName(r.first_name) === normalizeName(normFirst) &&
          normalizeName(r.last_name) === normalizeName(normLast)
        );
      }) || null
    );
  },

  async register(data: RegisterDTO): Promise<Registration> {
    const trimmedFirst = data.firstName?.trim();
    const trimmedLast = data.lastName?.trim();

    if (!trimmedFirst) throw new Error('กรุณากรอกชื่อ');
    if (!trimmedLast) throw new Error('กรุณากรอกนามสกุล');
    if (!data.teamId) throw new Error('กรุณาเลือกทีม');

    // 1. Mandatory Supabase Database Check (Production Requirement)
    if (!isSupabaseConfigured()) {
      throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }

    const client = getSupabase();
    if (!client) {
      throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }

    // 2. Validate Event in Supabase
    const event = await eventService.getActiveEvent();
    if (!event || event.id !== data.eventId) {
      throw new Error('ไม่พบข้อมูลกิจกรรม หรือกิจกรรมถูกปิดใช้งาน');
    }

    const { isOpen, reason } = eventService.isRegistrationCurrentlyOpen(event);
    if (!isOpen) {
      throw new Error(reason || 'ขณะนี้ระบบปิดรับลงทะเบียน');
    }

    // 3. Concurrency-safe registration with duplicate checking and unique code generation
    try {
      const existing = await this.checkDuplicate(trimmedFirst, trimmedLast, data.eventId);
      if (existing) {
        throw new Error(
          `ตรวจพบรายชื่อ "${trimmedFirst} ${trimmedLast}" ได้ลงทะเบียนไว้แล้วในระบบ (รหัส: ${existing.registration_code}) ห้ามลงทะเบียนซ้ำ`
        );
      }

      // Fetch team snapshot
      const { data: teamData } = await client.from('teams').select('*').eq('id', data.teamId).maybeSingle();
      let subTeamName: string | null = null;
      if (data.subTeamId) {
        const { data: stData } = await client.from('sub_teams').select('*').eq('id', data.subTeamId).maybeSingle();
        if (stData) subTeamName = stData.name;
      }

      // Concurrency-safe unique sequence code generation
      const { count } = await client.from('registrations').select('*', { count: 'exact', head: true });
      let seq = (count || 0) + 1;
      let regCode = `SD${event.year || '2027'}-${seq.toString().padStart(6, '0')}`;

      // Prevent registration_code collision
      let attempt = 0;
      while (attempt < 5) {
        const { data: codeCheck } = await client
          .from('registrations')
          .select('id')
          .eq('registration_code', regCode)
          .limit(1);
        if (!codeCheck || codeCheck.length === 0) break;
        seq++;
        regCode = `SD${event.year || '2027'}-${seq.toString().padStart(6, '0')}`;
        attempt++;
      }

      let qrToken = `TKN-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now()}`;

      // Auto-assign Lucky Draw Number if enabled
      try {
        const luckyConfig = await luckyDrawService.getConfig(event);
        if (luckyConfig.enabled && luckyConfig.auto_assign_on_register) {
          const nextLucky = await luckyDrawService.generateNextAvailableNumber(data.eventId, luckyConfig);
          if (nextLucky) {
            qrToken = luckyDrawService.embedLuckyNumber(qrToken, nextLucky);
          }
        }
      } catch (luckyErr) {
        console.warn('Auto lucky number assignment error:', luckyErr);
      }

      const insertPayload = {
        registration_code: regCode,
        event_id: data.eventId,
        first_name: trimmedFirst,
        last_name: trimmedLast,
        full_name: `${trimmedFirst} ${trimmedLast}`,
        team_id: data.teamId,
        team_name_snapshot: teamData ? teamData.name : 'Unknown',
        sub_team_id: data.subTeamId || null,
        sub_team_name_snapshot: subTeamName,
        qr_token: qrToken,
        registration_status: 'CONFIRMED',
        check_in_status: 'PENDING',
        registered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await client
        .from('registrations')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (insertError || !inserted) {
        if (insertError?.code === '23505') {
          throw new Error(`ตรวจพบรายชื่อ "${trimmedFirst} ${trimmedLast}" ได้ลงทะเบียนไว้แล้วในระบบ ห้ามลงทะเบียนซ้ำ`);
        }
        throw new Error(`ไม่สามารถเชื่อมต่อฐานข้อมูลได้: ${insertError?.message || 'กรุณาลองใหม่อีกครั้ง'}`);
      }

      const enriched = luckyDrawService.enrichRegistration(inserted);

      // Keep local storage synchronized
      try {
        const localRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
        localRegs.unshift(enriched);
        setLocalCollection(STORAGE_KEYS.REGISTRATIONS, localRegs);
      } catch (cacheErr) {
        console.warn('Cache update error:', cacheErr);
      }

      return enriched;
    } catch (err: any) {
      if (
        err.message.includes('ห้ามลงทะเบียนซ้ำ') ||
        err.message.includes('ตรวจพบรายชื่อ') ||
        err.message.includes('กรุณา') ||
        err.message.includes('ปิดรับ')
      ) {
        throw err;
      }
      console.error('Database registration error:', err);
      throw new Error(err.message || 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }

    throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
  },

  async getRegistrations(
    filter: RegistrationFilter,
    page: number = 1,
    limit: number = 25
  ): Promise<{ data: Registration[]; pagination: Pagination }> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        let query = client
          .from('registrations')
          .select('*', { count: 'exact' });

        // Search by Code, First Name, Last Name, Full Name, Lucky Draw Number
        if (filter.search && filter.search.trim()) {
          const q = filter.search.trim();
          query = query.or(
            `registration_code.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,full_name.ilike.%${q}%,team_name_snapshot.ilike.%${q}%,qr_token.ilike.%${q}%`
          );
        }

        // Filter by Team
        if (filter.team_id && filter.team_id !== 'ALL') {
          query = query.eq('team_id', filter.team_id);
        }

        // Filter by Sub Team
        if (filter.sub_team_id && filter.sub_team_id !== 'ALL') {
          query = query.eq('sub_team_id', filter.sub_team_id);
        }

        // Filter by Check-in Status
        if (filter.check_in_status && filter.check_in_status !== 'ALL') {
          query = query.eq('check_in_status', filter.check_in_status);
        }

        // Filter by Registration Status
        if (filter.registration_status && filter.registration_status !== 'ALL') {
          query = query.eq('registration_status', filter.registration_status);
        }

        // Date range
        if (filter.date_from) {
          query = query.gte('registered_at', new Date(filter.date_from).toISOString());
        }
        if (filter.date_to) {
          const toDate = new Date(filter.date_to);
          toDate.setHours(23, 59, 59, 999);
          query = query.lte('registered_at', toDate.toISOString());
        }

        const offset = (page - 1) * limit;
        query = query.order('registered_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, count, error } = await query;
        if (!error && data) {
          const total = count || 0;
          const remoteRecords = (data as any[]).map((r) => luckyDrawService.enrichRegistration(r));

          // Cache remote records into local storage so local lookups and offline fallbacks are always synchronized
          try {
            const existingLocal = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
            const localMap = new Map<string, Registration>();
            existingLocal.forEach((r) => {
              if (r.id) localMap.set(r.id, r);
              if (r.registration_code) localMap.set(r.registration_code, r);
            });
            remoteRecords.forEach((r) => {
              if (r.id) localMap.set(r.id, r);
              if (r.registration_code) localMap.set(r.registration_code, r);
            });
            // Store unique records by ID
            const uniqueMerged = Array.from(
              new Map(Array.from(localMap.values()).map((item) => [item.id || item.registration_code, item])).values()
            );
            setLocalCollection(STORAGE_KEYS.REGISTRATIONS, uniqueMerged);
          } catch (cacheErr) {
            console.warn('Failed to cache registrations into localStorage:', cacheErr);
          }

          return {
            data: remoteRecords,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit) || 1,
            },
          };
        }
      }
    }

    // Fallback if offline
    const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS).map((r) =>
      luckyDrawService.enrichRegistration(r)
    );
    let filtered = registrations;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.registration_code.toLowerCase().includes(q) ||
          r.first_name.toLowerCase().includes(q) ||
          r.last_name.toLowerCase().includes(q) ||
          r.full_name.toLowerCase().includes(q) ||
          r.team_name_snapshot.toLowerCase().includes(q) ||
          (r.lucky_number && r.lucky_number.toLowerCase().includes(q))
      );
    }

    if (filter.team_id && filter.team_id !== 'ALL') {
      filtered = filtered.filter((r) => r.team_id === filter.team_id);
    }
    if (filter.sub_team_id && filter.sub_team_id !== 'ALL') {
      filtered = filtered.filter((r) => r.sub_team_id === filter.sub_team_id);
    }
    if (filter.check_in_status && filter.check_in_status !== 'ALL') {
      filtered = filtered.filter((r) => r.check_in_status === filter.check_in_status);
    }
    if (filter.registration_status && filter.registration_status !== 'ALL') {
      filtered = filtered.filter((r) => r.registration_status === filter.registration_status);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    return {
      data: filtered.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async getAllForExport(filter: RegistrationFilter): Promise<Registration[]> {
    const { data } = await this.getRegistrations(filter, 1, 100000);
    return data;
  },

  async getRegistrationById(idOrCode: string): Promise<Registration | null> {
    if (!idOrCode) return null;
    const clean = idOrCode.trim();

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
        const orFilter = isUuid
          ? `id.eq.${clean},registration_code.ilike.${clean},qr_token.ilike.${clean}`
          : `registration_code.ilike.${clean},qr_token.ilike.${clean}`;

        const { data, error } = await client
          .from('registrations')
          .select('*')
          .or(orFilter)
          .maybeSingle();

        if (!error && data) {
          return luckyDrawService.enrichRegistration(data);
        }
      }
    }

    const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const found = registrations.find(
      (r) =>
        r.id === clean ||
        r.registration_code.toLowerCase() === clean.toLowerCase() ||
        r.qr_token === clean ||
        (luckyDrawService.extractLuckyNumber(r.qr_token) || r.lucky_number || '').toLowerCase() === clean.toLowerCase()
    );
    return found ? luckyDrawService.enrichRegistration(found) : null;
  },

  async updateRegistration(
    id: string,
    updates: Partial<Registration>,
    currentUser?: AdminUser
  ): Promise<Registration> {
    const cleanId = (id || '').trim();
    const cleanCode = (updates.registration_code || (cleanId.startsWith('SD') ? cleanId : '')).trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);

    const updatePayload: Record<string, any> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    // Ensure we do not inadvertently attempt to overwrite primary key
    delete updatePayload.id;

    if (updates.first_name || updates.last_name) {
      const first = updates.first_name !== undefined ? updates.first_name.trim() : '';
      const last = updates.last_name !== undefined ? updates.last_name.trim() : '';
      if (first && last) {
        updatePayload.first_name = first;
        updatePayload.last_name = last;
        updatePayload.full_name = `${first} ${last}`;
      } else if (first) {
        updatePayload.first_name = first;
      } else if (last) {
        updatePayload.last_name = last;
      }
    }

    // Resolve team name snapshot if team_id changed
    if (updates.team_id && !updates.team_name_snapshot) {
      const teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
      const matchedTeam = teams.find((t) => t.id === updates.team_id);
      if (matchedTeam) {
        updatePayload.team_name_snapshot = matchedTeam.name;
      }
    }

    // Resolve sub_team name snapshot if sub_team_id changed
    if (updates.sub_team_id !== undefined) {
      if (updates.sub_team_id) {
        const subTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
        const matchedSub = subTeams.find((st) => st.id === updates.sub_team_id);
        updatePayload.sub_team_name_snapshot = matchedSub ? matchedSub.name : null;
      } else {
        updatePayload.sub_team_id = null;
        updatePayload.sub_team_name_snapshot = null;
      }
    }

    // Handle check_in_status change
    if (updates.check_in_status === 'CHECKED_IN') {
      if (!updates.checked_in_at) {
        updatePayload.checked_in_at = new Date().toISOString();
      }
      if (!updates.checked_in_by) {
        updatePayload.checked_in_by = currentUser?.display_name || 'Admin';
      }
    } else if (updates.check_in_status === 'PENDING') {
      updatePayload.checked_in_at = null;
      updatePayload.checked_in_by = null;
    }

    let updatedResult: Registration | null = null;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          // 1. Try atomic admin_update_registration RPC first if available
          let rpcSuccess = false;
          try {
            const { data: rpcData, error: rpcErr } = await client.rpc('admin_update_registration', {
              p_identifier: cleanId || cleanCode,
              p_first_name: updatePayload.first_name || null,
              p_last_name: updatePayload.last_name || null,
              p_team_id: updatePayload.team_id || null,
              p_sub_team_id: updatePayload.sub_team_id || null,
              p_team_name_snapshot: updatePayload.team_name_snapshot || null,
              p_sub_team_name_snapshot: updatePayload.sub_team_name_snapshot || null,
              p_registration_status: updatePayload.registration_status || null,
              p_check_in_status: updatePayload.check_in_status || null,
              p_updated_by: currentUser?.display_name || 'Admin',
            });
            if (!rpcErr && rpcData) {
              updatedResult = rpcData as Registration;
              rpcSuccess = true;
            }
          } catch {
            // RPC function not installed, proceed with direct table operations
          }

          // 2. Direct Supabase Table Operations if RPC was not used
          if (!rpcSuccess) {
            let targetRow: any = null;

            if (isUUID) {
              const { data: row } = await client
                .from('registrations')
                .select('*')
                .eq('id', cleanId)
                .maybeSingle();
              targetRow = row;
            }

            if (!targetRow && cleanCode) {
              const { data: row } = await client
                .from('registrations')
                .select('*')
                .eq('registration_code', cleanCode)
                .maybeSingle();
              targetRow = row;
            }

            if (!targetRow && !isUUID && cleanId) {
              const { data: row } = await client
                .from('registrations')
                .select('*')
                .eq('registration_code', cleanId)
                .maybeSingle();
              targetRow = row;
            }

            if (targetRow) {
              const { data: updateData, error: updateError } = await client
                .from('registrations')
                .update(updatePayload)
                .eq('id', targetRow.id)
                .select();

              if (updateError) {
                if (updateError.code === '42501') {
                  throw new Error(
                    'สิทธิ์การเข้าถึงฐานข้อมูล Supabase ถูกจำกัด (RLS 42501): กรุณาเพิ่มนโยบาย UPDATE สำหรับ role anon ในตาราง registrations'
                  );
                }
                throw new Error(`ขัดข้องที่ขั้นตอนอัปเดต Supabase: ${updateError.message} (Code: ${updateError.code || 'UNKNOWN'})`);
              }

              if (updateData && updateData.length > 0) {
                updatedResult = updateData[0] as Registration;
              } else {
                // Row exists in Supabase, but Postgres RLS silently filtered out 0 rows updated
                console.warn(
                  'Supabase RLS notice: Update returned 0 rows despite record existing in database. RLS UPDATE policy may be missing on registrations table.'
                );
              }
            }
          }
        } catch (err: any) {
          console.error('Supabase updateRegistration error:', err);
          if (err.message?.includes('ขัดข้อง') || err.message?.includes('สิทธิ์การเข้าถึง')) {
            throw err;
          }
        }
      }
    }

    // Synchronize local storage collection
    const localRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const regIndex = localRegs.findIndex(
      (r) =>
        r.id === cleanId ||
        (cleanCode && r.registration_code === cleanCode) ||
        (cleanId && r.registration_code === cleanId)
    );

    if (regIndex !== -1) {
      const merged: Registration = {
        ...localRegs[regIndex],
        ...updatePayload,
        ...(updatedResult || {}),
        updated_at: new Date().toISOString(),
      };
      localRegs[regIndex] = merged;
      setLocalCollection(STORAGE_KEYS.REGISTRATIONS, localRegs);
      if (!updatedResult) {
        updatedResult = merged;
      }
    } else if (updatedResult) {
      localRegs.unshift(updatedResult);
      setLocalCollection(STORAGE_KEYS.REGISTRATIONS, localRegs);
    }

    if (!updatedResult) {
      throw new Error(
        `ขัดข้องที่ขั้นตอนบันทึก: ไม่พบข้อมูลผู้ลงทะเบียนรหัส "${cleanCode || cleanId}" ในระบบ (กรุณารีเฟรชหน้าจอเพื่อโหลดข้อมูลล่าสุด)`
      );
    }

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'UPDATE_REGISTRATION',
        entityType: 'REGISTRATION',
        entityId: updatedResult.id || cleanId,
        newData: updatedResult,
      });
    }

    return updatedResult;
  },

  async deleteRegistration(
    id: string,
    currentUser?: AdminUser
  ): Promise<{ success: boolean; message: string }> {
    const cleanId = (id || '').trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    const cancelPayload = {
      registration_status: 'CANCELLED' as const,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          // Try RPC admin_delete_registration first
          let rpcSuccess = false;
          try {
            const { error: rpcErr } = await client.rpc('admin_delete_registration', {
              p_identifier: cleanId,
              p_is_permanent: false,
              p_deleted_by: currentUser?.display_name || 'Admin',
            });
            if (!rpcErr) rpcSuccess = true;
          } catch {
            // RPC not installed, proceed with direct update
          }

          if (!rpcSuccess) {
            let targetQuery = client.from('registrations').update(cancelPayload);
            if (isUUID) {
              targetQuery = targetQuery.eq('id', cleanId);
            } else {
              targetQuery = targetQuery.eq('registration_code', cleanId);
            }
            const { error } = await targetQuery;
            if (error) {
              throw new Error(`ขัดข้องที่ขั้นตอนยกเลิกรายการใน Supabase: ${error.message} (Code: ${error.code || 'UNKNOWN'})`);
            }
          }
        } catch (err: any) {
          console.error('Supabase deleteRegistration (cancel) error:', err);
          throw err;
        }
      }
    }

    // Update Local Storage
    const localRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const regIndex = localRegs.findIndex(
      (r) => r.id === cleanId || r.registration_code === cleanId
    );
    if (regIndex !== -1) {
      localRegs[regIndex] = {
        ...localRegs[regIndex],
        registration_status: 'CANCELLED',
        updated_at: new Date().toISOString(),
      };
      setLocalCollection(STORAGE_KEYS.REGISTRATIONS, localRegs);
    }

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'CANCEL_REGISTRATION',
        entityType: 'REGISTRATION',
        entityId: cleanId,
      });
    }

    return { success: true, message: 'ยกเลิกรายการลงทะเบียนเรียบร้อยแล้ว (Soft Delete)' };
  },

  async deleteRegistrationPermanently(
    id: string,
    currentUser?: AdminUser
  ): Promise<{ success: boolean; message: string }> {
    const cleanId = (id || '').trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          // Try RPC admin_delete_registration first
          let rpcSuccess = false;
          try {
            const { error: rpcErr } = await client.rpc('admin_delete_registration', {
              p_identifier: cleanId,
              p_is_permanent: true,
              p_deleted_by: currentUser?.display_name || 'Super Admin',
            });
            if (!rpcErr) rpcSuccess = true;
          } catch {
            // RPC not installed, proceed with direct delete
          }

          if (!rpcSuccess) {
            // Find target UUID if cleanId is code
            let targetUuid = cleanId;
            if (!isUUID) {
              const { data: row } = await client
                .from('registrations')
                .select('id')
                .eq('registration_code', cleanId)
                .maybeSingle();
              if (row?.id) targetUuid = row.id;
            }

            // 1. Delete linked check-ins first
            const { error: checkInErr } = await client
              .from('check_ins')
              .delete()
              .eq('registration_id', targetUuid);

            if (checkInErr) {
              console.warn('Warning deleting linked check_ins in Supabase:', checkInErr);
            }

            // 2. Delete registration row from Supabase
            const { error } = await client
              .from('registrations')
              .delete()
              .eq('id', targetUuid);

            if (error) {
              throw new Error(`ขัดข้องที่ขั้นตอนลบข้อมูลถาวรออกจาก Supabase: ${error.message} (Code: ${error.code || 'UNKNOWN'})`);
            }
          }
        } catch (err: any) {
          console.error('Supabase permanent delete error:', err);
          throw err;
        }
      }
    }

    // Remove from local storage
    const localRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const filteredRegs = localRegs.filter((r) => r.id !== cleanId && r.registration_code !== cleanId);
    setLocalCollection(STORAGE_KEYS.REGISTRATIONS, filteredRegs);

    const localCheckIns = getLocalCollection<any>(STORAGE_KEYS.CHECK_INS);
    const filteredCheckIns = localCheckIns.filter(
      (c) => c.registration_id !== cleanId
    );
    setLocalCollection(STORAGE_KEYS.CHECK_INS, filteredCheckIns);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'DELETE_REGISTRATION_PERMANENT',
        entityType: 'REGISTRATION',
        entityId: cleanId,
      });
    }

    return { success: true, message: 'ลบข้อมูลผู้ลงทะเบียนออกจากฐานข้อมูลระบบถาวรเรียบร้อยแล้ว' };
  },

  async restoreRegistration(
    id: string,
    currentUser?: AdminUser,
    registrationCode?: string
  ): Promise<{ success: boolean; message: string }> {
    await this.updateRegistration(
      id,
      {
        registration_code: registrationCode,
        registration_status: 'CONFIRMED',
      },
      currentUser
    );

    return { success: true, message: 'กู้คืนสถานะการลงทะเบียนกลับมาใช้งานปกติเรียบร้อยแล้ว' };
  },

  // Realtime subscription for live registration updates
  subscribeToRegistrations(onUpdate: (payload: any) => void): () => void {
    if (!isSupabaseConfigured()) return () => {};
    const client = getSupabase();
    if (!client) return () => {};

    const channelName = `realtime-regs-${Math.random().toString(36).substring(2, 7)}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  },
};
