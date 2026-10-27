import React, { useState } from 'react';
import {
  Settings,
  Save,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { EventConfig, AdminUser } from '../types';
import { eventService } from '../services/eventService';
import { resetToInitialDemoData } from '../services/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SupabaseConfigCard } from '../components/SupabaseConfigCard';
import { LuckyDrawSettingsCard } from '../components/LuckyDrawSettingsCard';

interface AdminSettingsProps {
  event: EventConfig;
  currentUser: AdminUser;
  onEventUpdated: (updated: EventConfig) => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  event,
  currentUser,
  onEventUpdated,
  onShowToast,
}) => {
  // Form State
  const [name, setName] = useState(event.name);
  const [year, setYear] = useState(event.year);
  const [description, setDescription] = useState(
    (event.description || '').replace(/\n?<!--LUCKY_CONFIG:(.*?)-->/s, '').trim()
  );
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(event.registration_open);
  const [regStart, setRegStart] = useState(event.registration_start ? event.registration_start.slice(0, 16) : '');
  const [regEnd, setRegEnd] = useState(event.registration_end ? event.registration_end.slice(0, 16) : '');
  const [successMessage, setSuccessMessage] = useState(event.success_message || '');
  const [isSaving, setIsSaving] = useState(false);

  // System Reset State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('warning', 'กรุณาระบุชื่องาน');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await eventService.updateEvent(
        event.id,
        {
          name: name.trim(),
          year: year.trim() || '2026',
          description: description.trim(),
          registration_open: isRegistrationOpen,
          registration_start: regStart ? new Date(regStart).toISOString() : null,
          registration_end: regEnd ? new Date(regEnd).toISOString() : null,
          success_message: successMessage.trim(),
        },
        currentUser
      );

      onEventUpdated(updated);
      onShowToast('success', 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Settings update error:', err);
      onShowToast('error', err.message || 'ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmResetData = async () => {
    try {
      setIsResetting(true);
      resetToInitialDemoData();
      onShowToast('success', 'รีเซ็ตข้อมูลตัวอย่างเรียบร้อยแล้ว');
      setIsResetConfirmOpen(false);
      window.location.reload();
    } catch (err) {
      onShowToast('error', 'เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          ตั้งค่าระบบและกิจกรรม (Event Settings)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          กำหนดการเชื่อมต่อฐานข้อมูลคลาวด์ Supabase, ข้อมูลกิจกรรม, ช่วงเวลาเปิดรับลงทะเบียน และการตั้งค่าความปลอดภัย
        </p>
      </div>

      {/* Supabase Cloud Connection & Persistence Settings */}
      <SupabaseConfigCard onShowToast={onShowToast} />

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Main Settings Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 pb-3 border-b border-slate-100">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>ข้อมูลพื้นฐานของกิจกรรม (Event Information)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase mb-1">
                ชื่องานกิจกรรม (Event Name) <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-setting-event-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                ปีประจำกิจกรรม (Year) <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-setting-event-year"
                type="text"
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">คำบรรยายกิจกรรม</label>
            <textarea
              id="input-setting-event-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Registration Window & Status Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>การเปิด-ปิดระบบลงทะเบียน (Registration Window)</span>
            </div>

            {/* Toggle switch */}
            <button
              id="btn-toggle-reg-open"
              type="button"
              onClick={() => setIsRegistrationOpen(!isRegistrationOpen)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs transition-colors ${
                isRegistrationOpen
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-300'
              }`}
            >
              {isRegistrationOpen ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>เปิดรับลงทะเบียน (OPEN)</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>ปิดรับลงทะเบียน (CLOSED)</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                วัน-เวลาเริ่มต้นเปิดรับลงทะเบียน
              </label>
              <input
                id="input-setting-reg-start"
                type="datetime-local"
                value={regStart}
                onChange={(e) => setRegStart(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                วัน-เวลาสิ้นสุดการรับลงทะเบียน
              </label>
              <input
                id="input-setting-reg-end"
                type="datetime-local"
                value={regEnd}
                onChange={(e) => setRegEnd(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              ข้อความแจ้งผู้เข้าร่วมเมื่อลงทะเบียนสำเร็จ (Success Message)
            </label>
            <input
              id="input-setting-success-msg"
              type="text"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            id="btn-save-settings"
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
          </button>
        </div>
      </form>

      {/* Super Admin Lucky Draw Prize Numbers Configuration & Execution */}
      <LuckyDrawSettingsCard
        event={event}
        currentUser={currentUser}
        onShowToast={onShowToast}
      />

      {/* Danger Zone: Reset Data */}
      <div className="bg-rose-50/50 rounded-3xl border border-rose-200 p-6 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>Danger Zone: รีเซ็ตข้อมูลผู้ลงทะเบียน</span>
        </div>
        <p className="text-xs text-rose-700 leading-relaxed">
          การรีเซ็ตจะล้างเฉพาะข้อมูลการลงทะเบียนและประวัติการ Check-in ทั้งหมด เพื่อเตรียมรับข้อมูลรอบใหม่ โดยระบบจะ<strong>คงรายชื่อทีมและทีมย่อยทั้งหมดไว้ตามเดิม ห้ามลบเด็ดขาด</strong>
        </p>
        <button
          id="btn-trigger-reset-demo"
          type="button"
          onClick={() => setIsResetConfirmOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>รีเซ็ตข้อมูลตัวอย่าง (คงทีมและทีมย่อยไว้)</span>
        </button>
      </div>

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="ยืนยันการรีเซ็ตข้อมูลระบบ"
        message="การดำเนินการนี้จะล้างข้อมูลผู้ลงทะเบียนและประวัติการ Check-in ทั้งหมด โดยจะคงรายชื่อทีมและทีมย่อยทั้งหมดไว้เช่นเดิมอย่างปลอดภัย (ไม่ถูกลบ) คุณแน่ใจหรือไม่?"
        confirmText="ยืนยันการรีเซ็ต"
        isDestructive={true}
        isLoading={isResetting}
        onConfirm={handleConfirmResetData}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
