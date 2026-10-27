import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Printer,
  Edit2,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  CheckCircle2,
  Clock,
  Ban,
  FileSpreadsheet,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  Gift,
} from 'lucide-react';
import {
  Registration,
  RegistrationFilter,
  Pagination,
  Team,
  SubTeam,
  EventConfig,
  AdminUser,
} from '../types';
import { registrationService } from '../services/registrationService';
import { teamService } from '../services/teamService';
import { subTeamService } from '../services/subTeamService';
import { exportService } from '../services/exportService';
import { luckyDrawService } from '../services/luckyDrawService';
import { QRCodeModal } from '../components/QRCodeModal';
import { PrintAttendanceList } from '../components/PrintAttendanceList';

interface AdminRegistrationsProps {
  event: EventConfig;
  currentUser: AdminUser;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AdminRegistrations: React.FC<AdminRegistrationsProps> = ({
  event,
  currentUser,
  onShowToast,
}) => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [subTeams, setSubTeams] = useState<SubTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('ALL');
  const [selectedSubTeamId, setSelectedSubTeamId] = useState('ALL');
  const [selectedCheckInStatus, setSelectedCheckInStatus] = useState<'ALL' | 'CHECKED_IN' | 'PENDING'>('ALL');
  const [selectedRegStatus, setSelectedRegStatus] = useState<'ALL' | 'CONFIRMED' | 'CANCELLED'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  // Action Modals State
  const [viewingReg, setViewingReg] = useState<Registration | null>(null);
  const [editingReg, setEditingReg] = useState<Registration | null>(null);
  const [deletingReg, setDeletingReg] = useState<Registration | null>(null);
  const [isPrintAttendanceOpen, setIsPrintAttendanceOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Super Admin & Admin Capabilities
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdminOrSuper = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  // Edit Modal State
  const [editSubTeamsList, setEditSubTeamsList] = useState<SubTeam[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Add Registration Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [newSubTeamId, setNewSubTeamId] = useState('');
  const [newSubTeamsList, setNewSubTeamsList] = useState<SubTeam[]>([]);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Real-time Duplicate Detection
  const [editDuplicate, setEditDuplicate] = useState<Registration | null>(null);
  const [newDuplicate, setNewDuplicate] = useState<Registration | null>(null);

  useEffect(() => {
    if (editingReg && editingReg.first_name.trim().length >= 2 && editingReg.last_name.trim().length >= 2) {
      registrationService.checkDuplicate(
        editingReg.first_name.trim(),
        editingReg.last_name.trim(),
        editingReg.event_id,
        editingReg.id
      ).then(setEditDuplicate);
    } else {
      setEditDuplicate(null);
    }
  }, [editingReg?.first_name, editingReg?.last_name, editingReg?.event_id, editingReg?.id]);

  // Load sub-teams for Edit Modal when editingReg's team changes
  useEffect(() => {
    if (editingReg?.team_id) {
      subTeamService.getActiveSubTeams(editingReg.team_id).then(setEditSubTeamsList);
    } else {
      setEditSubTeamsList([]);
    }
  }, [editingReg?.team_id]);

  useEffect(() => {
    if (newFirst.trim().length >= 2 && newLast.trim().length >= 2) {
      registrationService.checkDuplicate(newFirst.trim(), newLast.trim(), event.id).then(setNewDuplicate);
    } else {
      setNewDuplicate(null);
    }
  }, [newFirst, newLast, event.id]);

  // Load sub-teams for Add Modal when selected team changes
  useEffect(() => {
    if (!newTeamId) {
      setNewSubTeamsList([]);
      setNewSubTeamId('');
      return;
    }
    subTeamService.getActiveSubTeams(newTeamId).then((subs) => {
      setNewSubTeamsList(subs);
      setNewSubTeamId('');
    });
  }, [newTeamId]);

  // Load teams on mount
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

  // Load sub-teams when team filter changes
  useEffect(() => {
    const loadSubTeams = async () => {
      if (selectedTeamId === 'ALL') {
        setSubTeams([]);
        setSelectedSubTeamId('ALL');
      } else {
        const subs = await subTeamService.getActiveSubTeams(selectedTeamId);
        setSubTeams(subs);
      }
    };
    loadSubTeams();
  }, [selectedTeamId]);

  // Query registrations with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRegistrations();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    searchQuery,
    selectedTeamId,
    selectedSubTeamId,
    selectedCheckInStatus,
    selectedRegStatus,
    dateFrom,
    dateTo,
    page,
    limit,
  ]);

  // Realtime subscription for live registration events
  useEffect(() => {
    const unsub = registrationService.subscribeToRegistrations(() => {
      fetchRegistrations();
    });
    return () => unsub();
  }, [selectedTeamId, selectedSubTeamId, selectedCheckInStatus, selectedRegStatus, page, limit]);

  const fetchRegistrations = async () => {
    try {
      setIsLoading(true);
      const filter: RegistrationFilter = {
        search: searchQuery,
        team_id: selectedTeamId,
        sub_team_id: selectedSubTeamId,
        check_in_status: selectedCheckInStatus,
        registration_status: selectedRegStatus,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };

      const result = await registrationService.getRegistrations(filter, page, limit);
      setRegistrations(result.data);
      setPagination(result.pagination);
    } catch (err) {
      console.error('Failed to fetch registrations:', err);
      onShowToast('error', 'ไม่สามารถโหลดข้อมูลผู้ลงทะเบียนได้');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Soft Delete (Cancel Registration)
  const handleSoftDelete = async () => {
    if (!deletingReg) return;
    try {
      setIsDeleting(true);
      const res = await registrationService.deleteRegistration(deletingReg.id, currentUser);
      onShowToast('success', res.message);
      setDeletingReg(null);
      fetchRegistrations();
    } catch (err: any) {
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการยกเลิกรายการ');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Permanent Delete (Hard Delete from Supabase & Local)
  const handlePermanentDelete = async () => {
    if (!deletingReg) return;
    try {
      setIsDeleting(true);
      const res = await registrationService.deleteRegistrationPermanently(deletingReg.id, currentUser);
      onShowToast('success', res.message);
      setDeletingReg(null);
      fetchRegistrations();
    } catch (err: any) {
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการลบข้อมูลถาวร');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Restore
  const handleRestore = async (reg: Registration) => {
    try {
      const res = await registrationService.restoreRegistration(reg.id, currentUser, reg.registration_code);
      onShowToast('success', res.message);
      if (deletingReg?.id === reg.id) {
        setDeletingReg(null);
      }
      fetchRegistrations();
    } catch (err: any) {
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการกู้คืนสถานะ');
    }
  };

  // Handle Create Registration (Admin)
  const handleCreateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFirst = newFirst.trim();
    const trimmedLast = newLast.trim();
    if (!trimmedFirst || !trimmedLast || !newTeamId) {
      onShowToast('warning', 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const dup = await registrationService.checkDuplicate(trimmedFirst, trimmedLast, event.id);
    if (dup) {
      onShowToast(
        'error',
        `ห้ามบันทึกซ้ำเด็ดขาด! พบรายชื่อ "${trimmedFirst} ${trimmedLast}" ในระบบแล้ว (รหัส: ${dup.registration_code}, ทีม: ${dup.team_name_snapshot})`
      );
      return;
    }

    try {
      setIsSubmittingNew(true);
      await registrationService.register({
        eventId: event.id,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        teamId: newTeamId,
        subTeamId: newSubTeamId || null,
      });
      onShowToast('success', `เพิ่มผู้ลงทะเบียน "${trimmedFirst} ${trimmedLast}" เรียบร้อยแล้ว`);
      setIsAddModalOpen(false);
      setNewFirst('');
      setNewLast('');
      setNewTeamId('');
      setNewSubTeamId('');
      fetchRegistrations();
    } catch (err: any) {
      onShowToast('error', err.message || 'ไม่สามารถลงทะเบียนได้');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReg) return;
    const trimmedFirst = editingReg.first_name.trim();
    const trimmedLast = editingReg.last_name.trim();

    if (!trimmedFirst || !trimmedLast) {
      onShowToast('warning', 'กรุณากรอกชื่อจริงและนามสกุล');
      return;
    }

    if (!editingReg.team_id) {
      onShowToast('warning', 'กรุณาเลือกสังกัดทีม');
      return;
    }

    if (editingReg.registration_status === 'CONFIRMED') {
      const dup = await registrationService.checkDuplicate(
        trimmedFirst,
        trimmedLast,
        editingReg.event_id,
        editingReg.id
      );
      if (dup) {
        onShowToast(
          'error',
          `ห้ามบันทึกซ้ำเด็ดขาด! รายชื่อ "${trimmedFirst} ${trimmedLast}" ซ้ำกับผู้ลงทะเบียนอื่นในระบบแล้ว (รหัส: ${dup.registration_code})`
        );
        return;
      }
    }

    try {
      setIsSubmittingEdit(true);
      await registrationService.updateRegistration(
        editingReg.id,
        {
          registration_code: editingReg.registration_code,
          first_name: trimmedFirst,
          last_name: trimmedLast,
          team_id: editingReg.team_id,
          team_name_snapshot: editingReg.team_name_snapshot,
          sub_team_id: editingReg.sub_team_id || null,
          sub_team_name_snapshot: editingReg.sub_team_name_snapshot,
          check_in_status: editingReg.check_in_status,
          registration_status: editingReg.registration_status,
        },
        currentUser
      );

      // Save lucky number directly to Supabase if modified
      if (editingReg.lucky_number !== undefined) {
        await luckyDrawService.manuallyAssignNumber(
          editingReg.id,
          editingReg.lucky_number || '',
          editingReg.event_id,
          currentUser
        );
      }

      onShowToast('success', `แก้ไขข้อมูลผู้ลงทะเบียน "${trimmedFirst} ${trimmedLast}" เรียบร้อยแล้ว`);
      setEditingReg(null);
      fetchRegistrations();
    } catch (err: any) {
      onShowToast('error', err.message || 'ไม่สามารถแก้ไขข้อมูลได้');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Export handlers (Prompt Section 30, 31, 32)
  const handleExportExcel = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      onShowToast('info', 'กำลังสร้างไฟล์ Excel...');
      const filter: RegistrationFilter = {
        search: searchQuery,
        team_id: selectedTeamId,
        sub_team_id: selectedSubTeamId,
        check_in_status: selectedCheckInStatus,
        registration_status: selectedRegStatus,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };

      const exportData = await registrationService.getAllForExport(filter);

      let suffix = 'All';
      if (selectedTeamId !== 'ALL') {
        const teamObj = teams.find((t) => t.id === selectedTeamId);
        suffix = teamObj ? `Team_${teamObj.name}` : 'Filtered';
      } else if (selectedCheckInStatus === 'CHECKED_IN') {
        suffix = 'Checked_In';
      }

      exportService.exportRegistrationsToExcel(exportData, suffix, format);
      onShowToast('success', `ส่งออกไฟล์ ${format.toUpperCase()} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Export error:', err);
      onShowToast('error', 'เกิดข้อผิดพลาดในการส่งออกไฟล์');
    }
  };

  const getTeamColor = (teamId: string) => {
    const t = teams.find((item) => item.id === teamId);
    return t?.color_hex || '#64748B';
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">จัดการข้อมูลผู้ลงทะเบียน</h2>
            {isSuperAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                สิทธิ์ Super Admin (แก้ไข / ลบถาวร / กู้คืน)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium">
                สิทธิ์ Admin ทั่วไป
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            ค้นหา ตรวจสอบ แก้ไขข้อมูล และส่งออกรายงาน Excel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Registration Button */}
          <button
            id="btn-open-add-registration"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>เพิ่มผู้ลงทะเบียน</span>
          </button>

          {/* Print Attendance Button */}
          <button
            id="btn-open-print-attendance"
            onClick={() => setIsPrintAttendanceOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>พิมพ์ใบรายชื่อ</span>
          </button>

          {/* Export Excel Dropdown */}
          <div className="flex items-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
            <button
              id="btn-export-registrations-xlsx"
              onClick={() => handleExportExcel('xlsx')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <button
              id="btn-export-registrations-csv"
              onClick={() => handleExportExcel('csv')}
              className="px-2.5 py-2 text-xs font-semibold border-l border-emerald-500/50 hover:bg-emerald-800 transition-colors"
              title="Export เป็น CSV"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar Panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input-search-registrations"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="ค้นหาด้วย Registration ID, ชื่อ, นามสกุล หรือสังกัดทีม..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          {/* Team Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              สังกัดทีม (Team)
            </label>
            <select
              id="filter-team"
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
            >
              <option value="ALL">ทั้งหมด (All Teams)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sub Team Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              ทีมย่อย (Sub Team)
            </label>
            <select
              id="filter-sub-team"
              value={selectedSubTeamId}
              disabled={selectedTeamId === 'ALL' || subTeams.length === 0}
              onChange={(e) => {
                setSelectedSubTeamId(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none disabled:opacity-50"
            >
              <option value="ALL">ทั้งหมด (All Sub Teams)</option>
              {subTeams.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Check-in Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              สถานะ Check-in
            </label>
            <select
              id="filter-checkin-status"
              value={selectedCheckInStatus}
              onChange={(e: any) => {
                setSelectedCheckInStatus(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="CHECKED_IN">Check-in แล้ว</option>
              <option value="PENDING">ยังไม่ Check-in</option>
            </select>
          </div>

          {/* Registration Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              สถานะรายการ
            </label>
            <select
              id="filter-reg-status"
              value={selectedRegStatus}
              onChange={(e: any) => {
                setSelectedRegStatus(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="CONFIRMED">ยืนยันแล้ว</option>
              <option value="CANCELLED">ยกเลิก</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              ตั้งแต่วันที่
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              ถึงวันที่
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Registrations Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-36">Registration ID</th>
                <th className="py-3 px-3 text-center w-28">หมายเลขรางวัล</th>
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">สังกัดทีม</th>
                <th className="py-3 px-4">กลุ่ม / ทีมย่อย</th>
                <th className="py-3 px-4 text-center">สถานะ Check-in</th>
                <th className="py-3 px-4">วันที่ลงทะเบียน</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>กำลังโหลดข้อมูล...</span>
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลผู้ลงทะเบียนตามเงื่อนไขที่ระบุ
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => {
                  const teamHex = getTeamColor(reg.team_id);
                  const isCancelled = reg.registration_status === 'CANCELLED';

                  return (
                    <tr
                      key={reg.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCancelled ? 'opacity-50 bg-slate-50/50' : ''
                      }`}
                    >
                      {/* Registration Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {reg.registration_code}
                      </td>

                      {/* Lucky Draw Number */}
                      <td className="py-3.5 px-3 text-center">
                        {reg.lucky_number ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                            <Gift className="w-3.5 h-3.5 text-amber-600" />
                            <span>{reg.lucky_number}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* Full Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {reg.full_name}
                        {isCancelled && (
                          <span className="ml-2 text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-sm">
                            ยกเลิก
                          </span>
                        )}
                      </td>

                      {/* Team */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: teamHex }}
                          />
                          <span>{reg.team_name_snapshot}</span>
                        </div>
                      </td>

                      {/* Sub Team */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {reg.sub_team_name_snapshot || '-'}
                      </td>

                      {/* Check-in Status */}
                      <td className="py-3.5 px-4 text-center">
                        {reg.check_in_status === 'CHECKED_IN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Check-in แล้ว</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>ยังไม่ Check-in</span>
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(reg.registered_at).toLocaleString('th-TH', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View QR Code & Badge */}
                          <button
                            id={`btn-view-reg-${reg.id}`}
                            onClick={() => setViewingReg(reg)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="ดูบัตร & QR Code"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Registration (Admin & Super Admin) */}
                          {isAdminOrSuper && (
                            <button
                              id={`btn-edit-reg-${reg.id}`}
                              onClick={() => setEditingReg({ ...reg })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="แก้ไขข้อมูล (ชื่อ, ทีม, กลุ่มย่อย, สถานะ)"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete / Cancel Registration */}
                          {(isSuperAdmin || !isCancelled) && (
                            <button
                              id={`btn-delete-reg-${reg.id}`}
                              onClick={() => setDeletingReg(reg)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isCancelled
                                  ? 'text-rose-400 hover:text-rose-700 hover:bg-rose-50'
                                  : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={
                                isSuperAdmin
                                  ? isCancelled
                                    ? 'ลบออกจากฐานข้อมูลถาวร (Super Admin)'
                                    : 'ยกเลิกรายการ หรือ ลบถาวร (Super Admin)'
                                  : 'ยกเลิกรายการ (Soft Delete)'
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Quick Restore Button for Cancelled Rows */}
                          {isCancelled && isAdminOrSuper && (
                            <button
                              id={`btn-quick-restore-${reg.id}`}
                              onClick={() => handleRestore(reg)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="กู้คืนสถานะเป็น CONFIRMED"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Style Pagination Controls */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              แสดง {pagination.total > 0 ? (page - 1) * limit + 1 : 0}–
              {Math.min(page * limit, pagination.total)} จากทั้งหมด{' '}
              <strong className="text-slate-900 font-mono">{pagination.total}</strong> รายการ
            </span>
            <span className="text-slate-300">|</span>
            <select
              id="select-pagination-limit"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
            >
              <option value={25}>25 / หน้า</option>
              <option value={50}>50 / หน้า</option>
              <option value={100}>100 / หน้า</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="btn-pagination-prev"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono font-medium">
              หน้า {page} / {pagination.totalPages || 1}
            </span>
            <button
              id="btn-pagination-next"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW QR MODAL */}
      {viewingReg && (
        <QRCodeModal
          registration={viewingReg}
          team={teams.find((t) => t.id === viewingReg.team_id)}
          eventName={`${event.name} ${event.year}`}
          isOpen={true}
          onClose={() => setViewingReg(null)}
        />
      )}

      {/* EDIT MODAL */}
      {editingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150 my-8">
            <button
              id="btn-close-edit-reg-modal"
              onClick={() => setEditingReg(null)}
              disabled={isSubmittingEdit}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  แก้ไขข้อมูลผู้ลงทะเบียน
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  รหัส: {editingReg.registration_code}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ชื่อจริง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-edit-first-name"
                    type="text"
                    required
                    value={editingReg.first_name}
                    onChange={(e) =>
                      setEditingReg({ ...editingReg, first_name: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    นามสกุล <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-edit-last-name"
                    type="text"
                    required
                    value={editingReg.last_name}
                    onChange={(e) =>
                      setEditingReg({ ...editingReg, last_name: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Team selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  สังกัดทีม (Team) <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-edit-team"
                  value={editingReg.team_id}
                  onChange={(e) => {
                    const newTeamId = e.target.value;
                    const matchedTeam = teams.find((t) => t.id === newTeamId);
                    setEditingReg({
                      ...editingReg,
                      team_id: newTeamId,
                      team_name_snapshot: matchedTeam ? matchedTeam.name : editingReg.team_name_snapshot,
                      sub_team_id: null,
                      sub_team_name_snapshot: null,
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.color})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-Team selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  กลุ่ม / ทีมย่อย (Sub-Team)
                </label>
                <select
                  id="select-edit-subteam"
                  value={editingReg.sub_team_id || ''}
                  onChange={(e) => {
                    const newSubId = e.target.value || null;
                    const matchedSub = editSubTeamsList.find((s) => s.id === newSubId);
                    setEditingReg({
                      ...editingReg,
                      sub_team_id: newSubId,
                      sub_team_name_snapshot: matchedSub ? matchedSub.name : null,
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- ไม่ระบุทีมย่อย (ทั่วไป) --</option>
                  {editSubTeamsList.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Check-In and Registration Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">สถานะ Check-in</label>
                  <select
                    id="select-edit-checkin-status"
                    value={editingReg.check_in_status}
                    onChange={(e) =>
                      setEditingReg({
                        ...editingReg,
                        check_in_status: e.target.value as 'PENDING' | 'CHECKED_IN',
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="PENDING">ยังไม่ Check-in (PENDING)</option>
                    <option value="CHECKED_IN">Check-in แล้ว (CHECKED_IN)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">สถานะการลงทะเบียน</label>
                  <select
                    id="select-edit-reg-status"
                    value={editingReg.registration_status}
                    onChange={(e) =>
                      setEditingReg({
                        ...editingReg,
                        registration_status: e.target.value as 'CONFIRMED' | 'CANCELLED',
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="CONFIRMED">ใช้งานปกติ (CONFIRMED)</option>
                    <option value="CANCELLED">ยกเลิกรายการ (CANCELLED)</option>
                  </select>
                </div>
              </div>

              {/* Lucky Draw Prize Number */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <label className="block font-bold text-amber-900 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    หมายเลขของรางวัล (Lucky Draw No.)
                  </span>
                  <span className="text-[10px] text-amber-700 font-normal">
                    (เว้นว่างหากยังไม่กำหนด หรือระบุหมายเลขใหม่)
                  </span>
                </label>
                <input
                  id="input-edit-lucky-number"
                  type="text"
                  placeholder="เช่น 042 หรือ L-001"
                  value={editingReg.lucky_number || ''}
                  onChange={(e) =>
                    setEditingReg({ ...editingReg, lucky_number: e.target.value.trim() || null })
                  }
                  className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-mono font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Duplicate check warning in Edit Modal */}
              {editDuplicate && editingReg.registration_status === 'CONFIRMED' && (
                <div
                  id="edit-reg-duplicate-alert"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-900 flex items-center gap-1.5">
                      <span>ห้ามบันทึกซ้ำเด็ดขาด!</span>
                      <span className="px-1.5 py-0.2 bg-rose-200 text-rose-800 text-[10px] rounded">พบชื่อซ้ำ</span>
                    </p>
                    <p className="text-[11px] text-rose-700 leading-snug">
                      รายชื่อนี้ซ้ำกับผู้ลงทะเบียนอื่นในระบบแล้ว (รหัส: <strong>{editDuplicate.registration_code}</strong>, สังกัด: {editDuplicate.team_name_snapshot})
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  id="btn-cancel-edit-reg"
                  type="button"
                  disabled={isSubmittingEdit}
                  onClick={() => setEditingReg(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-save-edit-reg"
                  type="submit"
                  disabled={isSubmittingEdit || (Boolean(editDuplicate) && editingReg.registration_status === 'CONFIRMED')}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {isSubmittingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกการแก้ไข</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD REGISTRATION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              id="btn-close-add-reg-modal"
              onClick={() => {
                setIsAddModalOpen(false);
                setNewFirst('');
                setNewLast('');
                setNewTeamId('');
                setNewSubTeamId('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">เพิ่มผู้ลงทะเบียนใหม่</h3>
                <p className="text-[11px] text-slate-500">บันทึกข้อมูลเข้าร่วมกิจกรรมโดยเจ้าหน้าที่</p>
              </div>
            </div>

            <form onSubmit={handleCreateRegistration} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    ชื่อจริง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-new-first-name"
                    type="text"
                    required
                    value={newFirst}
                    onChange={(e) => setNewFirst(e.target.value)}
                    placeholder="เช่น สมชาย"
                    className={`w-full p-2.5 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      newDuplicate ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-500/20' : 'border-slate-300 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    นามสกุล <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-new-last-name"
                    type="text"
                    required
                    value={newLast}
                    onChange={(e) => setNewLast(e.target.value)}
                    placeholder="เช่น ใจดี"
                    className={`w-full p-2.5 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      newDuplicate ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-500/20' : 'border-slate-300 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
              </div>

              {/* Duplicate check warning */}
              {newDuplicate && (
                <div
                  id="new-reg-duplicate-alert"
                  className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in"
                >
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-rose-950 flex items-center gap-1.5">
                      <span>ห้ามบันทึกซ้ำเด็ดขาด!</span>
                      <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] rounded font-black">
                        พบชื่อซ้ำในระบบ
                      </span>
                    </p>
                    <p className="text-[11px] text-rose-800 leading-snug">
                      รายชื่อ <strong>"{newFirst} {newLast}"</strong> ได้ลงทะเบียนไว้แล้ว (รหัส: <span className="font-mono font-bold text-indigo-700">{newDuplicate.registration_code}</span>, สังกัด: {newDuplicate.team_name_snapshot})
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  สังกัดทีม <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-new-team"
                  required
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">-- กรุณาเลือกทีม --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {newSubTeamsList.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    ทีมย่อย / กลุ่ม (ถ้ามี)
                  </label>
                  <select
                    id="select-new-subteam"
                    value={newSubTeamId}
                    onChange={(e) => setNewSubTeamId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">-- ไม่ระบุทีมย่อย --</option>
                    {newSubTeamsList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  id="btn-cancel-add-reg"
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setNewFirst('');
                    setNewLast('');
                    setNewTeamId('');
                    setNewSubTeamId('');
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-confirm-add-reg"
                  type="submit"
                  disabled={isSubmittingNew || Boolean(newDuplicate)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  {isSubmittingNew ? 'กำลังบันทึก...' : newDuplicate ? 'ห้ามบันทึกซ้ำ' : 'บันทึกผู้ลงทะเบียน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / CANCEL / RESTORE MODAL */}
      {deletingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div
            id="delete-reg-modal"
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150"
          >
            <button
              id="btn-close-delete-reg-modal"
              onClick={() => setDeletingReg(null)}
              disabled={isDeleting}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3.5 mb-5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  isSuperAdmin ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                }`}
              >
                {isSuperAdmin ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isSuperAdmin
                    ? 'จัดการสถานะ / ลบข้อมูลผู้ลงทะเบียน'
                    : 'ยกเลิกรายการลงทะเบียน (Soft Delete)'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isSuperAdmin
                    ? 'สิทธิ์ Super Admin: สามารถเลือกระหว่างยกเลิกรายการ หรือลบถาวรออกจากฐานข้อมูล'
                    : 'ระบบจะทำการ Soft-Delete (ยกเลิกรายการ) เพื่อเก็บประวัติการทำงาน'}
                </p>
              </div>
            </div>

            {/* Registration Summary Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-sm">
                  {deletingReg.first_name} {deletingReg.last_name}
                </span>
                <span className="font-mono px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold">
                  {deletingReg.registration_code}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-200/80">
                <div>
                  <span className="text-slate-400">ทีม: </span>
                  <span className="font-semibold text-slate-800">{deletingReg.team_name_snapshot}</span>
                </div>
                <div>
                  <span className="text-slate-400">กลุ่มย่อย: </span>
                  <span className="font-semibold text-slate-800">
                    {deletingReg.sub_team_name_snapshot || 'ไม่ระบุ'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">สถานะรายการ: </span>
                  {deletingReg.registration_status === 'CONFIRMED' ? (
                    <span className="font-bold text-emerald-600">CONFIRMED (ใช้งานปกติ)</span>
                  ) : (
                    <span className="font-bold text-rose-600">CANCELLED (ยกเลิกแล้ว)</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">การ Check-in: </span>
                  {deletingReg.check_in_status === 'CHECKED_IN' ? (
                    <span className="font-bold text-emerald-600">Check-in แล้ว</span>
                  ) : (
                    <span className="font-medium text-slate-500">ยังไม่ Check-in</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions for Super Admin vs Admin */}
            <div className="space-y-3">
              {/* Option 1: Soft Delete (Cancel) if currently CONFIRMED */}
              {deletingReg.registration_status === 'CONFIRMED' && (
                <div className="p-3.5 border border-amber-200 bg-amber-50/70 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      ยกเลิกรายการ (Soft Delete)
                    </h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      เปลี่ยนสถานะเป็น CANCELLED เพื่อระงับสิทธิ์ แต่ยังคงประวัติไว้ในระบบ สามารถกู้คืนได้ภายหลัง
                    </p>
                  </div>
                  <button
                    id="btn-confirm-soft-delete"
                    onClick={handleSoftDelete}
                    disabled={isDeleting}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5"
                  >
                    {isDeleting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Ban className="w-3.5 h-3.5" />
                    )}
                    <span>ยกเลิกรายการ</span>
                  </button>
                </div>
              )}

              {/* Option: Restore if currently CANCELLED */}
              {deletingReg.registration_status === 'CANCELLED' && (
                <div className="p-3.5 border border-emerald-200 bg-emerald-50/70 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">
                      กู้คืนสถานะการลงทะเบียน (Restore)
                    </h4>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      เปลี่ยนสถานะกลับเป็น CONFIRMED เพื่อให้ผู้เข้าร่วมสามารถ Check-in และใช้งานตามปกติ
                    </p>
                  </div>
                  <button
                    id="btn-confirm-restore"
                    onClick={() => handleRestore(deletingReg)}
                    disabled={isDeleting}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5"
                  >
                    {isDeleting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>กู้คืนสถานะ</span>
                  </button>
                </div>
              )}

              {/* Option 2: Permanent Delete (Super Admin ONLY) */}
              {isSuperAdmin ? (
                <div className="p-3.5 border border-rose-300 bg-rose-50/80 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-rose-900">
                        ลบถาวรออกจากฐานข้อมูล (Permanent Delete)
                      </h4>
                      <span className="px-1.5 py-0.2 bg-rose-200 text-rose-800 text-[10px] font-bold rounded">
                        Super Admin
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      ลบข้อมูลผู้ลงทะเบียนและประวัติ Check-in ออกจากฐานข้อมูล Supabase และระบบทันที <strong>ไม่สามารถกู้คืนได้</strong>
                    </p>
                  </div>
                  <button
                    id="btn-confirm-permanent-delete"
                    onClick={handlePermanentDelete}
                    disabled={isDeleting}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    {isDeleting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>ลบถาวร</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-100 rounded-xl text-center text-[11px] text-slate-500">
                  หมายเหตุ: การลบข้อมูลถาวรออกจากฐานข้อมูล สงวนสิทธิ์เฉพาะ Super Admin เท่านั้น
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 mt-5">
              <button
                id="btn-cancel-delete-modal"
                onClick={() => setDeletingReg(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT ATTENDANCE LIST MODAL */}
      <PrintAttendanceList
        title={`ใบรายชื่อผู้ลงทะเบียน (${selectedTeamId !== 'ALL' ? teams.find((t) => t.id === selectedTeamId)?.name : 'ทุกทีม'})`}
        registrations={registrations}
        eventName={`${event.name} ${event.year}`}
        isOpen={isPrintAttendanceOpen}
        onClose={() => setIsPrintAttendanceOpen(false)}
      />
    </div>
  );
};
