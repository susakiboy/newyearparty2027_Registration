import React, { useState } from 'react';
import { Lock, Mail, ArrowLeft, Shield, LogIn, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/authService';
import { AdminUser } from '../types';

interface AdminLoginProps {
  onLoginSuccess: (user: AdminUser) => void;
  onBackToPublic: () => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onBackToPublic,
  onShowToast,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('กรุณากรอก Username หรืออีเมล');
      return;
    }

    if (!cleanPassword) {
      setErrorMessage('กรุณากรอกรหัสผ่าน');
      return;
    }

    try {
      setIsLoading(true);
      const user = await authService.login(cleanEmail, cleanPassword);
      onShowToast('success', `ยินดีต้อนรับ ${user.display_name} (${user.role})`);
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง';
      setErrorMessage(msg);
      onShowToast('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md">
        {/* Back link */}
        <button
          id="btn-back-to-public-reg"
          onClick={onBackToPublic}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับไปยังหน้าลงทะเบียนผู้เข้าร่วม</span>
        </button>

        {/* Login Box */}
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">ระบบจัดการสำหรับเจ้าหน้าที่</h2>
            <p className="text-xs text-slate-400 mt-1">NEW YEAR PARTY 2027 Admin Portal</p>
          </div>

          {errorMessage && (
            <div
              id="login-error-alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs mb-4 text-center font-medium"
            >
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Username (ชื่อผู้ใช้งานหรืออีเมล)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="input-login-email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="กรุณากรอกชื่อผู้ใช้งานหรืออีเมล"
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password (รหัสผ่าน)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  id="btn-toggle-show-password"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>กำลังเข้าสู่ระบบ...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ (Sign In)</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-500 text-center pt-2">
              * เข้าสู่ระบบสำหรับ Super Admin หรือผู้ดูแลระบบที่ได้รับอนุญาต
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
