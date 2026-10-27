import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  QrCode,
  Flag,
  Layers,
  Upload,
  FileSpreadsheet,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Database,
  RefreshCw,
} from 'lucide-react';
import { AdminUser, AdminRole } from '../types';
import { authService } from '../services/authService';
import { HealthCheckResult } from '../services/healthService';

export type AdminTab =
  | 'dashboard'
  | 'registrations'
  | 'checkin'
  | 'teams'
  | 'subteams'
  | 'import'
  | 'reports'
  | 'admins'
  | 'audit'
  | 'settings';

interface AdminLayoutProps {
  currentUser: AdminUser;
  currentTab: AdminTab;
  eventName: string;
  connectionHealth?: HealthCheckResult | null;
  isTestingConnection?: boolean;
  onTestConnection?: () => void;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
  onViewPublic: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentUser,
  currentTab,
  eventName,
  connectionHealth,
  isTestingConnection = false,
  onTestConnection,
  onTabChange,
  onLogout,
  onViewPublic,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Menu items with role-based visibility (Prompt Section 5 & 49)
  const menuItems: {
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    roles: AdminRole[];
  }[] = [
    {
      id: 'dashboard',
      label: 'แดชบอร์ด (Dashboard)',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN', 'CHECKIN_STAFF'],
    },
    {
      id: 'checkin',
      label: 'Check-in หน้างาน',
      icon: <QrCode className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN', 'CHECKIN_STAFF'],
    },
    {
      id: 'registrations',
      label: 'รายชื่อผู้ลงทะเบียน',
      icon: <Users className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'teams',
      label: 'จัดการสังกัดทีม',
      icon: <Flag className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'subteams',
      label: 'จัดการทีมย่อย',
      icon: <Layers className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'import',
      label: 'นำเข้าข้อมูล (Import Excel)',
      icon: <Upload className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'reports',
      label: 'รายงาน & Export Excel',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      roles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      id: 'admins',
      label: 'ผู้ดูแลระบบ (Admin Users)',
      icon: <ShieldCheck className="w-4 h-4" />,
      roles: ['SUPER_ADMIN'], // Super admin only
    },
    {
      id: 'audit',
      label: 'ประวัติการใช้งาน (Audit Logs)',
      icon: <History className="w-4 h-4" />,
      roles: ['SUPER_ADMIN'],
    },
    {
      id: 'settings',
      label: 'ตั้งค่าระบบ (Settings)',
      icon: <Settings className="w-4 h-4" />,
      roles: ['SUPER_ADMIN'],
    },
  ];

  const allowedMenuItems = menuItems.filter((item) => item.roles.includes(currentUser.role));

  const handleSelectTab = (tab: AdminTab) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  const getRoleBadge = (role: AdminRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">SUPER ADMIN</span>;
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">ADMIN</span>;
      case 'CHECKIN_STAFF':
        return <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">STAFF</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40 shadow-md no-print">
        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-mobile-sidebar"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-sm tracking-tight">{eventName}</span>
        </div>
        <div>{getRoleBadge(currentUser.role)}</div>
      </header>

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-auto md:min-h-screen shrink-0 no-print ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              Event Console
            </div>
            <h1 className="text-base font-black text-white truncate">{eventName}</h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-sm font-bold text-white truncate">{currentUser.display_name}</p>
              <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
            </div>
          </div>
          <div className="mt-2">{getRoleBadge(currentUser.role)}</div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allowedMenuItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
              </button>
            );
          })}
        </nav>

        {/* Live Supabase Connection Widget */}
        <div className="mx-3 mb-2 p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px]">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>สถานะ Supabase</span>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                connectionHealth?.databaseConnected && connectionHealth?.authConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionHealth?.isConfigured
                  ? 'bg-amber-400'
                  : 'bg-slate-500'
              }`}
            />
          </div>
          <div className="text-[10px] text-slate-400 truncate mb-2">
            {isTestingConnection
              ? 'กำลังทดสอบ...'
              : connectionHealth?.databaseConnected && connectionHealth?.authConnected
              ? `ออนไลน์ (${connectionHealth.latencyMs || 0} ms)`
              : connectionHealth?.isConfigured
              ? 'มีข้อผิดพลาด/กำลังเชื่อมต่อ'
              : 'โหมด Local Storage'}
          </div>
          <div className="flex items-center gap-1.5">
            {currentUser.role === 'SUPER_ADMIN' && (
              <button
                type="button"
                onClick={() => handleSelectTab('settings')}
                className="flex-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold rounded-lg text-center transition-colors"
              >
                ตั้งค่า
              </button>
            )}
            <button
              type="button"
              onClick={onTestConnection}
              disabled={isTestingConnection}
              className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[10px] font-semibold rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isTestingConnection ? 'animate-spin' : ''}`} />
              <span>ทดสอบ</span>
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <button
            id="btn-sidebar-view-public"
            onClick={onViewPublic}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-slate-500" />
            <span>หน้าลงทะเบียนสาธารณะ</span>
          </button>
          <button
            id="btn-sidebar-logout"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>ออกจากระบบ (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Desktop Topbar */}
        <header className="hidden md:flex bg-white border-b border-slate-200 px-6 py-3.5 items-center justify-between sticky top-0 z-30 no-print">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              {menuItems.find((m) => m.id === currentTab)?.label || 'Admin Panel'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Live Cloud Status Pill */}
            <button
              type="button"
              onClick={() => {
                if (currentUser.role === 'SUPER_ADMIN') {
                  onTabChange('settings');
                } else if (onTestConnection) {
                  onTestConnection();
                }
              }}
              title={connectionHealth?.message || 'คลิกเพื่อตรวจสอบหรือตั้งค่า'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                connectionHealth?.databaseConnected && connectionHealth?.authConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : connectionHealth?.isConfigured
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionHealth?.databaseConnected && connectionHealth?.authConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : connectionHealth?.isConfigured
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
              <span>
                {isTestingConnection
                  ? 'กำลังทดสอบ...'
                  : connectionHealth?.databaseConnected && connectionHealth?.authConnected
                  ? `Supabase Online (${connectionHealth.latencyMs || 0}ms)`
                  : connectionHealth?.isConfigured
                  ? 'Supabase Error'
                  : 'Local Storage'}
              </span>
            </button>

            <button
              id="btn-header-view-public"
              onClick={onViewPublic}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>เปิดหน้าลงทะเบียน</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-300" />
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">{currentUser.display_name}</span>
              {getRoleBadge(currentUser.role)}
            </div>
          </div>
        </header>

        {/* Page Content Rendered Here */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
