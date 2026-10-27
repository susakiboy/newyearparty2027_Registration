import { DashboardStats, Registration, Team, SubTeam, CheckInRecord } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalCollection, STORAGE_KEYS } from './storage';

export const dashboardService = {
  async getStats(eventId: string): Promise<DashboardStats> {
    let registrations: Registration[] = [];
    let teams: Team[] = [];
    let subTeams: SubTeam[] = [];
    let checkIns: CheckInRecord[] = [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const [regsRes, teamsRes, subTeamsRes, checkInsRes] = await Promise.all([
            client.from('registrations').select('*').eq('event_id', eventId),
            client.from('teams').select('*').eq('event_id', eventId).eq('status', 'ACTIVE'),
            client.from('sub_teams').select('*').eq('status', 'ACTIVE'),
            client.from('check_ins').select('*').eq('event_id', eventId),
          ]);

          if (regsRes.data) registrations = regsRes.data as Registration[];
          if (teamsRes.data) teams = teamsRes.data as Team[];
          if (subTeamsRes.data) subTeams = subTeamsRes.data as SubTeam[];
          if (checkInsRes.data) checkIns = checkInsRes.data as CheckInRecord[];
        } catch (err) {
          console.error('Failed to load dashboard stats from Supabase:', err);
        }
      }
    }

    // Fallback to local store if Supabase not populated or offline
    if (registrations.length === 0 && !isSupabaseConfigured()) {
      registrations = getLocalCollection<Registration>(STORAGE_KEYS.REGISTRATIONS);
      teams = getLocalCollection<Team>(STORAGE_KEYS.TEAMS).filter(
        (t) => t.event_id === eventId && t.status === 'ACTIVE'
      );
      subTeams = getLocalCollection<SubTeam>(STORAGE_KEYS.SUB_TEAMS).filter(
        (st) => st.status === 'ACTIVE'
      );
      checkIns = getLocalCollection<CheckInRecord>(STORAGE_KEYS.CHECK_INS).filter(
        (c) => c.event_id === eventId
      );
    }

    const activeRegs = registrations.filter(
      (r) => r.event_id === eventId && r.registration_status === 'CONFIRMED'
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const todayRegistrations = activeRegs.filter((r) => r.registered_at.startsWith(todayStr)).length;

    const totalCheckedIn = activeRegs.filter((r) => r.check_in_status === 'CHECKED_IN').length;
    const notCheckedIn = activeRegs.length - totalCheckedIn;
    const checkInPercentage =
      activeRegs.length > 0 ? Math.round((totalCheckedIn / activeRegs.length) * 100) : 0;

    // Teams Breakdown (Dynamic from Supabase)
    const teamsBreakdown = teams
      .map((team) => {
        const teamRegs = activeRegs.filter((r) => r.team_id === team.id);
        const checked = teamRegs.filter((r) => r.check_in_status === 'CHECKED_IN').length;
        return {
          team_id: team.id,
          team_name: team.name,
          color_hex: team.color_hex,
          total: teamRegs.length,
          checked_in: checked,
          percentage: teamRegs.length > 0 ? Math.round((checked / teamRegs.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Sub Teams Breakdown
    const subTeamsBreakdown = subTeams
      .map((st) => {
        const parentTeam = teams.find((t) => t.id === st.team_id);
        const stRegs = activeRegs.filter((r) => r.sub_team_id === st.id);
        const checked = stRegs.filter((r) => r.check_in_status === 'CHECKED_IN').length;
        return {
          sub_team_id: st.id,
          sub_team_name: st.name,
          team_name: parentTeam ? parentTeam.name : 'Unknown',
          color_hex: parentTeam ? parentTeam.color_hex : '#64748b',
          total: stRegs.length,
          checked_in: checked,
        };
      })
      .filter((st) => st.total > 0)
      .sort((a, b) => b.total - a.total);

    // Hourly trend
    const hourlyMap: Record<string, number> = {};
    for (let i = 8; i <= 18; i++) {
      const hStr = i.toString().padStart(2, '0') + ':00';
      hourlyMap[hStr] = 0;
    }
    activeRegs.forEach((r) => {
      const date = new Date(r.registered_at);
      const h = date.getHours().toString().padStart(2, '0') + ':00';
      if (hourlyMap[h] !== undefined) {
        hourlyMap[h]++;
      } else {
        hourlyMap[h] = 1;
      }
    });
    const hourlyTrend = Object.entries(hourlyMap).map(([hour, count]) => ({ hour, count }));

    // Daily trend
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
      dailyMap[dStr] = 0;
    }
    activeRegs.forEach((r) => {
      const d = new Date(r.registered_at);
      const dStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
      if (dailyMap[dStr] !== undefined) {
        dailyMap[dStr]++;
      }
    });
    const dailyTrend = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // Recent Activity ticker
    const recentActivity: DashboardStats['recentActivity'] = [];

    // Add recent check-ins
    const sortedCheckIns = [...checkIns]
      .sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())
      .slice(0, 5);

    sortedCheckIns.forEach((c) => {
      const reg = activeRegs.find((r) => r.id === c.registration_id);
      if (reg) {
        recentActivity.push({
          id: c.id,
          type: 'CHECK_IN',
          name: reg.full_name,
          code: reg.registration_code,
          team: reg.team_name_snapshot,
          timestamp: c.checked_in_at,
        });
      }
    });

    // Add recent registrations
    const sortedRegs = [...activeRegs]
      .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())
      .slice(0, 5);

    sortedRegs.forEach((r) => {
      recentActivity.push({
        id: r.id,
        type: 'REGISTRATION',
        name: r.full_name,
        code: r.registration_code,
        team: r.team_name_snapshot,
        timestamp: r.registered_at,
      });
    });

    // Sort recent activity combined
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      totalRegistrations: activeRegs.length,
      todayRegistrations,
      totalCheckedIn,
      notCheckedIn,
      checkInPercentage,
      teamsBreakdown,
      subTeamsBreakdown,
      hourlyTrend,
      dailyTrend,
      recentActivity: recentActivity.slice(0, 8),
    };
  },
};
