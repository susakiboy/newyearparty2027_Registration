import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { AdminUser } from '../types';
import { auditService } from './auditService';

export interface SystemSettingItem {
  key: string;
  value: any;
  description?: string;
  updated_by?: string;
  updated_at?: string;
}

export const settingsService = {
  async getAllSettings(): Promise<Record<string, any>> {
    if (!isSupabaseConfigured()) {
      return {};
    }
    const client = getSupabase();
    if (!client) return {};

    const { data, error } = await client.from('system_settings').select('*');
    if (error || !data) return {};

    const result: Record<string, any> = {};
    data.forEach((row: SystemSettingItem) => {
      result[row.key] = row.value;
    });
    return result;
  },

  async getSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
    if (!isSupabaseConfigured()) {
      return defaultValue as T;
    }
    const client = getSupabase();
    if (!client) return defaultValue as T;

    const { data, error } = await client
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data) return defaultValue as T;
    return data.value as T;
  },

  async updateSetting(
    key: string,
    value: any,
    description?: string,
    currentUser?: AdminUser
  ): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }
    const client = getSupabase();
    if (!client) {
      throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }

    const payload = {
      key,
      value,
      description: description || null,
      updated_by: currentUser?.display_name || 'Admin',
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await client
        .from('system_settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) {
        if (error.code === '42501' || error.message?.includes('violates row-level security')) {
          console.warn('Supabase RLS restricted upsert on system_settings. Saved locally.', error);
          localStorage.setItem(`sd_setting_${key}`, JSON.stringify(value));
        } else {
          throw new Error(`บันทึกการตั้งค่าล้มเหลว: ${error.message}`);
        }
      }
    } catch (supabaseErr: any) {
      if (supabaseErr?.code === '42501' || supabaseErr?.message?.includes('violates row-level security')) {
        console.warn('Supabase RLS error caught in updateSetting, saved locally:', supabaseErr);
        localStorage.setItem(`sd_setting_${key}`, JSON.stringify(value));
      } else {
        throw supabaseErr;
      }
    }

    if (currentUser) {
      await auditService.log({
        userId: currentUser.id,
        userName: currentUser.display_name,
        action: 'UPDATE_SYSTEM_SETTING',
        entityType: 'SETTING',
        entityId: key,
        newData: { key, value },
      });
    }

    return true;
  },
};
