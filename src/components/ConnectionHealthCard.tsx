import React, { useState } from 'react';
import {
  Database,
  Radio,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Server,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import { HealthCheckResult } from '../services/healthService';
import { getSupabaseUrl, setSupabaseCredentials, getSupabaseAnonKey } from '../lib/supabase';

interface ConnectionHealthCardProps {
  health: HealthCheckResult | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const ConnectionHealthCard: React.FC<ConnectionHealthCardProps> = ({
  health,
  isLoading,
  onRefresh,
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customUrl, setCustomUrl] = useState(getSupabaseUrl() || '');
  const [customKey, setCustomKey] = useState(getSupabaseAnonKey() || '');
  const [configSaved, setConfigSaved] = useState(false);

  React.useEffect(() => {
    if (showConfigModal) {
      setCustomUrl(getSupabaseUrl() || '');
      setCustomKey(getSupabaseAnonKey() || '');
    }
  }, [showConfigModal]);

  const handleCopy = (text: string, type: 'migration' | 'seed') => {
    navigator.clipboard.writeText(text);
    if (type === 'migration') {
      setCopiedMigration(true);
      setTimeout(() => setCopiedMigration(false), 2000);
    } else {
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseCredentials(customUrl, customKey);
    setConfigSaved(true);
    setTimeout(() => {
      setConfigSaved(false);
      setShowConfigModal(false);
      onRefresh();
    }, 800);
  };

  const dbStatusOk = Boolean(health?.databaseConnected);
  const authStatusOk = Boolean(health?.authConnected);
  const realtimeStatusOk = Boolean(health?.realtimeConnected);

  const tablesOkCount = health
    ? Object.values(health.tablesStatus).filter(Boolean).length
    : 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-2xl ${
              dbStatusOk && authStatusOk && realtimeStatusOk
                ? 'bg-emerald-50 text-emerald-600'
                : dbStatusOk
                ? 'bg-amber-50 text-amber-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                สถานะการเชื่อมต่อระบบคลาวด์ (System Connection Health)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {health?.checkedAt
                  ? `ตรวจล่าสุด ${new Date(health.checkedAt).toLocaleTimeString('th-TH')}`
                  : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {health?.message || 'กำลังตรวจสอบสถานะการเชื่อมต่อ...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            id="btn-health-config-toggle"
            type="button"
            onClick={() => setShowConfigModal(!showConfigModal)}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
          >
            กำหนดค่า Supabase
          </button>

          <button
            id="btn-health-refresh"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
          </button>
        </div>
      </div>

      {/* Direct Configuration Form Modal / Collapse */}
      {showConfigModal && (
        <form
          onSubmit={handleSaveCredentials}
          className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3"
        >
          <div className="font-bold text-slate-800 flex items-center justify-between">
            <span>ตั้งค่า Supabase URL & Anon Key สำหรับทดสอบบนเบราว์เซอร์</span>
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ปิด
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Supabase URL (VITE_SUPABASE_URL)
              </label>
              <input
                type="text"
                placeholder="https://your-project.supabase.co"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Anon Key (VITE_SUPABASE_ANON_KEY)
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOi..."
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              * ข้อมูลจะถูกบันทึกในเบราว์เซอร์และใช้เชื่อมต่อกับ Supabase ทันที
            </span>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
            >
              {configSaved ? 'บันทึกเรียบร้อย!' : 'บันทึกและทดสอบใหม่'}
            </button>
          </div>
        </form>
      )}

      {/* 3 Main Connection Indicators Grid (Database, Authentication, Realtime) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
        {/* 1. Database Connection */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            dbStatusOk
              ? 'bg-emerald-50/40 border-emerald-200/90'
              : 'bg-rose-50/40 border-rose-200/90'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database
                className={`w-4 h-4 ${dbStatusOk ? 'text-emerald-600' : 'text-rose-600'}`}
              />
              <span className="text-xs font-bold text-slate-800">ฐานข้อมูล Database</span>
            </div>
            {/* Colored Status Indicator Dot */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  dbStatusOk
                    ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                    : 'bg-rose-500 shadow-xs shadow-rose-500/50'
                }`}
              />
              <span
                className={`text-[11px] font-bold ${
                  dbStatusOk ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {dbStatusOk ? 'Connected' : 'Error'}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Service:</span>
              <span className="font-semibold text-slate-700">PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Table Readiness:</span>
              <span
                className={`font-semibold font-mono ${
                  tablesOkCount === 5
                    ? 'text-emerald-700'
                    : tablesOkCount > 0
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {tablesOkCount}/5 ตาราง
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Latency:</span>
              <span className="font-mono text-slate-600">
                {health?.latencyMs !== undefined ? `${health.latencyMs} ms` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Authentication Connection */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            authStatusOk
              ? 'bg-emerald-50/40 border-emerald-200/90'
              : 'bg-rose-50/40 border-rose-200/90'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`w-4 h-4 ${authStatusOk ? 'text-emerald-600' : 'text-rose-600'}`}
              />
              <span className="text-xs font-bold text-slate-800">ระบบยืนยันตัวตน Auth</span>
            </div>
            {/* Colored Status Indicator Dot */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  authStatusOk
                    ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                    : 'bg-rose-500 shadow-xs shadow-rose-500/50'
                }`}
              />
              <span
                className={`text-[11px] font-bold ${
                  authStatusOk ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {authStatusOk ? 'Connected' : 'Error'}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Provider:</span>
              <span className="font-semibold text-slate-700">Supabase Auth</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Session Check:</span>
              <span
                className={`font-semibold ${
                  authStatusOk ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {authStatusOk ? 'Verified' : 'Unreachable'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Security Rules:</span>
              <span className="font-semibold text-slate-600">Row Level Security</span>
            </div>
          </div>
        </div>

        {/* 3. Realtime Connection */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            realtimeStatusOk
              ? 'bg-emerald-50/40 border-emerald-200/90'
              : 'bg-rose-50/40 border-rose-200/90'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radio
                className={`w-4 h-4 ${
                  realtimeStatusOk ? 'text-emerald-600 animate-pulse' : 'text-rose-600'
                }`}
              />
              <span className="text-xs font-bold text-slate-800">อัปเดตสด Realtime</span>
            </div>
            {/* Colored Status Indicator Dot */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  realtimeStatusOk
                    ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse'
                    : 'bg-rose-500 shadow-xs shadow-rose-500/50'
                }`}
              />
              <span
                className={`text-[11px] font-bold ${
                  realtimeStatusOk ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {realtimeStatusOk ? 'Connected' : 'Error'}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Protocol:</span>
              <span className="font-semibold text-slate-700">WebSocket</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Channels:</span>
              <span className="font-semibold text-slate-600">registrations, check_ins</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Live Sync:</span>
              <span
                className={`font-semibold ${
                  realtimeStatusOk ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {realtimeStatusOk ? 'Active Broadcast' : 'Standby'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Details & Setup Instructions */}
      <div className="mt-3.5 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setIsDetailsOpen(!isDetailsOpen)}
          className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 font-medium py-1 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>
              {isDetailsOpen
                ? 'ซ่อนรายละเอียดตารางและคำแนะนำการติดตั้ง'
                : 'ดูรายละเอียดสถานะตารางข้อมูล (5 ตาราง) และคู่มือ SQL Migration'}
            </span>
          </span>
          {isDetailsOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isDetailsOpen && (
          <div className="mt-3 space-y-3 text-xs">
            {/* Table status pills */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-2">
                สถานะตารางข้อมูลหลัก (Core Schema Tables):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { key: 'events', label: 'events' },
                  { key: 'teams', label: 'teams' },
                  { key: 'sub_teams', label: 'sub_teams' },
                  { key: 'registrations', label: 'registrations' },
                  { key: 'check_ins', label: 'check_ins' },
                ].map((t) => {
                  const isOk = health?.tablesStatus
                    ? health.tablesStatus[t.key as keyof typeof health.tablesStatus]
                    : false;
                  return (
                    <div
                      key={t.key}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                        isOk
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                    >
                      <span className="font-mono font-semibold text-[11px]">{t.label}</span>
                      {isOk ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instruction banner for Supabase setup */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="font-bold text-xs text-amber-900">
                    คำแนะนำสำหรับการเชื่อมต่อและสร้างตารางใน Supabase:
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    กรุณาตรวจสอบว่าได้ระบุค่า{' '}
                    <code className="bg-amber-100 text-amber-950 font-mono px-1 py-0.5 rounded font-bold">
                      VITE_SUPABASE_URL
                    </code>{' '}
                    และ{' '}
                    <code className="bg-amber-100 text-amber-950 font-mono px-1 py-0.5 rounded font-bold">
                      VITE_SUPABASE_ANON_KEY
                    </code>{' '}
                    เรียบร้อยแล้ว และได้เรียกใช้งานสคริปต์สร้างตารางใน{' '}
                    <code className="bg-amber-100 text-amber-950 font-mono px-1 py-0.5 rounded font-bold">
                      /supabase/migrations/001_initial_schema.sql
                    </code>{' '}
                    และ{' '}
                    <code className="bg-amber-100 text-amber-950 font-mono px-1 py-0.5 rounded font-bold">
                      /supabase/seed.sql
                    </code>{' '}
                    บนแดชบอร์ดของ Supabase
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          '/supabase/migrations/001_initial_schema.sql',
                          'migration'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-300 font-mono text-[11px] transition-colors"
                    >
                      {copiedMigration ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-amber-700" />
                      )}
                      <span>คัดลอกไฟล์ Schema SQL</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy('/supabase/seed.sql', 'seed')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-300 font-mono text-[11px] transition-colors"
                    >
                      {copiedSeed ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-amber-700" />
                      )}
                      <span>คัดลอกไฟล์ Seed SQL</span>
                    </button>

                    {health?.supabaseUrl && (
                      <a
                        href={health.supabaseUrl.replace('.supabase.co', '.supabase.com')}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-700 hover:text-indigo-900 font-bold ml-auto"
                      >
                        <span>เปิด Supabase Dashboard</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
