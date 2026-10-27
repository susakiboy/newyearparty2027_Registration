import React, { useState, useEffect } from 'react';
import {
  Flag,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  X,
  Layers,
  Users,
} from 'lucide-react';
import { Team, EventConfig, AdminUser } from '../types';
import { teamService } from '../services/teamService';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface AdminTeamsProps {
  event: EventConfig;
  currentUser: AdminUser;
  onNavigateToSubTeams: (teamId?: string) => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AdminTeams: React.FC<AdminTeamsProps> = ({
  event,
  currentUser,
  onNavigateToSubTeams,
  onShowToast,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('');
  const [teamColorHex, setTeamColorHex] = useState('#8B5CF6');
  const [teamStatus, setTeamStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  useEffect(() => {
    loadTeams();
  }, [event.id]);

  const loadTeams = async () => {
    try {
      setIsLoading(true);
      const data = await teamService.getAllTeamsWithCounts(event.id);
      setTeams(data);
    } catch (err) {
      console.error('Error loading teams:', err);
      onShowToast('error', 'ไม่สามารถโหลดข้อมูลทีมได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTeam(null);
    setTeamName('');
    setTeamColor('');
    setTeamColorHex('#8B5CF6');
    setTeamStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamColor(team.color);
    setTeamColorHex(team.color_hex);
    setTeamStatus(team.status);
    setIsModalOpen(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      onShowToast('warning', 'กรุณาระบุชื่อทีม');
      return;
    }

    try {
      setIsSaving(true);
      if (editingTeam) {
        // Edit
        await teamService.updateTeam(
          editingTeam.id,
          {
            name: teamName.trim(),
            color: teamColor.trim() || teamName.trim(),
            color_hex: teamColorHex,
            status: teamStatus,
          },
          currentUser
        );
        onShowToast('success', 'แก้ไขข้อมูลทีมเรียบร้อยแล้ว');
      } else {
        // Create
        await teamService.createTeam(
          {
            event_id: event.id,
            name: teamName.trim(),
            color: teamColor.trim() || teamName.trim(),
            color_hex: teamColorHex,
            status: teamStatus,
            sort_order: teams.length + 1,
          },
          currentUser
        );
        onShowToast('success', 'เพิ่มทีมใหม่เรียบร้อยแล้ว');
      }

      setIsModalOpen(false);
      loadTeams();
    } catch (err: any) {
      console.error('Save team error:', err);
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (team: Team) => {
    try {
      const nextStatus = team.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await teamService.updateTeam(team.id, { status: nextStatus }, currentUser);
      onShowToast(
        'success',
        nextStatus === 'ACTIVE' ? `เปิดใช้งานทีม ${team.name} แล้ว` : `ปิดใช้งานทีม ${team.name} แล้ว`
      );
      loadTeams();
    } catch (err: any) {
      onShowToast('error', err.message || 'ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTeam) return;
    try {
      const res = await teamService.deleteTeam(deletingTeam.id, currentUser);
      onShowToast('success', res.message);
      setDeletingTeam(null);
      loadTeams();
    } catch (err: any) {
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการลบทีม');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= teams.length) return;

    const newTeams = [...teams];
    const [moved] = newTeams.splice(index, 1);
    newTeams.splice(targetIndex, 0, moved);

    setTeams(newTeams);
    const orderedIds = newTeams.map((t) => t.id);
    await teamService.reorderTeams(orderedIds, currentUser);
  };

  const colorPresets = [
    { label: 'Purple', hex: '#8B5CF6' },
    { label: 'Pink', hex: '#EC4899' },
    { label: 'Yellow', hex: '#EAB308' },
    { label: 'Green', hex: '#10B981' },
    { label: 'Blue', hex: '#3B82F6' },
    { label: 'Red', hex: '#EF4444' },
    { label: 'Orange', hex: '#F97316' },
    { label: 'Teal', hex: '#14B8A6' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">จัดการสังกัดทีม (Team Management)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดทีม สีประจำทีม และลำดับการแสดงผลในหน้าลงทะเบียน
          </p>
        </div>
        <button
          id="btn-add-new-team"
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มทีมใหม่ (Add Team)</span>
        </button>
      </div>

      {/* Teams Grid / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center">ลำดับ</th>
                <th className="py-3 px-4">ชื่อทีม</th>
                <th className="py-3 px-4">สีประจำทีม (HEX)</th>
                <th className="py-3 px-4 text-center">จำนวนทีมย่อย</th>
                <th className="py-3 px-4 text-center">ผู้ลงทะเบียน</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    ยังไม่มีข้อมูลทีมในระบบ คลิก "เพิ่มทีมใหม่" เพื่อเริ่มต้น
                  </td>
                </tr>
              ) : (
                teams.map((team, index) => (
                  <tr key={team.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Sort Order buttons */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          id={`btn-team-up-${team.id}`}
                          onClick={() => handleMoveOrder(index, 'up')}
                          disabled={index === 0}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-slate-700">{index + 1}</span>
                        <button
                          id={`btn-team-down-${team.id}`}
                          onClick={() => handleMoveOrder(index, 'down')}
                          disabled={index === teams.length - 1}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Team Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: team.color_hex }}
                        />
                        <span>{team.name}</span>
                      </div>
                    </td>

                    {/* Color Hex */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">
                      <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[11px]">
                        {team.color_hex}
                      </span>
                    </td>

                    {/* Sub Teams Count */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onNavigateToSubTeams(team.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        title="ดูและจัดการทีมย่อย"
                      >
                        <Layers className="w-3 h-3" />
                        <span>{team.sub_teams_count || 0} ทีมย่อย</span>
                      </button>
                    </td>

                    {/* Registrations Count */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {team.registrations_count || 0} คน
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        id={`btn-toggle-team-status-${team.id}`}
                        onClick={() => handleToggleStatus(team)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          team.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {team.status === 'ACTIVE' ? (
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
                          id={`btn-edit-team-${team.id}`}
                          onClick={() => handleOpenEditModal(team)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="แก้ไขข้อมูลทีม"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-delete-team-${team.id}`}
                          onClick={() => setDeletingTeam(team)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="ลบทีม"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT TEAM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
            <button
              id="btn-close-team-modal"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4">
              {editingTeam ? 'แก้ไขข้อมูลทีม' : 'เพิ่มทีมใหม่'}
            </h3>

            <form onSubmit={handleSaveTeam} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  ชื่อทีม (Team Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-team-name"
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="เช่น Team Blue หรือ ทีมสีฟ้า"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  ชื่อสี (Color Name)
                </label>
                <input
                  id="input-team-color-label"
                  type="text"
                  value={teamColor}
                  onChange={(e) => setTeamColor(e.target.value)}
                  placeholder="เช่น Blue หรือ สีฟ้า"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Color Hex & Presets */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  รหัสสี (Color HEX) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="input-team-color-picker"
                    type="color"
                    value={teamColorHex}
                    onChange={(e) => setTeamColorHex(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 p-0.5"
                  />
                  <input
                    id="input-team-color-hex"
                    type="text"
                    required
                    value={teamColorHex}
                    onChange={(e) => setTeamColorHex(e.target.value)}
                    className="flex-1 p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setTeamColorHex(preset.hex)}
                      className="w-5 h-5 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: preset.hex }}
                      title={preset.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  สถานะการใช้งาน
                </label>
                <select
                  id="select-team-status"
                  value={teamStatus}
                  onChange={(e: any) => setTeamStatus(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="ACTIVE">เปิดใช้งาน (ACTIVE)</option>
                  <option value="INACTIVE">ปิดใช้งาน (INACTIVE)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  id="btn-cancel-save-team"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-slate-700 hover:bg-slate-50 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-save-team"
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
        isOpen={Boolean(deletingTeam)}
        title="ยืนยันการลบทีม"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบ "${deletingTeam?.name}"? (หากมีผู้ลงทะเบียนในทีมนี้แล้ว ระบบจะเปลี่ยนเป็นปิดใช้งานแทนการลบถาวร เพื่อปกป้องความถูกต้องของประวัติการลงทะเบียน)`}
        confirmText="ยืนยันการลบ"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingTeam(null)}
      />
    </div>
  );
};
