import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { AdminUser, AdminRole, EntityStatus } from '../types';
import { auditService } from './auditService';
import { authService } from './authService';

export const adminService = {
  async getAllAdmins(): Promise<AdminUser[]> {
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('admin_profiles')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as AdminUser[];
        }
      }
    }

    return authService.getAllAdmins();
  },

  async createAdmin(
    data: {
      displayName: string;
      email: string;
      role: AdminRole;
      password?: string;
    },
    currentUser: AdminUser
  ): Promise<AdminUser> {
    if (currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('เฉพาะ Super Admin เท่านั้นที่สามารถเพิ่มผู้ดูแลระบบได้');
    }

    const trimmedEmail = data.email.trim().toLowerCase();
    if (!trimmedEmail) {
      throw new Error('กรุณาระบุอีเมลหรือชื่อผู้ใช้งาน');
    }

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        // Check duplicate
        const { data: existing } = await client
          .from('admin_profiles')
          .select('id')
          .eq('email', trimmedEmail)
          .maybeSingle();

        if (existing) {
          throw new Error('อีเมลหรือชื่อผู้ใช้งานนี้ถูกใช้งานในระบบแล้ว');
        }

        const newProfile = {
          display_name: data.displayName.trim(),
          email: trimmedEmail,
          role: data.role,
          status: 'ACTIVE',
          password_hash: data.password?.trim() || 'admin123456',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: inserted, error } = await client
          .from('admin_profiles')
          .insert(newProfile)
          .select()
          .maybeSingle();

        if (error || !inserted) {
          throw new Error(`ไม่สามารถเพิ่มผู้ดูแลระบบในฐานข้อมูลได้: ${error?.message}`);
        }

        await auditService.log({
          userId: currentUser.id,
          userName: currentUser.display_name,
          action: 'CREATE_ADMIN_PROFILE',
          entityType: 'ADMIN_PROFILE',
          entityId: inserted.id,
          newData: { email: trimmedEmail, role: data.role },
        });

        return inserted as AdminUser;
      }
    }

    return authService.createAdmin(data, currentUser);
  },

  async updateAdmin(
    adminId: string,
    data: {
      displayName?: string;
      role?: AdminRole;
      status?: EntityStatus;
    },
    currentUser: AdminUser
  ): Promise<AdminUser> {
    if (currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('เฉพาะ Super Admin เท่านั้นที่สามารถแก้ไขผู้ดูแลระบบได้');
    }

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (data.displayName !== undefined) updatePayload.display_name = data.displayName.trim();
        if (data.role !== undefined) updatePayload.role = data.role;
        if (data.status !== undefined) updatePayload.status = data.status;

        const { data: updated, error } = await client
          .from('admin_profiles')
          .update(updatePayload)
          .eq('id', adminId)
          .select()
          .maybeSingle();

        if (error || !updated) {
          throw new Error(`อัปเดตข้อมูลผู้ดูแลระบบล้มเหลว: ${error?.message}`);
        }

        await auditService.log({
          userId: currentUser.id,
          userName: currentUser.display_name,
          action: 'UPDATE_ADMIN_PROFILE',
          entityType: 'ADMIN_PROFILE',
          entityId: adminId,
          newData: data,
        });

        return updated as AdminUser;
      }
    }

    return authService.updateAdmin(adminId, {
      display_name: data.displayName,
      role: data.role,
      status: data.status,
    }, currentUser);
  },

  async resetPassword(
    adminId: string,
    newPassword: string,
    currentUser: AdminUser
  ): Promise<{ success: boolean }> {
    if (currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('เฉพาะ Super Admin เท่านั้นที่สามารถรีเซ็ตรหัสผ่านได้');
    }

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { error } = await client
          .from('admin_profiles')
          .update({
            password_hash: newPassword.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', adminId);

        if (error) {
          throw new Error(`รีเซ็ตรหัสผ่านล้มเหลว: ${error.message}`);
        }

        await auditService.log({
          userId: currentUser.id,
          userName: currentUser.display_name,
          action: 'RESET_ADMIN_PASSWORD',
          entityType: 'ADMIN_PROFILE',
          entityId: adminId,
        });

        return { success: true };
      }
    }

    return authService.resetPassword(adminId, newPassword, currentUser);
  },

  async deleteAdmin(adminId: string, currentUser: AdminUser): Promise<{ success: boolean }> {
    if (currentUser.role !== 'SUPER_ADMIN') {
      throw new Error('เฉพาะ Super Admin เท่านั้นที่สามารถลบผู้ดูแลระบบได้');
    }

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { error } = await client
          .from('admin_profiles')
          .delete()
          .eq('id', adminId);

        if (error) {
          throw new Error(`ลบผู้ดูแลระบบล้มเหลว: ${error.message}`);
        }

        await auditService.log({
          userId: currentUser.id,
          userName: currentUser.display_name,
          action: 'DELETE_ADMIN_PROFILE',
          entityType: 'ADMIN_PROFILE',
          entityId: adminId,
        });

        return { success: true };
      }
    }

    return authService.deleteUser(adminId, currentUser);
  },
};
