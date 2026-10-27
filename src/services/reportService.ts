import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Registration, RegistrationFilter, Team } from '../types';
import { registrationService } from './registrationService';
import { teamService } from './teamService';
import { exportService } from './exportService';

export interface TeamSummaryReportRow {
  teamName: string;
  totalRegistered: number;
  totalCheckedIn: number;
  pendingCheckIn: number;
  checkInRate: string;
}

export const reportService = {
  async getFilteredRegistrations(filter: RegistrationFilter): Promise<Registration[]> {
    return registrationService.getAllForExport(filter);
  },

  async getTeamSummaryReport(eventId: string): Promise<TeamSummaryReportRow[]> {
    const teams = await teamService.getAllTeamsWithCounts(eventId);
    let registrations: Registration[] = [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data } = await client
          .from('registrations')
          .select('*')
          .eq('event_id', eventId)
          .eq('registration_status', 'CONFIRMED');
        registrations = (data as Registration[]) || [];
      }
    } else {
      registrations = await registrationService.getAllForExport({ registration_status: 'CONFIRMED' });
    }

    return teams.map((team) => {
      const teamRegs = registrations.filter((r) => r.team_id === team.id);
      const total = teamRegs.length;
      const checkedIn = teamRegs.filter((r) => r.check_in_status === 'CHECKED_IN').length;
      const pending = total - checkedIn;
      const rate = total > 0 ? `${((checkedIn / total) * 100).toFixed(1)}%` : '0%';

      return {
        teamName: team.name,
        totalRegistered: total,
        totalCheckedIn: checkedIn,
        pendingCheckIn: pending,
        checkInRate: rate,
      };
    });
  },

  async exportParticipantsReport(
    filter: RegistrationFilter,
    teamNameLabel: string = 'AllTeams',
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<void> {
    const data = await this.getFilteredRegistrations(filter);
    exportService.exportRegistrationsToExcel(data, teamNameLabel, format);
  },

  async exportSummaryReport(eventId: string): Promise<void> {
    const summaryRows = await this.getTeamSummaryReport(eventId);
    const teams = await teamService.getActiveTeams(eventId);
    exportService.exportSummaryToExcel(summaryRows as any, teams);
  },
};
