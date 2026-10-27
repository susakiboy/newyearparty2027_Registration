export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'CHECKIN_STAFF';

export type EventStatus = 'ACTIVE' | 'ARCHIVED' | 'UPCOMING';
export type EntityStatus = 'ACTIVE' | 'INACTIVE';
export type RegistrationStatus = 'CONFIRMED' | 'CANCELLED';
export type CheckInStatus = 'PENDING' | 'CHECKED_IN';
export type CheckInMethod = 'QR_SCAN' | 'MANUAL_SEARCH' | 'BULK_IMPORT';

export interface EventConfig {
  id: string;
  name: string;
  year: string;
  description: string;
  logo_url: string;
  registration_open: boolean;
  registration_start: string | null;
  registration_end: string | null;
  success_message: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  event_id: string;
  name: string;
  color: string;
  color_hex: string;
  status: EntityStatus;
  sort_order: number;
  sub_teams_count?: number;
  registrations_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SubTeam {
  id: string;
  team_id: string;
  name: string;
  status: EntityStatus;
  sort_order: number;
  registrations_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Registration {
  id: string;
  registration_code: string; // e.g. SD2026-000001
  event_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  team_id: string;
  team_name_snapshot: string;
  sub_team_id: string | null;
  sub_team_name_snapshot: string | null;
  qr_token: string;
  lucky_number?: string | null;
  registration_status: RegistrationStatus;
  check_in_status: CheckInStatus;
  checked_in_at: string | null;
  checked_in_by: string | null;
  registered_at: string;
  updated_at: string;
}

export interface LuckyDrawConfig {
  enabled: boolean;
  start_number: number;
  end_number: number;
  prefix: string;
  digits: number;
  auto_assign_on_register: boolean;
  prize_note?: string;
}

export interface LuckyDrawStats {
  totalRegistrations: number;
  assignedCount: number;
  unassignedCount: number;
  totalPoolCapacity: number;
  remainingPoolCapacity: number;
}

export interface AdminUser {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: AdminRole;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface CheckInRecord {
  id: string;
  registration_id: string;
  event_id: string;
  checked_in_at: string;
  checked_in_by: string;
  method: CheckInMethod;
  device_info: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  ip_address_if_available?: string;
  created_at: string;
}

export interface RegistrationFilter {
  search?: string;
  team_id?: string;
  sub_team_id?: string;
  check_in_status?: 'ALL' | 'CHECKED_IN' | 'PENDING';
  registration_status?: 'ALL' | 'CONFIRMED' | 'CANCELLED';
  date_from?: string;
  date_to?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  totalRegistrations: number;
  todayRegistrations: number;
  totalCheckedIn: number;
  notCheckedIn: number;
  checkInPercentage: number;
  teamsBreakdown: {
    team_id: string;
    team_name: string;
    color_hex: string;
    total: number;
    checked_in: number;
    percentage: number;
  }[];
  subTeamsBreakdown: {
    sub_team_id: string;
    sub_team_name: string;
    team_name: string;
    color_hex: string;
    total: number;
    checked_in: number;
  }[];
  hourlyTrend: {
    hour: string;
    count: number;
  }[];
  dailyTrend: {
    date: string;
    count: number;
  }[];
  recentActivity: {
    id: string;
    type: 'REGISTRATION' | 'CHECK_IN';
    name: string;
    code: string;
    team: string;
    timestamp: string;
  }[];
}

export interface ImportPreviewRow {
  rowNumber: number;
  first_name: string;
  last_name: string;
  team_name: string;
  sub_team_name: string;
  team_id?: string;
  sub_team_id?: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: { row: number; reason: string }[];
}
