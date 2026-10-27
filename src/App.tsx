/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { EventConfig, AdminUser } from './types';
import { eventService } from './services/eventService';
import { authService } from './services/authService';
import { healthService, HealthCheckResult } from './services/healthService';

// Pages & Layout
import { PublicRegistration } from './pages/PublicRegistration';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLayout, AdminTab } from './pages/AdminLayout';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminRegistrations } from './pages/AdminRegistrations';
import { AdminCheckIn } from './pages/AdminCheckIn';
import { AdminTeams } from './pages/AdminTeams';
import { AdminSubTeams } from './pages/AdminSubTeams';
import { AdminImport } from './pages/AdminImport';
import { AdminReports } from './pages/AdminReports';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminAuditLogs } from './pages/AdminAuditLogs';
import { AdminSettings } from './pages/AdminSettings';

// UI Components
import { Toast, ToastType } from './components/Toast';

export default function App() {
  // App View Routing: 'public' | 'login' | 'admin'
  const [currentView, setCurrentView] = useState<'public' | 'login' | 'admin'>('public');
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [subTeamInitialFilter, setSubTeamInitialFilter] = useState<string | undefined>(undefined);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  // Event State
  const [activeEvent, setActiveEvent] = useState<EventConfig | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);

  // Toast System
  const [toasts, setToasts] = useState<{ id: string; type: ToastType; message: string }[]>([]);

  // Supabase Connection Health State (Auto-tested on load)
  const [connectionHealth, setConnectionHealth] = useState<HealthCheckResult | null>(
    healthService.getLastHealth()
  );
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const showToast = (type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Run connection test and update state
  const runConnectionTest = async (isInitial = false) => {
    setIsTestingConnection(true);
    try {
      const health = await healthService.checkConnection();
      setConnectionHealth(health);

      if (isInitial) {
        if (health.databaseConnected && health.authConnected) {
          showToast('success', `☁️ เชื่อมต่อ Supabase สำเร็จ (${health.latencyMs || 0} ms)`);
        } else if (health.isConfigured && !health.databaseConnected) {
          showToast('warning', `⚠️ Supabase ขัดข้อง: ${health.message}`);
        }
      }
    } catch (err) {
      console.error('Connection health check error:', err);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Initial Boot: Load active event, restore auth session & test Supabase connection
  useEffect(() => {
    bootApp();
    runConnectionTest(true);

    // Automatically re-test when Supabase credentials change or browser comes online
    const handleConfigChange = () => {
      runConnectionTest(false);
    };
    const handleOnline = () => {
      runConnectionTest(false);
    };

    window.addEventListener('supabase-config-changed', handleConfigChange);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('supabase-config-changed', handleConfigChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const bootApp = async () => {
    try {
      setIsLoadingEvent(true);
      const event = await eventService.getActiveEvent();
      setActiveEvent(event);

      // Check current auth session
      const user = authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    } catch (err) {
      console.error('Boot error:', err);
      showToast('error', 'ไม่สามารถเชื่อมต่อฐานข้อมูลเริ่มต้นได้');
    } finally {
      setIsLoadingEvent(false);
    }
  };

  // Navigation Handlers
  const handleLoginSuccess = (user: AdminUser) => {
    setCurrentUser(user);
    if (user.role === 'CHECKIN_STAFF') {
      setAdminTab('checkin');
    } else {
      setAdminTab('dashboard');
    }
    setCurrentView('admin');
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setCurrentView('public');
    showToast('info', 'ออกจากระบบเรียบร้อยแล้ว');
  };

  const handleNavigateToSubTeams = (teamId?: string) => {
    setSubTeamInitialFilter(teamId);
    setAdminTab('subteams');
  };

  if (isLoadingEvent) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wider uppercase text-slate-400">
          NEW YEAR PARTY 2027 • กำลังเชื่อมต่อระบบ...
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toast notifications container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none no-print">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              type={toast.type}
              message={toast.message}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>

      {/* VIEW ROUTER */}
      {currentView === 'public' && (
        <PublicRegistration
          onNavigateToAdmin={() => {
            if (currentUser) {
              setCurrentView('admin');
            } else {
              setCurrentView('login');
            }
          }}
          onShowToast={showToast}
          connectionHealth={connectionHealth}
          onTestConnection={() => runConnectionTest(false)}
        />
      )}

      {currentView === 'login' && (
        <AdminLogin
          onLoginSuccess={handleLoginSuccess}
          onBackToPublic={() => setCurrentView('public')}
          onShowToast={showToast}
        />
      )}

      {currentView === 'admin' && currentUser && activeEvent && (
        <AdminLayout
          currentUser={currentUser}
          currentTab={adminTab}
          eventName={`${activeEvent.name} ${activeEvent.year}`}
          connectionHealth={connectionHealth}
          isTestingConnection={isTestingConnection}
          onTestConnection={() => runConnectionTest(false)}
          onTabChange={(tab) => setAdminTab(tab)}
          onLogout={handleLogout}
          onViewPublic={() => setCurrentView('public')}
        >
          {adminTab === 'dashboard' && (
            <AdminDashboard
              event={activeEvent}
              onNavigateToCheckIn={() => setAdminTab('checkin')}
              onNavigateToRegistrations={() => setAdminTab('registrations')}
            />
          )}

          {adminTab === 'checkin' && (
            <AdminCheckIn
              event={activeEvent}
              currentUser={currentUser}
              onShowToast={showToast}
            />
          )}

          {adminTab === 'registrations' && (
            <AdminRegistrations
              event={activeEvent}
              currentUser={currentUser}
              onShowToast={showToast}
            />
          )}

          {adminTab === 'teams' && (
            <AdminTeams
              event={activeEvent}
              currentUser={currentUser}
              onNavigateToSubTeams={handleNavigateToSubTeams}
              onShowToast={showToast}
            />
          )}

          {adminTab === 'subteams' && (
            <AdminSubTeams
              event={activeEvent}
              currentUser={currentUser}
              initialTeamFilter={subTeamInitialFilter}
              onShowToast={showToast}
            />
          )}

          {adminTab === 'import' && (
            <AdminImport
              event={activeEvent}
              currentUser={currentUser}
              onShowToast={showToast}
              onImportComplete={() => {
                showToast('info', 'ข้อมูลถูกนำเข้าสู่ระบบแล้ว');
              }}
            />
          )}

          {adminTab === 'reports' && (
            <AdminReports
              event={activeEvent}
              currentUser={currentUser}
              onShowToast={showToast}
            />
          )}

          {adminTab === 'admins' && (
            <AdminUsersPage
              currentUser={currentUser}
              onShowToast={showToast}
            />
          )}

          {adminTab === 'audit' && <AdminAuditLogs />}

          {adminTab === 'settings' && (
            <AdminSettings
              event={activeEvent}
              currentUser={currentUser}
              onEventUpdated={(updated) => setActiveEvent(updated)}
              onShowToast={showToast}
            />
          )}
        </AdminLayout>
      )}
    </>
  );
}
