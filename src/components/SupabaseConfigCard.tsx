import React, { useState, useEffect } from 'react';
import {
  Database,
  Radio,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Save,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  setSupabaseCredentials,
  clearSupabaseCredentials,
  resetToDefaultSupabase,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  isSupabaseConfigured,
  getStoredConfig,
} from '../lib/supabase';
import { healthService, HealthCheckResult } from '../services/healthService';

interface SupabaseConfigCardProps {
  onShowToast?: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
  onConnectionTested?: (health: HealthCheckResult) => void;
  compact?: boolean;
}

export const SupabaseConfigCard: React.FC<SupabaseConfigCardProps> = ({
  onShowToast,
  onConnectionTested,
  compact = false,
}) => {
  const [url, setUrl] = useState<string>(getSupabaseUrl() || '');
  const [anonKey, setAnonKey] = useState<string>(getSupabaseAnonKey() || '');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [health, setHealth] = useState<HealthCheckResult | null>(healthService.getLastHealth());
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedMigration, setCopiedMigration] = useState<string | null>(null);

  // Subscribe to health updates
  useEffect(() => {
    const unsub = healthService.subscribeToHealth((newHealth) => {
      setHealth(newHealth);
    });
    return unsub;
  }, []);

  const handleTestConnection = async (customUrl?: string, customKey?: string) => {
    setIsTesting(true);
    try {
      // If temporary values passed or fields differ from saved, temporarily set credentials
      const targetUrl = customUrl !== undefined ? customUrl : url;
      const targetKey = customKey !== undefined ? customKey : anonKey;

      if (targetUrl.trim() || targetKey.trim()) {
        setSupabaseCredentials(targetUrl, targetKey);
      }

      const res = await healthService.checkConnection();
      setHealth(res);
      if (onConnectionTested) {
        onConnectionTested(res);
      }

      if (res.databaseConnected && res.authConnected) {
        onShowToast?.('success', `เชื่อมต่อ Supabase สำเร็จ! (ความเร็ว ${res.latencyMs || 0} ms)`);
      } else if (res.isConfigured) {
        onShowToast?.('warning', res.message || 'การเชื่อมต่อขัดข้อง');
      } else {
        onShowToast?.('info', 'ระบบอยู่ในโหมด Local Storage ออฟไลน์');
      }
    } catch (err: any) {
      onShowToast?.('error', err.message || 'เกิดข้อผิดพลาดในการทดสอบ');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl && !cleanKey) {
      clearSupabaseCredentials();
      onShowToast?.('info', 'ล้างค่าการเชื่อมต่อเรียบร้อยแล้ว (ทำงานในโหมด Local Storage)');
      handleTestConnection('', '');
      return;
    }

    if (cleanUrl && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://localhost')) {
      onShowToast?.('warning', 'Supabase URL ต้องขึ้นต้นด้วย https:// หรือ http://');
      return;
    }

    setIsSaving(true);
    try {
      setSupabaseCredentials(cleanUrl, cleanKey);
      onShowToast?.('success', 'บันทึกการตั้งค่า Supabase URL & Anon Key ถาวรเรียบร้อยแล้ว');
      await handleTestConnection(cleanUrl, cleanKey);
    } catch (err: any) {
      onShowToast?.('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setUrl(DEFAULT_SUPABASE_URL);
    setAnonKey(DEFAULT_SUPABASE_ANON_KEY);
    resetToDefaultSupabase();
    onShowToast?.('success', 'คืนค่าเริ่มต้นฐานข้อมูล Supabase (Cash Club Games 2026) สำเร็จ');
    await handleTestConnection(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
  };

  const handleClear = () => {
    if (window.confirm('คุณต้องการล้างการตั้งค่ากำหนดเองและคืนค่าเริ่มต้นของระบบหรือไม่?')) {
      handleResetToDefault();
    }
  };

  const handleCopy = (path: string, key: string) => {
    navigator.clipboard.writeText(path);
    setCopiedMigration(key);
    setTimeout(() => setCopiedMigration(null), 2000);
    onShowToast?.('info', `คัดลอกพาธ ${path} เรียบร้อยแล้ว`);
  };

  const isConfigured = isSupabaseConfigured();
  const dbConnected = Boolean(health?.databaseConnected);
  const authConnected = Boolean(health?.authConnected);
  const realtimeConnected = Boolean(health?.realtimeConnected);

  const totalTablesOk = health
    ? Object.values(health.tablesStatus).filter(Boolean).length
    : 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-2xl ${
              dbConnected && authConnected
                ? 'bg-emerald-100/80 text-emerald-700'
                : isConfigured
                ? 'bg-amber-100/80 text-amber-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                ตั้งค่า Supabase URL & Anon Key (Cloud Database)
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  dbConnected && authConnected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : isConfigured
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    dbConnected && authConnected
                      ? 'bg-emerald-500 animate-pulse'
                      : isConfigured
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                {dbConnected && authConnected
                  ? 'เชื่อมต่อสมบูรณ์ (Cloud Connected)'
                  : isConfigured
                  ? 'รอการตรวจสอบ / มีข้อผิดพลาด'
                  : 'โหมดออฟไลน์ (Local Storage)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              บันทึกการตั้งค่าถาวรบนเบราว์เซอร์ พร้อมทดสอบการเชื่อมต่ออัตโนมัติทุกครั้งที่เปิดใช้งานระบบ
            </p>
          </div>
        </div>

        {/* Quick Test Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-supabase-test-connection"
            type="button"
            onClick={() => handleTestConnection()}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Supabase URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Supabase Project URL <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">VITE_SUPABASE_URL</span>
            </div>
            <input
              id="input-supabase-url"
              type="text"
              required={Boolean(anonKey.trim())}
              placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-2.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            <p className="text-[11px] text-slate-400">
              เช่น <code className="text-slate-600">https://mxtjyyzhpuzgmzjzzzss.supabase.co</code>
            </p>
          </div>

          {/* Anon Public Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Supabase Anon Key (Public) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">VITE_SUPABASE_ANON_KEY</span>
            </div>
            <div className="relative">
              <input
                id="input-supabase-anon-key"
                type={showPassword ? 'text' : 'password'}
                required={Boolean(url.trim())}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full p-2.5 pr-10 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showPassword ? 'ซ่อนคีย์' : 'แสดงคีย์'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>ใช้ Anon Public Key (ขึ้นต้นด้วย eyJ...) จาก Dashboard &gt; Project Settings &gt; API</span>
            </p>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>การตั้งค่าจะถูกบันทึกลงในเบราว์เซอร์อย่างถาวร (Persistent Local Storage)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-supabase-reset-default"
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="คืนค่าการเชื่อมต่อไปยังโครงการ Supabase หลัก (Cash Club Games 2026)"
            >
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>คืนค่าเริ่มต้นโครงการ</span>
            </button>

            {(url || anonKey) && (
              <button
                id="btn-supabase-clear-credentials"
                type="button"
                onClick={handleClear}
                className="px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ล้างค่า</span>
              </button>
            )}

            <button
              id="btn-supabase-save-permanent"
              type="submit"
              disabled={isSaving || isTesting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าถาวร'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Live Diagnostic Results Panel */}
      <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-100 text-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>ผลการตรวจสอบการเชื่อมต่อ (Diagnostic Results)</span>
          </div>
          {health?.checkedAt && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ตรวจล่าสุด {new Date(health.checkedAt).toLocaleTimeString('th-TH')}
              {health.latencyMs !== undefined && ` (${health.latencyMs} ms)`}
            </span>
          )}
        </div>

        {/* 3 Core Services Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Database */}
          <div
            className={`p-3.5 rounded-2xl border ${
              dbConnected
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/70 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-600" />
                ฐานข้อมูล (Database)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  dbConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {dbConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              {dbConnected
                ? `เข้าถึงตารางได้ ${totalTablesOk}/5 ตาราง`
                : 'ยังไม่สามารถเชื่อมต่อฐานข้อมูลได้'}
            </p>
          </div>

          {/* Auth */}
          <div
            className={`p-3.5 rounded-2xl border ${
              authConnected
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/70 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                ยืนยันตัวตน (Auth)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  authConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {authConnected ? 'Valid Key' : 'Invalid'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              {authConnected ? 'Session & Token ใช้งานได้' : 'คีย์ Anon Key ยังไม่ผ่านการรับรอง'}
            </p>
          </div>

          {/* Realtime */}
          <div
            className={`p-3.5 rounded-2xl border ${
              realtimeConnected
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-indigo-600" />
                เรียลไทม์ (Realtime)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  realtimeConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {realtimeConnected ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              {realtimeConnected ? 'พร้อมรับการอัปเดต Check-in สด' : 'ปิดการทำงานชั่วคราว'}
            </p>
          </div>
        </div>

        {/* Tables Status Breakdown */}
        {health?.isConfigured && (
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
            <span className="font-bold text-slate-700 block">
              สถานะตารางข้อมูลในโปรเจกต์ Supabase ({totalTablesOk}/5 ตารางพร้อมใช้งาน):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono text-[11px]">
              {(['events', 'teams', 'sub_teams', 'registrations', 'check_ins'] as const).map(
                (table) => {
                  const isOk = health.tablesStatus[table];
                  return (
                    <div
                      key={table}
                      className={`p-2 rounded-xl border flex items-center justify-between ${
                        isOk
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <span className="truncate">{table}</span>
                      {isOk ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Message Banner */}
        {health?.message && (
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
              dbConnected
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                : isConfigured
                ? 'bg-amber-50/80 border-amber-200 text-amber-800'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {dbConnected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold">{health.message}</p>
              {health.errorMessage && health.errorMessage !== health.message && (
                <p className="text-[11px] mt-1 text-slate-600 font-mono">{health.errorMessage}</p>
              )}
            </div>
          </div>
        )}

        {/* Migration Helper */}
        {health?.isConfigured && !dbConnected && (
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-indigo-950 space-y-2">
            <span className="font-bold text-xs flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600" />
              หากยังไม่ได้สร้างตารางข้อมูลใน Supabase:
            </span>
            <p className="text-[11px] text-slate-600">
              คุณสามารถคัดลอกไฟล์ SQL Migration แล้วนำไปรันในเมนู <strong>SQL Editor</strong> บนแดชบอร์ด Supabase ได้ทันที:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleCopy('/supabase/migrations/001_initial_schema.sql', '001')}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-mono flex items-center gap-1.5"
              >
                {copiedMigration === '001' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>001_initial_schema.sql</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopy('/supabase/migrations/002_admin_crud_and_rls_fix.sql', '002')}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-mono flex items-center gap-1.5"
              >
                {copiedMigration === '002' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>002_admin_crud_and_rls_fix.sql</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
