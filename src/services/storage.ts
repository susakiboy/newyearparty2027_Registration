import { EventConfig, Team, SubTeam, Registration, AdminUser, CheckInRecord, AuditLog } from '../types';

const STORAGE_KEYS = {
  EVENTS: 'sd_events_v1',
  TEAMS: 'sd_teams_v1',
  SUB_TEAMS: 'sd_sub_teams_v1',
  REGISTRATIONS: 'sd_registrations_v1',
  ADMINS: 'sd_admins_v1',
  ADMIN_PASSWORDS: 'sd_admin_passwords_v1',
  CHECK_INS: 'sd_check_ins_v1',
  AUDIT_LOGS: 'sd_audit_logs_v1',
  SEQ_COUNTER: 'sd_reg_seq_v1',
  CURRENT_ADMIN: 'sd_current_admin_v1',
};

// Listeners for pseudo-realtime events
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribeToChanges = (callback: Listener): (() => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const notifySubscribers = () => {
  listeners.forEach((cb) => cb());
};

// Seed Data
const DEFAULT_EVENT_ID = 'a0000000-0000-0000-0000-000000000001';

const defaultEvent: EventConfig = {
  id: DEFAULT_EVENT_ID,
  name: 'NEW YEAR PARTY',
  year: '2027',
  description: 'ร่วมสังสรรค์รับวันปีใหม่ ประจำปี 2570 พร้อมของรางวัลมากมาย',
  logo_url: '',
  registration_open: true,
  registration_start: null,
  registration_end: null,
  success_message: 'ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว กรุณาบันทึกภาพหน้าจอหรือดาวน์โหลด QR Code สำหรับนำมาแสดงในวันงาน',
  status: 'ACTIVE',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const defaultTeams: Team[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    event_id: DEFAULT_EVENT_ID,
    name: 'Team Purple',
    color: 'Purple',
    color_hex: '#8B5CF6',
    status: 'ACTIVE',
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    event_id: DEFAULT_EVENT_ID,
    name: 'Team Pink',
    color: 'Pink',
    color_hex: '#EC4899',
    status: 'ACTIVE',
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    event_id: DEFAULT_EVENT_ID,
    name: 'Team Yellow',
    color: 'Yellow',
    color_hex: '#EAB308',
    status: 'ACTIVE',
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    event_id: DEFAULT_EVENT_ID,
    name: 'Team Green',
    color: 'Green',
    color_hex: '#10B981',
    status: 'ACTIVE',
    sort_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const defaultSubTeams: SubTeam[] = [
  {
    id: 's0000000-0000-0000-0000-000000000001',
    team_id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Purple A',
    status: 'ACTIVE',
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's0000000-0000-0000-0000-000000000002',
    team_id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Purple B',
    status: 'ACTIVE',
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's0000000-0000-0000-0000-000000000003',
    team_id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Purple C',
    status: 'ACTIVE',
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's0000000-0000-0000-0000-000000000004',
    team_id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Purple Staff',
    status: 'ACTIVE',
    sort_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Team Pink
  {
    id: 's0000000-0000-0000-0000-000000000005',
    team_id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Pink Alpha',
    status: 'ACTIVE',
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's0000000-0000-0000-0000-000000000006',
    team_id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Pink Beta',
    status: 'ACTIVE',
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Team Yellow
  {
    id: 's0000000-0000-0000-0000-000000000007',
    team_id: 'b0000000-0000-0000-0000-000000000003',
    name: 'Yellow Strike',
    status: 'ACTIVE',
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's0000000-0000-0000-0000-000000000008',
    team_id: 'b0000000-0000-0000-0000-000000000003',
    name: 'Yellow Gold',
    status: 'ACTIVE',
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Team Green
  {
    id: 's0000000-0000-0000-0000-000000000009',
    team_id: 'b0000000-0000-0000-0000-000000000004',
    name: 'Green Force',
    status: 'ACTIVE',
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's0000000-0000-0000-0000-000000000010',
    team_id: 'b0000000-0000-0000-0000-000000000004',
    name: 'Green Eco',
    status: 'ACTIVE',
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const defaultAdmins: AdminUser[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    user_id: 'u0000000-0000-0000-0000-000000000001',
    display_name: 'Super Administrator',
    email: 'superadmin@sportsday.com',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Helper to initialize local storage
export const initLocalStorage = (): void => {
  if (typeof window === 'undefined') return;

  if (!localStorage.getItem(STORAGE_KEYS.EVENTS)) {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([defaultEvent]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TEAMS)) {
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(defaultTeams));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SUB_TEAMS)) {
    localStorage.setItem(STORAGE_KEYS.SUB_TEAMS, JSON.stringify(defaultSubTeams));
  }
  
  // Initialize Admins & preserve any admin created by Super Admin
  const existingAdmins = localStorage.getItem(STORAGE_KEYS.ADMINS);
  if (!existingAdmins) {
    localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(defaultAdmins));
  } else {
    try {
      const parsed: AdminUser[] = JSON.parse(existingAdmins);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const masterIdx = parsed.findIndex((a) => a.email.toLowerCase() === 'superadmin@sportsday.com');
        if (masterIdx === -1) {
          parsed.unshift(defaultAdmins[0]);
        } else {
          parsed[masterIdx].role = 'SUPER_ADMIN';
          parsed[masterIdx].status = 'ACTIVE';
        }
        localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(parsed));
      } else {
        localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(defaultAdmins));
      }
    } catch {
      localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(defaultAdmins));
    }
  }

  // Initialize admin passwords mapping
  const existingPwMap = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORDS);
  if (!existingPwMap) {
    localStorage.setItem(
      STORAGE_KEYS.ADMIN_PASSWORDS,
      JSON.stringify({
        'superadmin@sportsday.com': 'M2K3Dwin',
        superadmin: 'M2K3Dwin',
      })
    );
  } else {
    try {
      const map = JSON.parse(existingPwMap);
      if (!map['superadmin@sportsday.com'] || map['superadmin@sportsday.com'] !== 'M2K3Dwin') {
        map['superadmin@sportsday.com'] = 'M2K3Dwin';
      }
      map['superadmin'] = 'M2K3Dwin';
      localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORDS, JSON.stringify(map));
    } catch {
      localStorage.setItem(
        STORAGE_KEYS.ADMIN_PASSWORDS,
        JSON.stringify({
          'superadmin@sportsday.com': 'M2K3Dwin',
          superadmin: 'M2K3Dwin',
        })
      );
    }
  }

  // Preserve active admin session if still exists and ACTIVE
  const currentAdmin = localStorage.getItem(STORAGE_KEYS.CURRENT_ADMIN);
  if (currentAdmin) {
    try {
      const parsedCurrent: AdminUser = JSON.parse(currentAdmin);
      const adminsRaw = localStorage.getItem(STORAGE_KEYS.ADMINS);
      const adminsList: AdminUser[] = adminsRaw ? JSON.parse(adminsRaw) : [];
      const activeUser = adminsList.find((a) => a.id === parsedCurrent.id && a.status === 'ACTIVE');
      if (!activeUser) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_ADMIN);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ADMIN);
    }
  }

  if (!localStorage.getItem(STORAGE_KEYS.REGISTRATIONS)) {
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CHECK_INS)) {
    localStorage.setItem(STORAGE_KEYS.CHECK_INS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SEQ_COUNTER)) {
    localStorage.setItem(STORAGE_KEYS.SEQ_COUNTER, '0');
  }
};

// Generic read/write
export const getLocalCollection = <T>(key: string): T[] => {
  try {
    initLocalStorage();
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return [];
  }
};

export const setLocalCollection = <T>(key: string, data: T[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    notifySubscribers();
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
};

// Transactional Sequence Increment for SD2026-000001
export const getNextRegistrationCode = (year: string = '2026'): string => {
  initLocalStorage();
  const currentSeq = parseInt(localStorage.getItem(STORAGE_KEYS.SEQ_COUNTER) || '0', 10);
  const nextSeq = currentSeq + 1;
  localStorage.setItem(STORAGE_KEYS.SEQ_COUNTER, nextSeq.toString());
  const padded = nextSeq.toString().padStart(6, '0');
  return `SD${year}-${padded}`;
};

export const resetToInitialDemoData = (): void => {
  if (typeof window === 'undefined') return;

  // STRICT REQUIREMENT: คงชื่อทีม และ ทีมย่อยไว้ ห้ามลบเด็ดขาด (Preserve existing teams and sub-teams)
  const existingTeamsStr = localStorage.getItem(STORAGE_KEYS.TEAMS);
  if (!existingTeamsStr) {
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(defaultTeams));
  } else {
    try {
      const parsedTeams = JSON.parse(existingTeamsStr);
      if (!Array.isArray(parsedTeams) || parsedTeams.length === 0) {
        localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(defaultTeams));
      }
      // Existing teams are preserved intact - NEVER DELETED
    } catch {
      localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(defaultTeams));
    }
  }

  const existingSubTeamsStr = localStorage.getItem(STORAGE_KEYS.SUB_TEAMS);
  if (!existingSubTeamsStr) {
    localStorage.setItem(STORAGE_KEYS.SUB_TEAMS, JSON.stringify(defaultSubTeams));
  } else {
    try {
      const parsedSubTeams = JSON.parse(existingSubTeamsStr);
      if (!Array.isArray(parsedSubTeams) || parsedSubTeams.length === 0) {
        localStorage.setItem(STORAGE_KEYS.SUB_TEAMS, JSON.stringify(defaultSubTeams));
      }
      // Existing sub-teams are preserved intact - NEVER DELETED
    } catch {
      localStorage.setItem(STORAGE_KEYS.SUB_TEAMS, JSON.stringify(defaultSubTeams));
    }
  }

  // Preserve events if exist
  if (!localStorage.getItem(STORAGE_KEYS.EVENTS)) {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([defaultEvent]));
  }

  // Preserve existing admins while ensuring master superadmin exists
  const existingAdminsStr = localStorage.getItem(STORAGE_KEYS.ADMINS);
  if (!existingAdminsStr) {
    localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(defaultAdmins));
  } else {
    try {
      const parsedAdmins = JSON.parse(existingAdminsStr);
      if (!Array.isArray(parsedAdmins) || parsedAdmins.length === 0) {
        localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(defaultAdmins));
      } else {
        const masterIdx = parsedAdmins.findIndex(
          (a) => a.email.toLowerCase() === 'superadmin@sportsday.com'
        );
        if (masterIdx === -1) {
          parsedAdmins.unshift(defaultAdmins[0]);
        } else {
          parsedAdmins[masterIdx].role = 'SUPER_ADMIN';
          parsedAdmins[masterIdx].status = 'ACTIVE';
        }
        localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(parsedAdmins));
      }
    } catch {
      localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(defaultAdmins));
    }
  }

  // Reset only user registrations, check-in scans, and counter
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CHECK_INS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SEQ_COUNTER, '0');
  notifySubscribers();
};

export { STORAGE_KEYS };
