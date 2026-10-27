import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { AuditLog } from '../types';
import { auditService } from '../services/auditService';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const data = await auditService.getLogs(200);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (selectedAction !== 'ALL' && log.action !== selectedAction) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchActor = log.actor_name?.toLowerCase().includes(q);
      const matchEntity = log.entity_type.toLowerCase().includes(q);
      const matchDetails = JSON.stringify(log.details).toLowerCase().includes(q);
      return matchActor || matchEntity || matchDetails;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / limit) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * limit, page * limit);

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE') || action.includes('REGISTER')) {
      return <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">{action}</span>;
    }
    if (action.includes('CHECK_IN')) {
      return <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">{action}</span>;
    }
    if (action.includes('DELETE') || action.includes('CANCEL')) {
      return <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">{action}</span>;
    }
    return <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold">{action}</span>;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            บันทึกประวัติการทำงานของระบบ (Audit Logs)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ติดตามทุกความเคลื่อนไหว การลงทะเบียน การ Check-in และการแก้ไขข้อมูลเพื่อความโปร่งใส
          </p>
        </div>

        <button
          id="btn-refresh-audit-logs"
          onClick={loadLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            id="input-search-audit-logs"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="ค้นหาผู้กระทำ, Entity หรือรายละเอียดใน Log..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 shrink-0 font-medium">ประเภทคำสั่ง:</span>
          <select
            id="select-audit-action"
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
          >
            <option value="ALL">ทั้งหมด (All Actions)</option>
            <option value="REGISTRATION_CREATE">REGISTRATION_CREATE</option>
            <option value="CHECK_IN">CHECK_IN</option>
            <option value="CHECK_IN_DUPLICATE_ATTEMPT">CHECK_IN_DUPLICATE_ATTEMPT</option>
            <option value="REGISTRATION_UPDATE">REGISTRATION_UPDATE</option>
            <option value="REGISTRATION_CANCEL">REGISTRATION_CANCEL</option>
            <option value="TEAM_CREATE">TEAM_CREATE</option>
            <option value="TEAM_UPDATE">TEAM_UPDATE</option>
            <option value="TEAM_DELETE">TEAM_DELETE</option>
            <option value="SUBTEAM_CREATE">SUBTEAM_CREATE</option>
            <option value="SUBTEAM_UPDATE">SUBTEAM_UPDATE</option>
            <option value="SUBTEAM_DELETE">SUBTEAM_DELETE</option>
            <option value="EVENT_SETTINGS_UPDATE">EVENT_SETTINGS_UPDATE</option>
            <option value="BULK_IMPORT">BULK_IMPORT</option>
            <option value="LOGIN">LOGIN</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-40">วัน-เวลา</th>
                <th className="py-3 px-4">ผู้กระทำ (Actor)</th>
                <th className="py-3 px-4">การทำงาน (Action)</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">รายละเอียด (Details)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>กำลังโหลด Audit Logs...</span>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    ไม่พบรายการบันทึกตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(log.created_at).toLocaleString('th-TH', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-sans font-semibold">
                      {log.actor_name || 'System / Public'}
                    </td>
                    <td className="py-3 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-3 px-4 text-slate-600 text-[11px]">{log.entity_type}</td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] max-w-md truncate">
                      {typeof log.details === 'object'
                        ? JSON.stringify(log.details)
                        : String(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            แสดง {filteredLogs.length > 0 ? (page - 1) * limit + 1 : 0}–
            {Math.min(page * limit, filteredLogs.length)} จากทั้งหมด {filteredLogs.length} รายการ
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="p-1 rounded-lg border border-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">
              หน้า {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded-lg border border-slate-300 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
