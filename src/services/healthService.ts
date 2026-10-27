import {
  getSupabase,
  isSupabaseConfigured,
  getSupabaseUrl,
  SUPABASE_STORAGE_KEYS,
} from '../lib/supabase';

export interface HealthCheckResult {
  isConfigured: boolean;
  databaseConnected: boolean;
  authConnected: boolean;
  realtimeConnected: boolean;
  latencyMs?: number;
  supabaseUrl?: string;
  errorMessage?: string | null;
  message: string;
  tablesStatus: {
    events: boolean;
    teams: boolean;
    sub_teams: boolean;
    registrations: boolean;
    check_ins: boolean;
  };
  checkedAt: string;
}

type HealthListener = (health: HealthCheckResult) => void;
const healthListeners = new Set<HealthListener>();
let cachedHealthResult: HealthCheckResult | null = null;

export const healthService = {
  /**
   * Get the most recent health check result from cache or persistent localStorage
   */
  getLastHealth(): HealthCheckResult | null {
    if (cachedHealthResult) {
      return cachedHealthResult;
    }
    try {
      const stored = localStorage.getItem(SUPABASE_STORAGE_KEYS.LAST_HEALTH);
      if (stored) {
        cachedHealthResult = JSON.parse(stored);
        return cachedHealthResult;
      }
    } catch {
      // ignore
    }
    return null;
  },

  /**
   * Subscribe to live health check updates
   */
  subscribeToHealth(callback: HealthListener): () => void {
    healthListeners.add(callback);
    return () => {
      healthListeners.delete(callback);
    };
  },

  /**
   * Execute real-time connection diagnostic test across Database, Auth, Realtime, and Tables
   */
  async checkConnection(): Promise<HealthCheckResult> {
    const isConfigured = isSupabaseConfigured();
    const url = getSupabaseUrl();

    const result: HealthCheckResult = {
      isConfigured,
      databaseConnected: false,
      authConnected: false,
      realtimeConnected: false,
      supabaseUrl: url || undefined,
      errorMessage: null,
      message: '',
      tablesStatus: {
        events: false,
        teams: false,
        sub_teams: false,
        registrations: false,
        check_ins: false,
      },
      checkedAt: new Date().toISOString(),
    };

    if (!isConfigured) {
      result.errorMessage = 'Supabase ยังไม่ได้กำหนดค่า (กรุณาระบุ Supabase URL และ Anon Key)';
      result.message = 'ยังไม่ได้เชื่อมต่อ Supabase (ระบบทำงานในโหมด Local Storage ออฟไลน์)';
      this._saveAndNotify(result);
      return result;
    }

    const client = getSupabase();
    if (!client) {
      result.errorMessage = 'ไม่สามารถสร้าง Supabase Client ได้';
      result.message = 'การเชื่อมต่อขัดข้อง: ไม่สามารถสร้าง client instance ได้';
      this._saveAndNotify(result);
      return result;
    }

    const startTime = performance.now();

    try {
      // 1. Verify Authentication service
      try {
        const { error: authError } = await client.auth.getSession();
        result.authConnected = !authError;
        if (authError && authError.message?.includes('Invalid API key')) {
          result.errorMessage =
            'คีย์ Anon Key ไม่ถูกต้อง: กรุณาใช้ Anon Public Key (ขึ้นต้นด้วย eyJ...) จาก Supabase Dashboard > Settings > API';
        }
      } catch (err: any) {
        result.authConnected = false;
        if (err?.message?.includes('Invalid API key') || err?.message?.includes('UNAUTHORIZED')) {
          result.errorMessage =
            'คีย์ Anon Key ไม่ถูกต้อง: กรุณาใช้ Anon Public Key (ขึ้นต้นด้วย eyJ...) จาก Supabase Dashboard > Settings > API';
        }
      }

      // 2. Verify Realtime connection capability
      result.realtimeConnected = Boolean(client.realtime);

      // 3. Verify Database queries for tables
      const [eventsRes, teamsRes, subTeamsRes, regsRes, checkInsRes] = await Promise.allSettled([
        client.from('events').select('id').limit(1),
        client.from('teams').select('id').limit(1),
        client.from('sub_teams').select('id').limit(1),
        client.from('registrations').select('id').limit(1),
        client.from('check_ins').select('id').limit(1),
      ]);

      const endTime = performance.now();
      result.latencyMs = Math.round(endTime - startTime);

      let foundAnyTable = false;
      const tableErrors: string[] = [];

      if (eventsRes.status === 'fulfilled' && !eventsRes.value.error) {
        result.tablesStatus.events = true;
        foundAnyTable = true;
      } else if (eventsRes.status === 'fulfilled' && eventsRes.value.error) {
        tableErrors.push(`events: ${eventsRes.value.error.message}`);
      }

      if (teamsRes.status === 'fulfilled' && !teamsRes.value.error) {
        result.tablesStatus.teams = true;
        foundAnyTable = true;
      } else if (teamsRes.status === 'fulfilled' && teamsRes.value.error) {
        tableErrors.push(`teams: ${teamsRes.value.error.message}`);
      }

      if (subTeamsRes.status === 'fulfilled' && !subTeamsRes.value.error) {
        result.tablesStatus.sub_teams = true;
        foundAnyTable = true;
      } else if (subTeamsRes.status === 'fulfilled' && subTeamsRes.value.error) {
        tableErrors.push(`sub_teams: ${subTeamsRes.value.error.message}`);
      }

      if (regsRes.status === 'fulfilled' && !regsRes.value.error) {
        result.tablesStatus.registrations = true;
        foundAnyTable = true;
      } else if (regsRes.status === 'fulfilled' && regsRes.value.error) {
        tableErrors.push(`registrations: ${regsRes.value.error.message}`);
      }

      if (checkInsRes.status === 'fulfilled' && !checkInsRes.value.error) {
        result.tablesStatus.check_ins = true;
        foundAnyTable = true;
      } else if (checkInsRes.status === 'fulfilled' && checkInsRes.value.error) {
        tableErrors.push(`check_ins: ${checkInsRes.value.error.message}`);
      }

      const totalTablesOk = Object.values(result.tablesStatus).filter(Boolean).length;

      // Handle specific known error scenarios
      const hasKeyTypeError = tableErrors.some(
        (e) =>
          e.includes('UNAUTHORIZED_INVALID_API_KEY_TYPE') ||
          e.includes('Invalid API key') ||
          e.includes('JWT')
      );

      const isTableMissing = tableErrors.some(
        (e) =>
          e.includes('does not exist') ||
          e.includes('404') ||
          e.includes('relation')
      );

      if (hasKeyTypeError) {
        result.databaseConnected = false;
        result.errorMessage =
          'คีย์ Anon Key ไม่ถูกต้อง: กรุณาคัดลอก anon public key (JWT ที่ขึ้นต้นด้วย eyJ...) จาก Supabase Dashboard > Project Settings > API';
        result.message =
          'คีย์ไม่ถูกต้อง: โปรดใช้ anon public key ที่ขึ้นต้นด้วย eyJ... ไม่ใช่ publishable key';
      } else if (foundAnyTable || totalTablesOk === 5) {
        result.databaseConnected = true;
        if (totalTablesOk === 5) {
          result.message = 'เชื่อมต่อฐานข้อมูล Supabase สำเร็จ พร้อมใช้งานครบทุกตาราง (5/5)';
        } else {
          result.message = `เชื่อมต่อฐานข้อมูลสำเร็จ (${totalTablesOk}/5 ตาราง) บางตารางอาจต้องรันสคริปต์ migration`;
        }
      } else if (isTableMissing) {
        result.databaseConnected = false;
        result.errorMessage =
          'เชื่อมต่อ Supabase ได้แล้ว แต่ยังไม่พบตารางข้อมูล กรุณารัน SQL Migration (001_initial_schema.sql) ในแดชบอร์ด Supabase';
        result.message =
          'เชื่อมต่อสำเร็จแต่ยังไม่พบตารางข้อมูล กรุณารัน SQL migration ในแดชบอร์ด Supabase';
      } else if (tableErrors.length > 0) {
        result.databaseConnected = false;
        result.errorMessage = tableErrors[0];
        result.message = `เกิดข้อผิดพลาดในการเข้าถึงฐานข้อมูล: ${tableErrors[0]}`;
      } else {
        result.databaseConnected = false;
        result.errorMessage = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบ URL และ Anon Key';
        result.message = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
      }

      this._saveAndNotify(result);
      return result;
    } catch (err: any) {
      result.errorMessage = err?.message || 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
      result.message = result.errorMessage;
      this._saveAndNotify(result);
      return result;
    }
  },

  _saveAndNotify(result: HealthCheckResult) {
    cachedHealthResult = result;
    try {
      localStorage.setItem(SUPABASE_STORAGE_KEYS.LAST_HEALTH, JSON.stringify(result));
    } catch {
      // ignore
    }
    healthListeners.forEach((fn) => {
      try {
        fn(result);
      } catch (err) {
        console.error('Health listener error:', err);
      }
    });
  },
};
