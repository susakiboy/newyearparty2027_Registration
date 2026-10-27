import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  FileText,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { EventConfig, Team, SubTeam, AdminUser } from '../types';
import { teamService } from '../services/teamService';
import { registrationService } from '../services/registrationService';
import { dashboardService } from '../services/dashboardService';
import { exportService } from '../services/exportService';
import { PrintAttendanceList } from '../components/PrintAttendanceList';

interface AdminReportsProps {
  event: EventConfig;
  currentUser: AdminUser;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AdminReports: React.FC<AdminReportsProps> = ({
  event,
  currentUser,
  onShowToast,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'CHECKED_IN' | 'PENDING'>('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState<any[]>([]);

  useEffect(() => {
    loadTeams();
  }, [event.id]);

  const loadTeams = async () => {
    try {
      const allTeams = await teamService.getActiveTeams(event.id);
      setTeams(allTeams);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  };

  // Export 1: Filtered Participants to Excel / CSV (Prompt Section 30, 31)
  const handleExportList = async (format: 'xlsx' | 'csv') => {
    try {
      setIsExporting(true);
      const data = await registrationService.getAllForExport({
        team_id: selectedTeamId,
        check_in_status: selectedStatus,
      });

      const teamName = selectedTeamId !== 'ALL'
        ? teams.find((t) => t.id === selectedTeamId)?.name || 'Filtered'
        : 'AllTeams';

      exportService.exportRegistrationsToExcel(data, teamName, format);
      onShowToast('success', `ส่งออกรายงาน ${format.toUpperCase()} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Export list error:', err);
      onShowToast('error', 'เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    } finally {
      setIsExporting(false);
    }
  };

  // Export 2: Comprehensive Multi-Sheet Summary Report (Prompt Section 32)
  const handleExportSummaryReport = async () => {
    try {
      setIsExporting(true);
      exportService.exportSummaryReport(event.id);
      onShowToast('success', 'ส่งออกรายงานสรุปหลายชีต (Multi-Sheet Summary) เรียบร้อยแล้ว');
    } catch (err) {
      console.error('Summary report error:', err);
      onShowToast('error', 'เกิดข้อผิดพลาดในการสร้างรายงานสรุป');
    } finally {
      setIsExporting(false);
    }
  };

  // Prepare Print Modal
  const handleOpenPrintModal = async () => {
    try {
      const data = await registrationService.getAllForExport({
        team_id: selectedTeamId,
        check_in_status: selectedStatus,
      });
      setPrintData(data);
      setIsPrintModalOpen(true);
    } catch (err) {
      onShowToast('error', 'ไม่สามารถเตรียมข้อมูลสำหรับพิมพ์ได้');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          ศูนย์รายงานและส่งออกข้อมูล (Reports & Export)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          ดาวน์โหลดข้อมูล Excel, CSV และพิมพ์เอกสารรายชื่อสำหรับการจัดกิจกรรมหน้างาน
        </p>
      </div>

      {/* Filter Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          <span>กำหนดขอบเขตข้อมูลสำหรับรายงาน (Report Scope)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1 font-semibold">เลือกสังกัดทีม</label>
            <select
              id="report-filter-team"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
            >
              <option value="ALL">ทุกสังกัดทีม (All Teams)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1 font-semibold">สถานะ Check-in</label>
            <select
              id="report-filter-status"
              value={selectedStatus}
              onChange={(e: any) => setSelectedStatus(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
            >
              <option value="ALL">ผู้ลงทะเบียนทั้งหมด (All Registrations)</option>
              <option value="CHECKED_IN">เฉพาะที่ Check-in แล้ว (Checked-in Only)</option>
              <option value="PENDING">เฉพาะที่ยังไม่ Check-in (Pending Only)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Excel Participant Export */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              รายชื่อผู้ลงทะเบียน (Excel .xlsx)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ส่งออกรายชื่อพร้อม Registration ID, สังกัดทีม, ทีมย่อย, เวลาลงทะเบียน และสถานะ Check-in
            </p>
          </div>

          <div className="pt-6 space-y-2">
            <button
              id="btn-report-export-xlsx"
              onClick={() => handleExportList('xlsx')}
              disabled={isExporting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลด Excel (.xlsx)</span>
            </button>
            <button
              id="btn-report-export-csv"
              onClick={() => handleExportList('csv')}
              disabled={isExporting}
              className="w-full py-2 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              ดาวน์โหลดเป็น CSV (.csv)
            </button>
          </div>
        </div>

        {/* Card 2: Multi-Sheet Summary Report */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              รายงานสรุปภาพรวม (Multi-Sheet)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              รายงาน Excel สรุปผลทางการ 4 ชีต: KPI ภาพรวม, สถิติตามทีม, สถิติตามทีมย่อย และบันทึกกิจกรรม
            </p>
          </div>

          <div className="pt-6">
            <button
              id="btn-report-export-summary"
              onClick={handleExportSummaryReport}
              disabled={isExporting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลดรายงานสรุป</span>
            </button>
          </div>
        </div>

        {/* Card 3: Printable Attendance Checklist */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Printer className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              ใบรายชื่อสำหรับพิมพ์ (Attendance Sheet)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              จัดรูปแบบเอกสารพร้อมช่องเซ็นชื่อลายมือชื่อ เหมาะสำหรับพิมพ์แจกหัวหน้าทีมหน้างาน
            </p>
          </div>

          <div className="pt-6">
            <button
              id="btn-report-open-print"
              onClick={handleOpenPrintModal}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ใบรายชื่อ (Print Layout)</span>
            </button>
          </div>
        </div>
      </div>

      {/* PRINT MODAL */}
      <PrintAttendanceList
        title={`ใบรายชื่อผู้ลงทะเบียน (${selectedTeamId !== 'ALL' ? teams.find((t) => t.id === selectedTeamId)?.name : 'ทุกทีม'})`}
        registrations={printData}
        eventName={`${event.name} ${event.year}`}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
};
