import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  X,
  Lock,
} from 'lucide-react';
import { AdminUser, AdminRole } from '../types';
import { authService } from '../services/authService';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface AdminUsersPageProps {
  currentUser: AdminUser;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({
  currentUser,
  onShowToast,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('ADMIN');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const data = await authService.getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load admin users:', err);
      onShowToast('error', 'ไม่สามารถโหลดรายชื่อเจ้าหน้าที่ได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim()) {
      onShowToast('warning', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      await authService.createUser(
        {
          email: email.trim(),
          display_name: displayName.trim(),
          role,
          password: password.trim() || 'admin123456',
        },
        currentUser
      );
      onShowToast('success', 'สร้างบัญชีผู้ดูแลระบบเรียบร้อยแล้ว');
      setIsCreateModalOpen(false);
      setEmail('');
      setDisplayName('');
      setPassword('');
      loadUsers();
    } catch (err: any) {
      onShowToast('error', err.message || 'ไม่สามารถสร้างผู้ใช้ได้');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await authService.updateUser(
        editingUser.id,
        {
          display_name: editingUser.display_name,
          role: editingUser.role,
          status: editingUser.status,
        },
        currentUser
      );
      onShowToast('success', 'แก้ไขข้อมูลเรียบร้อยแล้ว');
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      onShowToast('error', err.message || 'ไม่สามารถแก้ไขข้อมูลได้');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPassword.trim()) return;

    try {
      await authService.resetPassword(resettingUser.id, newPassword.trim(), currentUser);
      onShowToast('success', `รีเซ็ตรหัสผ่านสำหรับ ${resettingUser.display_name} สำเร็จ`);
      setResettingUser(null);
      setNewPassword('');
    } catch (err: any) {
      onShowToast('error', err.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    try {
      const res = await authService.deleteUser(deletingUser.id, currentUser);
      onShowToast('success', res.message);
      setDeletingUser(null);
      loadUsers();
    } catch (err: any) {
      onShowToast('error', err.message || 'ไม่สามารถลบผู้ใช้ได้');
    }
  };

  const getRoleBadge = (r: AdminRole) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">SUPER ADMIN</span>;
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">ADMIN</span>;
      case 'CHECKIN_STAFF':
        return <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">CHECK-IN STAFF</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            ผู้ดูแลระบบและสิทธิ์การใช้งาน (Admin Users)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            จัดการบัญชีผู้ใช้งาน สิทธิ์การเข้าถึง และการรีเซ็ตรหัสผ่าน (เฉพาะ Super Admin)
          </p>
        </div>

        <button
          id="btn-add-admin-user"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มผู้ดูแลระบบใหม่</span>
        </button>
      </div>

      {/* Master Admin Security Card */}
      <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-900/50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">ผู้ดูแลระบบหลักที่ได้รับสิทธิ์ (Authorized Master Administrator)</h3>
              <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-[10px] font-bold rounded-md border border-amber-400/30">
                SUPER_ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Username หลัก: <span className="font-mono text-indigo-200 font-semibold">superadmin@sportsday.com</span> • Super Admin มีสิทธิ์เพิ่มผู้ดูแลระบบใหม่และกำหนดสิทธิ์ได้ทันที
            </p>
          </div>
        </div>
        <div className="text-xs text-indigo-200 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
          Super Admin สามารถเพิ่มและจัดการผู้ดูแลระบบได้
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">อีเมล (Email)</th>
                <th className="py-3 px-4 text-center">บทบาท (Role)</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {user.display_name}
                    {user.id === currentUser.id && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-500 text-[10px]">
                        คุณ (You)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{user.email}</td>
                  <td className="py-3.5 px-4 text-center">{getRoleBadge(user.role)}</td>
                  <td className="py-3.5 px-4 text-center">
                    {user.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> เปิดใช้งาน
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                        <XCircle className="w-3 h-3" /> ปิดใช้งาน
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user.email.toLowerCase() === 'superadmin@sportsday.com' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          <Lock className="w-3 h-3" /> ผู้ดูแลระบบหลัก (Protected)
                        </span>
                      ) : (
                        <>
                          <button
                            id={`btn-reset-pw-${user.id}`}
                            onClick={() => setResettingUser(user)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="รีเซ็ตรหัสผ่าน"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-edit-user-${user.id}`}
                            onClick={() => setEditingUser(user)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="แก้ไขสิทธิ์"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user.id !== currentUser.id && (
                            <button
                              id={`btn-delete-user-${user.id}`}
                              onClick={() => setDeletingUser(user)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="ลบผู้ใช้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-4">เพิ่มผู้ดูแลระบบใหม่</h3>
            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น นิติภูมิ ใจดี"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">อีเมล</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@sportsday.com"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">บทบาท (Role)</label>
                <select
                  value={role}
                  onChange={(e: any) => setRole(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="CHECKIN_STAFF">CHECKIN_STAFF (สแกน Check-in หน้างาน)</option>
                  <option value="ADMIN">ADMIN (จัดการทีม & ผู้ลงทะเบียน & นำเข้า Excel)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (จัดการระบบทั้งหมด)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  รหัสผ่านเริ่มต้น
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="หากเว้นว่างจะใช้: admin123456"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                >
                  สร้างผู้ใช้
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-4">
              แก้ไขข้อมูลผู้ใช้ ({editingUser.email})
            </h3>
            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  required
                  value={editingUser.display_name}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, display_name: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">บทบาท (Role)</label>
                <select
                  value={editingUser.role}
                  onChange={(e: any) =>
                    setEditingUser({ ...editingUser, role: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="CHECKIN_STAFF">CHECKIN_STAFF (สแกน Check-in หน้างาน)</option>
                  <option value="ADMIN">ADMIN (จัดการทีม & ผู้ลงทะเบียน & นำเข้า Excel)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (จัดการระบบทั้งหมด)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">สถานะการใช้งาน</label>
                <select
                  value={editingUser.status}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, status: e.target.value as any })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="ACTIVE">เปิดใช้งาน (Active)</option>
                  <option value="INACTIVE">ปิดใช้งาน (Inactive)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setResettingUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-2">รีเซ็ตรหัสผ่าน</h3>
            <p className="text-xs text-slate-500 mb-4">
              กำหนดรหัสผ่านใหม่ให้กับ <strong>{resettingUser.display_name}</strong>
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  รหัสผ่านใหม่
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
                >
                  บันทึกรหัสผ่านใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deletingUser)}
        title="ยืนยันการลบผู้ดูแลระบบ"
        message={`คุณต้องการลบบัญชีผู้ใช้ "${deletingUser?.display_name}" (${deletingUser?.email}) ใช่หรือไม่?`}
        confirmText="ยืนยันการลบ"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  );
};
