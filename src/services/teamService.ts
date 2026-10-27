import { Team, AdminUser, Registration, SubTeam } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalCollection, setLocalCollection, STORAGE_KEYS } from './storage';
import { auditService } from './auditService';
import { generateUUID } from '../lib/uuid';

const DEFAULT_EVENT_ID = 'a0000000-0000-0000-0000-000000000001';

/**
 * Helper to ensure a valid foreign-key event_id exists in Supabase events table
 */
async function resolveAndEnsureEventId(client: any, preferredEventId?: string): Promise<string> {
  const targetId = preferredEventId && preferredEventId.trim() ? preferredEventId.trim() : DEFAULT_EVENT_ID;

  try {
    // Check if target event exists
    const { data: existing } = await client
      .from('events')
      .select('id')
      .eq('id', targetId)
      .maybeSingle();

    if (existing?.id) {
      return existing.id;
    }

    // Check if any active event exists
    const { data: activeEvent } = await client
      .from('events')
      .select('id')
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (activeEvent?.id) {
      return activeEvent.id;
    }

    // Seed default active event if events table is empty
    const { data: seeded } = await client
      .from('events')
      .upsert({
        id: DEFAULT_EVENT_ID,
        name: 'SPORTS DAY',
        year: '2026',
        description: 'มหกรรมกีฬาสีและสานสัมพันธ์ประจำปี 2569 — ร่วมพลัง รวมใจ ก้าวไกลไปด้วยกัน',
        status: 'ACTIVE',
        registration_open: true,
      }, { onConflict: 'id' })
      .select('id')
      .maybeSingle();

    return seeded?.id || DEFAULT_EVENT_ID;
  } catch (err) {
    console.warn('Could not verify/seed event in Supabase, using fallback:', err);
    return targetId;
  }
}

export const teamService = {
  async getActiveTeams(eventId: string): Promise<Team[]> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const { data, error } = await client
            .from('teams')
            .select('*')
            .eq('status', 'ACTIVE')
            .order('sort_order', { ascending: true });

          if (!error && data && data.length > 0) {
            // Cache to local storage
            const localTeams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
            const merged = [...data];
            setLocalCollection(STORAGE_KEYS.TEAMS, merged);
            return data as Team[];
          }
        } catch (err) {
          console.warn('Failed to fetch active teams from Supabase, using local storage:', err);
        }
      }
    }

    const teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
    return teams
      .filter((t) => t.status === 'ACTIVE')
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  async getAllTeamsWithCounts(eventId: string): Promise<Team[]> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          // Fetch teams
          const { data: teamsData, error: teamsError } = await client
            .from('teams')
            .select('*')
            .order('sort_order', { ascending: true });

          if (!teamsError && teamsData && teamsData.length > 0) {
            // Fetch sub_teams and registrations for counts
            const [{ data: subTeamsData }, { data: regsData }] = await Promise.all([
              client.from('sub_teams').select('id, team_id, status'),
              client.from('registrations').select('id, team_id, registration_status'),
            ]);

            const subTeamsList = subTeamsData || [];
            const regsList = regsData || [];

            const enriched = teamsData.map((t: any) => ({
              ...t,
              sub_teams_count: subTeamsList.filter(
                (st: any) => st.team_id === t.id && st.status === 'ACTIVE'
              ).length,
              registrations_count: regsList.filter(
                (r: any) => r.team_id === t.id && r.registration_status === 'CONFIRMED'
              ).length,
            }));

            // Sync with local storage cache
            setLocalCollection(STORAGE_KEYS.TEAMS, teamsData as Team[]);

            return enriched;
          }
        } catch (err) {
          console.warn('Failed to load teams with counts from Supabase, using local fallback:', err);
        }
      }
    }

    // Fallback to local storage
    const teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
    const subTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
    const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);

    return teams
      .map((team) => {
        const teamSubTeams = subTeams.filter(
          (st) => st.team_id === team.id && st.status === 'ACTIVE'
        );
        const teamRegs = registrations.filter(
          (r) => r.team_id === team.id && r.registration_status === 'CONFIRMED'
        );
        return {
          ...team,
          sub_teams_count: teamSubTeams.length,
          registrations_count: teamRegs.length,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  async createTeam(
    teamData: Omit<Team, 'id' | 'created_at' | 'updated_at'>,
    currentUser?: AdminUser
  ): Promise<Team> {
    const cleanName = (teamData.name || '').trim();
    if (!cleanName) {
      throw new Error('กรุณาระบุชื่อทีม');
    }

    const cleanColor = (teamData.color || '').trim() || cleanName;
    let cleanHex = (teamData.color_hex || '').trim();
    if (!cleanHex) {
      cleanHex = '#8B5CF6';
    } else if (!cleanHex.startsWith('#')) {
      cleanHex = '#' + cleanHex;
    }

    const localTeams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);

    // Check duplicate name locally first
    const isDuplicate = localTeams.some(
      (t) => t.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`มีทีมชื่อ "${cleanName}" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
    }

    const newId = generateUUID();
    const nowIso = new Date().toISOString();

    let createdTeam: Team | null = null;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const resolvedEventId = await resolveAndEnsureEventId(client, teamData.event_id);

        // 1. Try atomic RPC admin_create_team (SECURITY DEFINER bypasses RLS)
        try {
          const { data: rpcData, error: rpcError } = await client.rpc('admin_create_team', {
            p_event_id: resolvedEventId,
            p_name: cleanName,
            p_color: cleanColor,
            p_color_hex: cleanHex,
            p_status: teamData.status || 'ACTIVE',
            p_sort_order: teamData.sort_order || (localTeams.length + 1),
          });

          if (!rpcError && rpcData) {
            createdTeam = rpcData as Team;
          } else if (rpcError && rpcError.message?.includes('มีทีมชื่อ')) {
            throw new Error(rpcError.message);
          }
        } catch (rpcErr: any) {
          if (rpcErr.message?.includes('มีทีมชื่อ')) {
            throw rpcErr;
          }
          console.warn('RPC admin_create_team error, attempting direct insert:', rpcErr);
        }

        // 2. Direct insert if RPC not present or skipped
        if (!createdTeam) {
          const payload = {
            id: newId,
            event_id: resolvedEventId,
            name: cleanName,
            color: cleanColor,
            color_hex: cleanHex,
            status: teamData.status || 'ACTIVE',
            sort_order: teamData.sort_order || (localTeams.length + 1),
            created_at: nowIso,
            updated_at: nowIso,
          };

          try {
            const { data, error } = await client
              .from('teams')
              .insert(payload)
              .select()
              .maybeSingle();

            if (!error && data) {
              createdTeam = data as Team;
            } else if (error) {
              if (error.code === '23505' || error.message?.includes('uq_team_event_name')) {
                throw new Error(`มีทีมชื่อ "${cleanName}" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
              }
              console.warn('Direct insert into teams table failed, syncing locally:', error);
            }
          } catch (insertErr: any) {
            if (insertErr.message?.includes('มีทีมชื่อ')) {
              throw insertErr;
            }
            console.warn('Caught insert error in createTeam:', insertErr);
          }
        }
      }
    }

    // If remote insert was not successful or Supabase not configured, use local model
    if (!createdTeam) {
      createdTeam = {
        id: newId,
        event_id: teamData.event_id || DEFAULT_EVENT_ID,
        name: cleanName,
        color: cleanColor,
        color_hex: cleanHex,
        status: teamData.status || 'ACTIVE',
        sort_order: teamData.sort_order || (localTeams.length + 1),
        created_at: nowIso,
        updated_at: nowIso,
      };
    }

    // Always update local cache
    const existingIdx = localTeams.findIndex((t) => t.id === createdTeam!.id);
    if (existingIdx !== -1) {
      localTeams[existingIdx] = createdTeam;
    } else {
      localTeams.push(createdTeam);
    }
    setLocalCollection(STORAGE_KEYS.TEAMS, localTeams);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'CREATE_TEAM',
        entityType: 'TEAM',
        entityId: createdTeam.id,
        newData: createdTeam,
      });
    }

    return createdTeam;
  },

  async updateTeam(
    teamId: string,
    updates: Partial<Team>,
    currentUser?: AdminUser
  ): Promise<Team> {
    const cleanId = (teamId || '').trim();
    if (!cleanId) {
      throw new Error('ไม่พบรหัสทีมที่ต้องการแก้ไข');
    }

    const cleanName = updates.name ? updates.name.trim() : undefined;
    const cleanColor = updates.color ? updates.color.trim() : undefined;
    let cleanHex = updates.color_hex ? updates.color_hex.trim() : undefined;
    if (cleanHex && !cleanHex.startsWith('#')) {
      cleanHex = '#' + cleanHex;
    }

    const localTeams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
    const existingIndex = localTeams.findIndex((t) => t.id === cleanId);

    // Duplicate name check if renaming
    if (cleanName) {
      const isDuplicate = localTeams.some(
        (t) => t.id !== cleanId && t.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`มีทีมชื่อ "${cleanName}" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
      }
    }

    const nowIso = new Date().toISOString();
    let updatedTeam: Team | null = null;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        // 1. Try atomic RPC admin_update_team
        try {
          const { data: rpcData, error: rpcError } = await client.rpc('admin_update_team', {
            p_id: cleanId,
            p_name: cleanName || null,
            p_color: cleanColor || null,
            p_color_hex: cleanHex || null,
            p_status: updates.status || null,
            p_sort_order: typeof updates.sort_order === 'number' ? updates.sort_order : null,
          });

          if (!rpcError && rpcData) {
            updatedTeam = rpcData as Team;
          } else if (rpcError && rpcError.message?.includes('มีทีมชื่อ')) {
            throw new Error(rpcError.message);
          }
        } catch (rpcErr: any) {
          if (rpcErr.message?.includes('มีทีมชื่อ')) {
            throw rpcErr;
          }
          console.warn('RPC admin_update_team error, attempting direct update:', rpcErr);
        }

        // 2. Direct update fallback
        if (!updatedTeam) {
          const patchPayload: Record<string, any> = {
            updated_at: nowIso,
          };
          if (cleanName !== undefined) patchPayload.name = cleanName;
          if (cleanColor !== undefined) patchPayload.color = cleanColor;
          if (cleanHex !== undefined) patchPayload.color_hex = cleanHex;
          if (updates.status !== undefined) patchPayload.status = updates.status;
          if (updates.sort_order !== undefined) patchPayload.sort_order = updates.sort_order;

          try {
            const { data, error } = await client
              .from('teams')
              .update(patchPayload)
              .eq('id', cleanId)
              .select()
              .maybeSingle();

            if (!error && data) {
              updatedTeam = data as Team;
            } else if (error) {
              if (error.code === '23505' || error.message?.includes('uq_team_event_name')) {
                throw new Error(`มีทีมชื่อ "${cleanName}" อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
              }
              console.warn('Direct update teams table failed, updating locally:', error);
            } else if (!data && existingIndex !== -1) {
              // Row might not exist in Supabase yet; upsert it
              const resolvedEventId = await resolveAndEnsureEventId(client, localTeams[existingIndex].event_id);
              const mergedTeam: Team = {
                ...localTeams[existingIndex],
                ...updates,
                event_id: resolvedEventId,
                name: cleanName || localTeams[existingIndex].name,
                color: cleanColor || localTeams[existingIndex].color,
                color_hex: cleanHex || localTeams[existingIndex].color_hex,
                updated_at: nowIso,
              };

              const { data: upsertData } = await client
                .from('teams')
                .upsert(mergedTeam, { onConflict: 'id' })
                .select()
                .maybeSingle();

              if (upsertData) {
                updatedTeam = upsertData as Team;
              }
            }
          } catch (updateErr: any) {
            if (updateErr.message?.includes('มีทีมชื่อ')) {
              throw updateErr;
            }
            console.warn('Caught update error in updateTeam:', updateErr);
          }
        }
      }
    }

    if (!updatedTeam) {
      if (existingIndex === -1) {
        throw new Error('ไม่พบข้อมูลทีมในระบบ');
      }

      updatedTeam = {
        ...localTeams[existingIndex],
        ...updates,
        name: cleanName || localTeams[existingIndex].name,
        color: cleanColor || localTeams[existingIndex].color,
        color_hex: cleanHex || localTeams[existingIndex].color_hex,
        updated_at: nowIso,
      };
    }

    // Always update local cache
    if (existingIndex !== -1) {
      localTeams[existingIndex] = updatedTeam;
    } else {
      localTeams.push(updatedTeam);
    }
    setLocalCollection(STORAGE_KEYS.TEAMS, localTeams);

    // If name changed, update team snapshot in local registrations
    if (cleanName && existingIndex !== -1 && localTeams[existingIndex]?.name !== cleanName) {
      const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
      let regUpdated = false;
      registrations.forEach((r) => {
        if (r.team_id === cleanId) {
          r.team_name_snapshot = cleanName;
          regUpdated = true;
        }
      });
      if (regUpdated) {
        setLocalCollection(STORAGE_KEYS.REGISTRATIONS, registrations);
      }
    }

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'UPDATE_TEAM',
        entityType: 'TEAM',
        entityId: cleanId,
        newData: updatedTeam,
      });
    }

    return updatedTeam;
  },

  async deleteTeam(
    teamId: string,
    currentUser?: AdminUser
  ): Promise<{ success: boolean; message: string; action?: string }> {
    const cleanId = (teamId || '').trim();
    if (!cleanId) {
      throw new Error('ไม่พบรหัสทีมที่ต้องการลบ');
    }

    const localTeams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
    const existingTeam = localTeams.find((t) => t.id === cleanId);

    // Check registrations locally
    const localRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const hasLocalRegs = localRegs.some((r) => r.team_id === cleanId);

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        // 1. Try atomic RPC admin_delete_team (handles registration check and safe deactivation)
        try {
          const { data: rpcData, error: rpcError } = await client.rpc('admin_delete_team', {
            p_id: cleanId,
          });

          if (!rpcError && rpcData) {
            const res = rpcData as { success: boolean; action: string; message: string };

            if (res.action === 'DEACTIVATED') {
              // Update local state to INACTIVE
              const idx = localTeams.findIndex((t) => t.id === cleanId);
              if (idx !== -1) {
                localTeams[idx].status = 'INACTIVE';
                localTeams[idx].updated_at = new Date().toISOString();
                setLocalCollection(STORAGE_KEYS.TEAMS, localTeams);
              }
            } else {
              // Deleted
              const filteredTeams = localTeams.filter((t) => t.id !== cleanId);
              setLocalCollection(STORAGE_KEYS.TEAMS, filteredTeams);

              // Also delete linked sub-teams locally
              const localSubTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
              const filteredSubTeams = localSubTeams.filter((st) => st.team_id !== cleanId);
              setLocalCollection(STORAGE_KEYS.SUB_TEAMS, filteredSubTeams);
            }

            if (currentUser) {
              await auditService.log({
                userId: currentUser.id,
                userName: currentUser.display_name,
                action: res.action === 'DEACTIVATED' ? 'UPDATE_TEAM' : 'DELETE_TEAM',
                entityType: 'TEAM',
                entityId: cleanId,
              });
            }

            return res;
          }
        } catch (rpcErr) {
          console.warn('RPC admin_delete_team error, trying direct deletion check:', rpcErr);
        }

        // 2. Direct fallback
        try {
          // Check remote registrations
          const { count } = await client
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', cleanId);

          if ((count || 0) > 0 || hasLocalRegs) {
            // Safely mark as INACTIVE instead of throwing foreign key error
            await client
              .from('teams')
              .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
              .eq('id', cleanId);

            const idx = localTeams.findIndex((t) => t.id === cleanId);
            if (idx !== -1) {
              localTeams[idx].status = 'INACTIVE';
              setLocalCollection(STORAGE_KEYS.TEAMS, localTeams);
            }

            return {
              success: true,
              action: 'DEACTIVATED',
              message: `เนื่องจากมีประวัติผู้ลงทะเบียนในทีมนี้ (${(count || 0) || localRegs.filter(r => r.team_id === cleanId).length} คน) ระบบจึงเปลี่ยนสถานะเป็น "ปิดใช้งาน" เพื่อรักษาประวัติการลงทะเบียน`,
            };
          }

          // No registrations: delete linked sub_teams first, then delete team
          await client.from('sub_teams').delete().eq('team_id', cleanId);
          const { error: delError } = await client.from('teams').delete().eq('id', cleanId);

          if (!delError) {
            const filteredTeams = localTeams.filter((t) => t.id !== cleanId);
            setLocalCollection(STORAGE_KEYS.TEAMS, filteredTeams);

            const localSubTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
            const filteredSubTeams = localSubTeams.filter((st) => st.team_id !== cleanId);
            setLocalCollection(STORAGE_KEYS.SUB_TEAMS, filteredSubTeams);

            return {
              success: true,
              action: 'DELETED',
              message: 'ลบทีมและทีมย่อยออกจากระบบเรียบร้อยแล้ว',
            };
          }
        } catch (err) {
          console.warn('Direct delete team failed in Supabase, checking local:', err);
        }
      }
    }

    // Local Storage logic
    if (hasLocalRegs) {
      const idx = localTeams.findIndex((t) => t.id === cleanId);
      if (idx !== -1) {
        localTeams[idx].status = 'INACTIVE';
        localTeams[idx].updated_at = new Date().toISOString();
        setLocalCollection(STORAGE_KEYS.TEAMS, localTeams);
      }
      return {
        success: true,
        action: 'DEACTIVATED',
        message: 'เนื่องจากมีประวัติผู้ลงทะเบียนในทีมนี้ ระบบจึงเปลี่ยนสถานะเป็น "ปิดใช้งาน" เพื่อรักษาประวัติการลงทะเบียน',
      };
    }

    // No registrations: safe to delete
    const filteredTeams = localTeams.filter((t) => t.id !== cleanId);
    setLocalCollection(STORAGE_KEYS.TEAMS, filteredTeams);

    const localSubTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
    const filteredSubTeams = localSubTeams.filter((st) => st.team_id !== cleanId);
    setLocalCollection(STORAGE_KEYS.SUB_TEAMS, filteredSubTeams);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'DELETE_TEAM',
        entityType: 'TEAM',
        entityId: cleanId,
      });
    }

    return {
      success: true,
      action: 'DELETED',
      message: 'ลบทีมและทีมย่อยเรียบร้อยแล้ว',
    };
  },

  async reorderTeams(
    orderedIds: string[],
    currentUser?: AdminUser
  ): Promise<void> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          await Promise.all(
            orderedIds.map((id, index) =>
              client.from('teams').update({ sort_order: index + 1 }).eq('id', id)
            )
          );
        } catch (err) {
          console.warn('Failed to update sort order in Supabase:', err);
        }
      }
    }

    const teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS);
    orderedIds.forEach((id, index) => {
      const t = teams.find((item) => item.id === id);
      if (t) t.sort_order = index + 1;
    });
    setLocalCollection(STORAGE_KEYS.TEAMS, teams);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'UPDATE_TEAM',
        entityType: 'TEAM',
        entityId: 'reorder',
        newData: { orderedIds },
      });
    }
  },
};
