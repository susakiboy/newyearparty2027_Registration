import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  X,
  Filter,
} from 'lucide-react';
import { Team, SubTeam, EventConfig, AdminUser } from '../types';
import { teamService } from '../services/teamService';
import { subTeamService } from '../services/subTeamService';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface AdminSubTeamsProps {
  event: EventConfig;
  currentUser: AdminUser;
  initialTeamFilter?: string;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AdminSubTeams: React.FC<AdminSubTeamsProps> = ({
  event,
  currentUser,
  initialTeamFilter,
  onShowToast,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>(initialTeamFilter || 'ALL');
  const [subTeams, setSubTeams] = useState<SubTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubTeam, setEditingSubTeam] = useState<SubTeam | null>(null);
  const [deletingSubTeam, setDeletingSubTeam] = useState<SubTeam | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [modalTeamId, setModalTeamId] = useState('');
  const [modalSubTeamName, setModalSubTeamName] = useState('');
  const [modalStatus, setModalStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  useEffect(() => {
    loadTeams();
  }, [event.id]);

  useEffect(() => {
    loadSubTeams();
  }, [selectedTeamFilter]);

  const loadTeams = async () => {
    try {
      const allTeams = await teamService.getActiveTeams(event.id);
      setTeams(allTeams);
      if (allTeams.length > 0 && !modalTeamId) {
        setModalTeamId(allTeams[0].id);
      }
    } catch (err) {
      console.error('Error loading teams:', err);
    }
  };

  const loadSubTeams = async () => {
    try {
      setIsLoading(true);
      const data = await subTeamService.getAllSubTeams(
        selectedTeamFilter === 'ALL' ? undefined : selectedTeamFilter
      );
      setSubTeams(data);
    } catch (err) {
      console.error('Error loading sub-teams:', err);
      onShowToast('error', 'ไม่สามารถโหลดข้อมูลทีมย่อยได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingSubTeam(null);
    setModalTeamId(selectedTeamFilter !== 'ALL' ? selectedTeamFilter : teams[0]?.id || '');
    setModalSubTeamName('');
    setModalStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (subTeam: SubTeam) => {
    setEditingSubTeam(subTeam);
    setModalTeamId(subTeam.team_id);
    setModalSubTeamName(subTeam.name);
    setModalStatus(subTeam.status);
    setIsModalOpen(true);
  };

  const handleSaveSubTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSubTeamName.trim()) {
      onShowToast('warning', 'กรุณาระบุชื่อทีมย่อย');
      return;
    }
    if (!modalTeamId) {
      onShowToast('warning', 'กรุณาเลือกสังกัดทีมหลัก');
      return;
    }

    try {
      setIsSaving(true);
      if (editingSubTeam) {
        await subTeamService.updateSubTeam(
          editingSubTeam.id,
          {
            name: modalSubTeamName.trim(),
            team_id: modalTeamId,
            status: modalStatus,
          },
          currentUser
        );
        onShowToast('success', 'แก้ไขข้อมูลทีมย่อยเรียบร้อยแล้ว');
      } else {
        await subTeamService.createSubTeam(
          {
            team_id: modalTeamId,
            name: modalSubTeamName.trim(),
            status: modalStatus,
            sort_order: subTeams.length + 1,
          },
          currentUser
        );
        onShowToast('success', 'เพิ่มทีมย่อยใหม่เรียบร้อยแล้ว');
      }

      setIsModalOpen(false);
      loadSubTeams();
    } catch (err: any) {
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (subTeam: SubTeam) => {
    try {
      const nextStatus = subTeam.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await subTeamService.updateSubTeam(subTeam.id, { status: nextStatus }, currentUser);
      onShowToast('success', `เปลี่ยนสถานะเป็น ${nextStatus} แล้ว`);
      loadSubTeams();
    } catch (err: any) {
      onShowToast('error', err.message || 'ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSubTeam) return;
    try {
      const res = await subTeamService.deleteSubTeam(deletingSubTeam.id, currentUser);
      onShowToast('success', res.message);
      setDeletingSubTeam(null);
      loadSubTeams();
    } catch (err: any) {
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการลบทีมย่อย');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subTeams.length) return;

    const newSubTeams = [...subTeams];
    const [moved] = newSubTeams.splice(index, 1);
    newSubTeams.splice(targetIndex, 0, moved);

    setSubTeams(newSubTeams);
    const orderedIds = newSubTeams.map((st) => st.id);
    await subTeamService.reorderSubTeams(orderedIds, currentUser);
  };

  const getTeamObj = (teamId: string) => teams.find((t) => t.id === teamId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">จัดการกลุ่ม / ทีมย่อย (Sub Teams)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดทีมย่อยสำหรับแต่ละสังกัดสี เช่น หน่วยงาน สายงาน หรือฝ่าย
          </p>
        </div>
        <button
          id="btn-add-new-subteam"
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มทีมย่อยใหม่</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 text-xs">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="font-bold text-slate-600 shrink-0">กรองตามสังกัดทีม:</span>
        <select
          id="filter-subteam-parent"
          value={selectedTeamFilter}
          onChange={(e) => setSelectedTeamFilter(e.target.value)}
          className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
        >
          <option value="ALL">ทุกสังกัดทีม (All Teams)</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="text-slate-400 ml-auto font-mono">
          ทั้งหมด {subTeams.length} รายการ
        </span>
      </div>

      {/* Sub Teams Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center">ลำดับ</th>
                <th className="py-3 px-4">ชื่อทีมย่อย</th>
                <th className="py-3 px-4">สังกัดทีมหลัก</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subTeams.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลทีมย่อย
                  </td>
                </tr>
              ) : (
                subTeams.map((st, index) => {
                  const parentTeam = getTeamObj(st.team_id);
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sort Order */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            id={`btn-subteam-up-${st.id}`}
                            onClick={() => handleMoveOrder(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-bold text-slate-700">
                            {index + 1}
                          </span>
                          <button
                            id={`btn-subteam-down-${st.id}`}
                            onClick={() => handleMoveOrder(index, 'down')}
                            disabled={index === subTeams.length - 1}
                            className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Sub Team Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">{st.name}</td>

                      {/* Parent Team */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: parentTeam?.color_hex || '#94a3b8' }}
                          />
                          <span>{parentTeam?.name || 'Unknown Team'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          id={`btn-toggle-subteam-status-${st.id}`}
                          onClick={() => handleToggleStatus(st)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            st.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {st.status === 'ACTIVE' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>เปิดใช้งาน</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>ปิดใช้งาน</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`btn-edit-subteam-${st.id}`}
                            onClick={() => handleOpenEditModal(st)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="แก้ไขข้อมูล"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-delete-subteam-${st.id}`}
                            onClick={() => setDeletingSubTeam(st)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="ลบทีมย่อย"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT SUB TEAM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
            <button
              id="btn-close-subteam-modal"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4">
              {editingSubTeam ? 'แก้ไขข้อมูลทีมย่อย' : 'เพิ่มทีมย่อยใหม่'}
            </h3>

            <form onSubmit={handleSaveSubTeam} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  สังกัดทีมหลัก (Parent Team) <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-subteam-parent"
                  required
                  value={modalTeamId}
                  onChange={(e) => setModalTeamId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  ชื่อทีมย่อย (Sub Team Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-subteam-name"
                  type="text"
                  required
                  value={modalSubTeamName}
                  onChange={(e) => setModalSubTeamName(e.target.value)}
                  placeholder="เช่น IT Department หรือ ฝ่ายจัดซื้อ"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  สถานะการใช้งาน
                </label>
                <select
                  id="select-subteam-status"
                  value={modalStatus}
                  onChange={(e: any) => setModalStatus(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="ACTIVE">เปิดใช้งาน (ACTIVE)</option>
                  <option value="INACTIVE">ปิดใช้งาน (INACTIVE)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  id="btn-cancel-subteam"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-save-subteam"
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deletingSubTeam)}
        title="ยืนยันการลบทีมย่อย"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบทีมย่อย "${deletingSubTeam?.name}"?`}
        confirmText="ยืนยันการลบ"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingSubTeam(null)}
      />
    </div>
  );
};
