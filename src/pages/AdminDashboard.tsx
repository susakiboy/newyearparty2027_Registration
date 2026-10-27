import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  Percent,
  RefreshCw,
  QrCode,
  ArrowUpRight,
  Database,
  Radio,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { DashboardStats, EventConfig } from '../types';
import { dashboardService } from '../services/dashboardService';
import { registrationService } from '../services/registrationService';
import { checkInService } from '../services/checkInService';
import { subscribeToChanges } from '../services/storage';
import { healthService, HealthCheckResult } from '../services/healthService';
import { TeamDonutChart, SubTeamBarChart, TrendChart, CheckInGauge } from '../components/Charts';
import { ConnectionHealthCard } from '../components/ConnectionHealthCard';

interface AdminDashboardProps {
  event: EventConfig;
  onNavigateToCheckIn: () => void;
  onNavigateToRegistrations: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  event,
  onNavigateToCheckIn,
  onNavigateToRegistrations,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trendMode, setTrendMode] = useState<'hourly' | 'daily'>('hourly');
  const [isLoading, setIsLoading] = useState(true);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const loadStats = async () => {
    try {
      const data = await dashboardService.getStats(event.id);
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const runHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      const result = await healthService.checkConnection();
      setHealth(result);
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    loadStats();
    runHealthCheck();

    // 1. Supabase Realtime Subscriptions (Prompt Requirement)
    const unsubRegs = registrationService.subscribeToRegistrations(() => {
      loadStats();
    });
    const unsubCheckIns = checkInService.subscribeToCheckIns(() => {
      loadStats();
    });

    // 2. Storage fallback subscription
    const unsubStorage = subscribeToChanges(() => {
      loadStats();
    });

    return () => {
      unsubRegs();
      unsubCheckIns();
      unsubStorage();
    };
  }, [event.id]);

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
        <span className="text-sm">กำลังโหลดข้อมูลแดชบอร์ด...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner with Quick Actions */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2">
            Realtime Dashboard
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            {event.name} {event.year} ภาพรวมกิจกรรม
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            ข้อมูลสถิติผู้เข้าร่วม การลงทะเบียน และอัตราการ Check-in หน้างานแบบเรียลไทม์
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="btn-dash-quick-checkin"
            onClick={onNavigateToCheckIn}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            <span>ไปที่หน้า Check-in</span>
          </button>
          <button
            id="btn-dash-refresh"
            onClick={() => {
              loadStats();
              runHealthCheck();
            }}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
            title="รีเฟรชข้อมูลและสถานะการเชื่อมต่อ"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingHealth ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Database, Auth & Realtime Connection Health Section */}
      <ConnectionHealthCard
        health={health}
        isLoading={isCheckingHealth}
        onRefresh={runHealthCheck}
      />

      {/* KPI Cards Grid (Prompt Section 17) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registrations */}
        <div
          onClick={onNavigateToRegistrations}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ลงทะเบียนทั้งหมด
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {stats.totalRegistrations}
            </span>
            <span className="text-xs text-slate-500 flex items-center">
              ดูรายชื่อ <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Today Registrations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ลงทะเบียนวันนี้
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {stats.todayRegistrations}
            </span>
            <span className="text-xs text-blue-600 font-medium font-mono">คน</span>
          </div>
        </div>

        {/* Total Checked In */}
        <div
          onClick={onNavigateToCheckIn}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Check-in แล้ว
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-600 font-mono">
              {stats.totalCheckedIn}
            </span>
            <span className="text-xs font-semibold text-emerald-600 font-mono">
              {stats.checkInPercentage}%
            </span>
          </div>
        </div>

        {/* Not Checked In */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ยังไม่ Check-in
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600 font-mono">
              {stats.notCheckedIn}
            </span>
            <span className="text-xs text-amber-600 font-medium font-mono">คน</span>
          </div>
        </div>
      </div>

      {/* Dynamic Team Cards Grid (Prompt Section 17 & 28) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            สถิติแยกตามสังกัดทีม (Dynamic Teams)
          </h3>
          <span className="text-xs text-slate-400">อัปเดตแบบไดนามิกจากฐานข้อมูล</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.teamsBreakdown.map((t) => (
            <div
              key={t.team_id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: t.color_hex }}
              />
              <div className="flex items-center justify-between mt-1 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: t.color_hex }}
                  />
                  <span className="font-bold text-slate-800 text-sm">{t.team_name}</span>
                </div>
                <span className="text-xs font-bold text-slate-500 font-mono">{t.percentage}%</span>
              </div>

              <div className="flex items-end justify-between text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
                <span>
                  ทั้งหมด: <strong className="text-slate-900 font-mono">{t.total}</strong>
                </span>
                <span>
                  เช็คอิน:{' '}
                  <strong className="text-emerald-600 font-mono">{t.checked_in}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Section: Donut + Gauge + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams Donut Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>สัดส่วนผู้ลงทะเบียนตามทีม</span>
            <span className="text-xs text-slate-400 font-normal">Team Distribution</span>
          </h3>
          <TeamDonutChart data={stats.teamsBreakdown} totalRegistrations={stats.totalRegistrations} />
        </div>

        {/* Check-in Gauge */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>อัตราความคืบหน้า Check-in</span>
            <span className="text-xs text-slate-400 font-normal">Attendance Rate</span>
          </h3>
          <CheckInGauge
            checkedIn={stats.totalCheckedIn}
            total={stats.totalRegistrations}
            percentage={stats.checkInPercentage}
          />
        </div>

        {/* Sub-teams Bar Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>ทีมย่อยยอดนิยม</span>
            <span className="text-xs text-slate-400 font-normal">Top Sub-teams</span>
          </h3>
          <SubTeamBarChart data={stats.subTeamsBreakdown} />
        </div>
      </div>

      {/* Registration Trend & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">แนวโน้มการลงทะเบียน (Trend)</h3>
              <p className="text-xs text-slate-400">สถิติการลงทะเบียนตามช่วงเวลา</p>
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                id="btn-trend-hourly"
                onClick={() => setTrendMode('hourly')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  trendMode === 'hourly' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                รายชั่วโมง
              </button>
              <button
                id="btn-trend-daily"
                onClick={() => setTrendMode('daily')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  trendMode === 'daily' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                รายวัน
              </button>
            </div>
          </div>

          <TrendChart
            data={trendMode === 'hourly' ? stats.hourlyTrend : stats.dailyTrend}
            mode={trendMode}
          />
        </div>

        {/* Recent Activity Ticker */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
            <span>กิจกรรมล่าสุด</span>
            <span className="text-[11px] text-indigo-600 font-medium">Live Feed</span>
          </h3>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {stats.recentActivity.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">ยังไม่มีกิจกรรมล่าสุด</div>
            ) : (
              stats.recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-xs border border-slate-100"
                >
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      act.type === 'CHECK_IN'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    {act.type === 'CHECK_IN' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Users className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 truncate">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 truncate">{act.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(act.timestamp).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      <span className="font-mono text-slate-600">{act.code}</span> • {act.team}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
