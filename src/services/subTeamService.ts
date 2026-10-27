import { SubTeam, AdminUser, Registration } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalCollection, setLocalCollection, STORAGE_KEYS } from './storage';
import { auditService } from './auditService';
import { generateUUID } from '../lib/uuid';

export const subTeamService = {
  async getActiveSubTeams(teamId: string): Promise<SubTeam[]> {
    if (!teamId) return [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const { data, error } = await client
            .from('sub_teams')
            .select('*')
            .eq('team_id', teamId)
            .eq('status', 'ACTIVE')
            .order('sort_order', { ascending: true });

          if (!error && data) {
            return data as SubTeam[];
          }
        } catch (err) {
          console.warn('Failed to fetch active sub_teams from Supabase:', err);
        }
      }
    }

    const subTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
    return subTeams
      .filter((st) => st.team_id === teamId && st.status === 'ACTIVE')
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  async getAllSubTeams(teamId?: string): Promise<SubTeam[]> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          let query = client
            .from('sub_teams')
            .select('*')
            .order('sort_order', { ascending: true });

          if (teamId && teamId !== 'ALL') {
            query = query.eq('team_id', teamId);
          }

          const { data: subTeamsData, error: subTeamsErr } = await query;

          if (!subTeamsErr && subTeamsData) {
            // Fetch registrations for count calculation
            const { data: regsData } = await client
              .from('registrations')
              .select('id, sub_team_id, registration_status');

            const regsList = regsData || [];

            const enriched = subTeamsData.map((st: any) => ({
              ...st,
              registrations_count: regsList.filter(
                (r: any) => r.sub_team_id === st.id && r.registration_status === 'CONFIRMED'
              ).length,
            }));

            // Sync with local storage
            const allLocalSubTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
            const mergedMap = new Map<string, SubTeam>();
            allLocalSubTeams.forEach((st) => mergedMap.set(st.id, st));
            subTeamsData.forEach((st: any) => mergedMap.set(st.id, st as SubTeam));
            setLocalCollection(STORAGE_KEYS.SUB_TEAMS, Array.from(mergedMap.values()));

            return enriched;
          }
        } catch (err) {
          console.warn('Failed to fetch sub_teams from Supabase, using local fallback:', err);
        }
      }
    }

    const subTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
    const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);

    let filtered = subTeams;
    if (teamId && teamId !== 'ALL') {
      filtered = subTeams.filter((st) => st.team_id === teamId);
    }

    return filtered
      .map((st) => ({
        ...st,
        registrations_count: registrations.filter(
          (r) => r.sub_team_id === st.id && r.registration_status === 'CONFIRMED'
        ).length,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  async createSubTeam(
    subTeamData: Omit<SubTeam, 'id' | 'created_at' | 'updated_at'>,
    currentUser?: AdminUser
  ): Promise<SubTeam> {
    const cleanName = (subTeamData.name || '').trim();
    if (!cleanName) {
      throw new Error('กรุณาระบุชื่อทีมย่อย');
    }

    const cleanTeamId = (subTeamData.team_id || '').trim();
    if (!cleanTeamId) {
      throw new Error('กรุณาระบุสังกัดทีมหลัก');
    }

    const localSubTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);

    // Check duplicate name under the same team locally
    const isDuplicate = localSubTeams.some(
      (st) => st.team_id === cleanTeamId && st.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`มีทีมย่อยชื่อ "${cleanName}" ในสังกัดนี้แล้ว กรุณาใช้ชื่ออื่น`);
    }

    const newId = generateUUID();
    const nowIso = new Date().toISOString();
    let createdSubTeam: SubTeam | null = null;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        // 1. Try atomic RPC admin_create_sub_team
        try {
          const { data: rpcData, error: rpcError } = await client.rpc('admin_create_sub_team', {
            p_team_id: cleanTeamId,
            p_name: cleanName,
            p_status: subTeamData.status || 'ACTIVE',
            p_sort_order: subTeamData.sort_order || (localSubTeams.length + 1),
          });

          if (!rpcError && rpcData) {
            createdSubTeam = rpcData as SubTeam;
          } else if (rpcError && rpcError.message?.includes('มีทีมย่อยชื่อ')) {
            throw new Error(rpcError.message);
          }
        } catch (rpcErr: any) {
          if (rpcErr.message?.includes('มีทีมย่อยชื่อ')) {
            throw rpcErr;
          }
          console.warn('RPC admin_create_sub_team error, trying direct insert:', rpcErr);
        }

        // 2. Direct insert fallback
        if (!createdSubTeam) {
          const payload = {
            id: newId,
            team_id: cleanTeamId,
            name: cleanName,
            status: subTeamData.status || 'ACTIVE',
            sort_order: subTeamData.sort_order || (localSubTeams.length + 1),
            created_at: nowIso,
            updated_at: nowIso,
          };

          try {
            const { data, error } = await client
              .from('sub_teams')
              .insert(payload)
              .select()
              .maybeSingle();

            if (!error && data) {
              createdSubTeam = data as SubTeam;
            } else if (error) {
              if (error.code === '23505' || error.message?.includes('uq_sub_team_name')) {
                throw new Error(`มีทีมย่อยชื่อ "${cleanName}" ในสังกัดนี้แล้ว กรุณาใช้ชื่ออื่น`);
              }
              console.warn('Direct insert into sub_teams failed, saving locally:', error);
            }
          } catch (insertErr: any) {
            if (insertErr.message?.includes('มีทีมย่อยชื่อ')) {
              throw insertErr;
            }
            console.warn('Caught error in createSubTeam insert:', insertErr);
          }
        }
      }
    }

    if (!createdSubTeam) {
      createdSubTeam = {
        id: newId,
        team_id: cleanTeamId,
        name: cleanName,
        status: subTeamData.status || 'ACTIVE',
        sort_order: subTeamData.sort_order || (localSubTeams.length + 1),
        created_at: nowIso,
        updated_at: nowIso,
      };
    }

    // Update local cache
    const existingIdx = localSubTeams.findIndex((st) => st.id === createdSubTeam!.id);
    if (existingIdx !== -1) {
      localSubTeams[existingIdx] = createdSubTeam;
    } else {
      localSubTeams.push(createdSubTeam);
    }
    setLocalCollection(STORAGE_KEYS.SUB_TEAMS, localSubTeams);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'CREATE_SUB_TEAM',
        entityType: 'SUB_TEAM',
        entityId: createdSubTeam.id,
        newData: createdSubTeam,
      });
    }

    return createdSubTeam;
  },

  async updateSubTeam(
    subTeamId: string,
    updates: Partial<SubTeam>,
    currentUser?: AdminUser
  ): Promise<SubTeam> {
    const cleanId = (subTeamId || '').trim();
    if (!cleanId) {
      throw new Error('ไม่พบรหัสทีมย่อยที่ต้องการแก้ไข');
    }

    const cleanName = updates.name ? updates.name.trim() : undefined;
    const cleanTeamId = updates.team_id ? updates.team_id.trim() : undefined;

    const localSubTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
    const existingIndex = localSubTeams.findIndex((st) => st.id === cleanId);

    // Check duplicate name
    if (cleanName) {
      const targetTeamId = cleanTeamId || (existingIndex !== -1 ? localSubTeams[existingIndex].team_id : '');
      const isDuplicate = localSubTeams.some(
        (st) =>
          st.id !== cleanId &&
          st.team_id === targetTeamId &&
          st.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`มีทีมย่อยชื่อ "${cleanName}" ในสังกัดนี้แล้ว กรุณาใช้ชื่ออื่น`);
      }
    }

    const nowIso = new Date().toISOString();
    let updatedSubTeam: SubTeam | null = null;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        // 1. Try atomic RPC admin_update_sub_team
        try {
          const { data: rpcData, error: rpcError } = await client.rpc('admin_update_sub_team', {
            p_id: cleanId,
            p_name: cleanName || null,
            p_team_id: cleanTeamId || null,
            p_status: updates.status || null,
            p_sort_order: typeof updates.sort_order === 'number' ? updates.sort_order : null,
          });

          if (!rpcError && rpcData) {
            updatedSubTeam = rpcData as SubTeam;
          } else if (rpcError && rpcError.message?.includes('มีทีมย่อยชื่อ')) {
            throw new Error(rpcError.message);
          }
        } catch (rpcErr: any) {
          if (rpcErr.message?.includes('มีทีมย่อยชื่อ')) {
            throw rpcErr;
          }
          console.warn('RPC admin_update_sub_team error, trying direct update:', rpcErr);
        }

        // 2. Direct update fallback
        if (!updatedSubTeam) {
          const patchPayload: Record<string, any> = {
            updated_at: nowIso,
          };
          if (cleanName !== undefined) patchPayload.name = cleanName;
          if (cleanTeamId !== undefined) patchPayload.team_id = cleanTeamId;
          if (updates.status !== undefined) patchPayload.status = updates.status;
          if (updates.sort_order !== undefined) patchPayload.sort_order = updates.sort_order;

          try {
            const { data, error } = await client
              .from('sub_teams')
              .update(patchPayload)
              .eq('id', cleanId)
              .select()
              .maybeSingle();

            if (!error && data) {
              updatedSubTeam = data as SubTeam;
            } else if (error) {
              if (error.code === '23505' || error.message?.includes('uq_sub_team_name')) {
                throw new Error(`มีทีมย่อยชื่อ "${cleanName}" ในสังกัดนี้แล้ว กรุณาใช้ชื่ออื่น`);
              }
              console.warn('Direct update sub_teams table failed, updating locally:', error);
            } else if (!data && existingIndex !== -1) {
              // Upsert if row not present remotely
              const mergedSubTeam: SubTeam = {
                ...localSubTeams[existingIndex],
                ...updates,
                name: cleanName || localSubTeams[existingIndex].name,
                team_id: cleanTeamId || localSubTeams[existingIndex].team_id,
                updated_at: nowIso,
              };

              const { data: upsertData } = await client
                .from('sub_teams')
                .upsert(mergedSubTeam, { onConflict: 'id' })
                .select()
                .maybeSingle();

              if (upsertData) {
                updatedSubTeam = upsertData as SubTeam;
              }
            }
          } catch (updateErr: any) {
            if (updateErr.message?.includes('มีทีมย่อยชื่อ')) {
              throw updateErr;
            }
            console.warn('Caught update error in updateSubTeam:', updateErr);
          }
        }
      }
    }

    if (!updatedSubTeam) {
      if (existingIndex === -1) {
        throw new Error('ไม่พบข้อมูลทีมย่อยในระบบ');
      }

      updatedSubTeam = {
        ...localSubTeams[existingIndex],
        ...updates,
        name: cleanName || localSubTeams[existingIndex].name,
        team_id: cleanTeamId || localSubTeams[existingIndex].team_id,
        updated_at: nowIso,
      };
    }

    // Always update local cache
    if (existingIndex !== -1) {
      localSubTeams[existingIndex] = updatedSubTeam;
    } else {
      localSubTeams.push(updatedSubTeam);
    }
    setLocalCollection(STORAGE_KEYS.SUB_TEAMS, localSubTeams);

    // If sub-team name changed, update snapshot in local registrations
    if (cleanName && existingIndex !== -1 && localSubTeams[existingIndex]?.name !== cleanName) {
      const registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
      let regUpdated = false;
      registrations.forEach((r) => {
        if (r.sub_team_id === cleanId) {
          r.sub_team_name_snapshot = cleanName;
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
        action: 'UPDATE_SUB_TEAM',
        entityType: 'SUB_TEAM',
        entityId: cleanId,
        newData: updatedSubTeam,
      });
    }

    return updatedSubTeam;
  },

  async deleteSubTeam(
    subTeamId: string,
    currentUser?: AdminUser
  ): Promise<{ success: boolean; message: string; action?: string }> {
    const cleanId = (subTeamId || '').trim();
    if (!cleanId) {
      throw new Error('ไม่พบรหัสทีมย่อยที่ต้องการลบ');
    }

    const localSubTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
    const localRegs = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
    const hasLocalRegs = localRegs.some((r) => r.sub_team_id === cleanId);

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        // 1. Try atomic RPC admin_delete_sub_team
        try {
          const { data: rpcData, error: rpcError } = await client.rpc('admin_delete_sub_team', {
            p_id: cleanId,
          });

          if (!rpcError && rpcData) {
            const res = rpcData as { success: boolean; action: string; message: string };

            if (res.action === 'DEACTIVATED') {
              const idx = localSubTeams.findIndex((st) => st.id === cleanId);
              if (idx !== -1) {
                localSubTeams[idx].status = 'INACTIVE';
                localSubTeams[idx].updated_at = new Date().toISOString();
                setLocalCollection(STORAGE_KEYS.SUB_TEAMS, localSubTeams);
              }
            } else {
              const filtered = localSubTeams.filter((st) => st.id !== cleanId);
              setLocalCollection(STORAGE_KEYS.SUB_TEAMS, filtered);
            }

            if (currentUser) {
              await auditService.log({
                userId: currentUser.id,
                userName: currentUser.display_name,
                action: res.action === 'DEACTIVATED' ? 'UPDATE_SUB_TEAM' : 'DELETE_SUB_TEAM',
                entityType: 'SUB_TEAM',
                entityId: cleanId,
              });
            }

            return res;
          }
        } catch (rpcErr) {
          console.warn('RPC admin_delete_sub_team error, trying direct deletion check:', rpcErr);
        }

        // 2. Direct fallback
        try {
          const { count } = await client
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('sub_team_id', cleanId);

          if ((count || 0) > 0 || hasLocalRegs) {
            await client
              .from('sub_teams')
              .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
              .eq('id', cleanId);

            const idx = localSubTeams.findIndex((st) => st.id === cleanId);
            if (idx !== -1) {
              localSubTeams[idx].status = 'INACTIVE';
              setLocalCollection(STORAGE_KEYS.SUB_TEAMS, localSubTeams);
            }

            return {
              success: true,
              action: 'DEACTIVATED',
              message: `เนื่องจากมีประวัติผู้ลงทะเบียนในทีมย่อยนี้ (${(count || 0) || localRegs.filter(r => r.sub_team_id === cleanId).length} คน) ระบบจึงเปลี่ยนสถานะเป็น "ปิดใช้งาน" เพื่อรักษาประวัติการลงทะเบียน`,
            };
          }

          const { error: delError } = await client.from('sub_teams').delete().eq('id', cleanId);
          if (!delError) {
            const filtered = localSubTeams.filter((st) => st.id !== cleanId);
            setLocalCollection(STORAGE_KEYS.SUB_TEAMS, filtered);

            return {
              success: true,
              action: 'DELETED',
              message: 'ลบทีมย่อยออกจากระบบเรียบร้อยแล้ว',
            };
          }
        } catch (err) {
          console.warn('Direct delete sub_team failed in Supabase:', err);
        }
      }
    }

    if (hasLocalRegs) {
      const idx = localSubTeams.findIndex((st) => st.id === cleanId);
      if (idx !== -1) {
        localSubTeams[idx].status = 'INACTIVE';
        localSubTeams[idx].updated_at = new Date().toISOString();
        setLocalCollection(STORAGE_KEYS.SUB_TEAMS, localSubTeams);
      }
      return {
        success: true,
        action: 'DEACTIVATED',
        message: 'เนื่องจากมีประวัติผู้ลงทะเบียนในทีมย่อยนี้ ระบบจึงเปลี่ยนสถานะเป็น "ปิดใช้งาน" เพื่อรักษาประวัติการลงทะเบียน',
      };
    }

    const filtered = localSubTeams.filter((st) => st.id !== cleanId);
    setLocalCollection(STORAGE_KEYS.SUB_TEAMS, filtered);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'DELETE_SUB_TEAM',
        entityType: 'SUB_TEAM',
        entityId: cleanId,
      });
    }

    return {
      success: true,
      action: 'DELETED',
      message: 'ลบทีมย่อยเรียบร้อยแล้ว',
    };
  },

  async reorderSubTeams(
    orderedIds: string[],
    currentUser?: AdminUser
  ): Promise<void> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          await Promise.all(
            orderedIds.map((id, index) =>
              client.from('sub_teams').update({ sort_order: index + 1 }).eq('id', id)
            )
          );
        } catch (err) {
          console.warn('Failed to update sub-team sort order in Supabase:', err);
        }
      }
    }

    const subTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS);
    orderedIds.forEach((id, index) => {
      const st = subTeams.find((item) => item.id === id);
      if (st) st.sort_order = index + 1;
    });
    setLocalCollection(STORAGE_KEYS.SUB_TEAMS, subTeams);

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'UPDATE_SUB_TEAM',
        entityType: 'SUB_TEAM',
        entityId: 'reorder',
        newData: { orderedIds },
      });
    }
  },
};
