import { AuditLog } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalCollection, setLocalCollection, STORAGE_KEYS } from './storage';

export const auditService = {
  async log(params: {
    userId: string;
    userName?: string;
    action: string;
    entityType: string;
    entityId: string;
    oldData?: Record<string, any> | null;
    newData?: Record<string, any> | null;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const logEntry: AuditLog = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        user_id: params.userId,
        user_name: params.userName || 'System User',
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        old_data: params.oldData || null,
        new_data: params.newData || null,
        ip_address_if_available: params.ipAddress || '127.0.0.1',
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const client = getSupabase();
        if (client) {
          await client.from('audit_logs').insert([logEntry]);
        }
      } else {
        const logs = getLocalCollection<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
        logs.unshift(logEntry); // Keep latest at top
        setLocalCollection(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 1000)); // Cap to 1000 in local
      }
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  },

  async getLogs(limit: number = 100): Promise<AuditLog[]> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      }
    }

    const logs = getLocalCollection<AuditLog>(STORAGE_KEYS.AUDIT_LOGS);
    return logs.slice(0, limit);
  },
};
