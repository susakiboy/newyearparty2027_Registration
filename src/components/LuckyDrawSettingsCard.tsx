import React, { useState, useEffect } from 'react';
import {
  Gift,
  Save,
  Shuffle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  Layers,
  Users,
  Award,
} from 'lucide-react';
import { EventConfig, AdminUser, LuckyDrawConfig, LuckyDrawStats } from '../types';
import { luckyDrawService, DEFAULT_LUCKY_CONFIG } from '../services/luckyDrawService';
import { ConfirmDialog } from './ConfirmDialog';

interface LuckyDrawSettingsCardProps {
  event: EventConfig;
  currentUser: AdminUser;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const LuckyDrawSettingsCard: React.FC<LuckyDrawSettingsCardProps> = ({
  event,
  currentUser,
  onShowToast,
}) => {
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const [config, setConfig] = useState<LuckyDrawConfig>(DEFAULT_LUCKY_CONFIG);
  const [stats, setStats] = useState<LuckyDrawStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Dialogs
  const [isReRandomizeConfirmOpen, setIsReRandomizeConfirmOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  useEffect(() => {
    loadConfigAndStats();
  }, [event.id, event.description]);

  const loadConfigAndStats = async () => {
    try {
      setIsLoading(true);
      const [cfg, st] = await Promise.all([
        luckyDrawService.getConfig(event),
        luckyDrawService.getStats(event.id),
      ]);
      setConfig(cfg);
      setStats(st);
    } catch (err) {
      console.error('Failed to load lucky draw settings/stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      onShowToast('error', 'สิทธิ์ไม่เพียงพอ: เฉพาะ Super Admin เท่านั้นที่สามารถตั้งค่าส่วนนี้ได้');
      return;
    }

    if (config.start_number < 1) {
      onShowToast('warning', 'หมายเลขเริ่มต้นต้องมากกว่าหรือเท่ากับ 1');
      return;
    }

    if (config.end_number <= config.start_number) {
      onShowToast('warning', 'หมายเลขสิ้นสุดต้องมากกว่าหมายเลขเริ่มต้น');
      return;
    }

    try {
      setIsSaving(true);
      const saved = await luckyDrawService.saveConfig(config, currentUser);
      setConfig(saved);
      const st = await luckyDrawService.getStats(event.id);
      setStats(st);
      onShowToast('success', 'บันทึกการตั้งค่าระบบสุ่มหมายเลขของรางวัลลง Supabase เรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Save lucky draw config error:', err);
      onShowToast('error', err.message || 'ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setIsSaving(false);
    }
  };

  // 1. Batch Randomize Unassigned
  const handleBatchRandomize = async () => {
    if (!isSuperAdmin) {
      onShowToast('error', 'เฉพาะ Super Admin เท่านั้นที่สามารถสุ่มหมายเลขได้');
      return;
    }

    try {
      setIsBatchRunning(true);
      const res = await luckyDrawService.batchRandomizeUnassigned(event.id, currentUser);
      onShowToast(
        'success',
        `✓ สุ่มหมายเลขของรางวัลให้ผู้ลงทะเบียนใหม่ ${res.assignedCount} คน เรียบร้อยแล้ว (ไม่ซ้ำกัน)`
      );
      loadConfigAndStats();
    } catch (err: any) {
      console.error('Batch randomize error:', err);
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการสุ่มหมายเลข');
    } finally {
      setIsBatchRunning(false);
    }
  };

  // 2. Re-randomize All
  const handleConfirmReRandomizeAll = async () => {
    try {
      setIsBatchRunning(true);
      const res = await luckyDrawService.reRandomizeAll(event.id, currentUser);
      setIsReRandomizeConfirmOpen(false);
      onShowToast('success', `✓ สุ่มหมายเลขใหม่ให้ผู้ลงทะเบียนทุกคน ${res.assignedCount} คน เรียบร้อยแล้ว`);
      loadConfigAndStats();
    } catch (err: any) {
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการสุ่มใหม่ทั้งหมด');
    } finally {
      setIsBatchRunning(false);
    }
  };

  // 3. Clear All
  const handleConfirmClearAll = async () => {
    try {
      setIsBatchRunning(true);
      const res = await luckyDrawService.clearAllLuckyNumbers(event.id, currentUser);
      setIsClearConfirmOpen(false);
      onShowToast('success', `✓ ล้างหมายเลขของรางวัลทั้งหมด ${res.clearedCount} รายการเรียบร้อยแล้ว`);
      loadConfigAndStats();
    } catch (err: any) {
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการล้างหมายเลข');
    } finally {
      setIsBatchRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-md p-6 space-y-6 text-xs relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-yellow-600 text-white rounded-2xl shadow-sm">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900">
                ระบบสุ่มหมายเลขของรางวัล (Lucky Draw Numbers)
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Award className="w-3 h-3 text-amber-700" />
                Super Admin Only
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              กำหนดช่วงตัวเลข สุ่มหมายเลขของรางวัลห้ามซ้ำกัน แสดงผลในบัตร Official Pass ตัวใหญ่หนา สำหรับรับรางวัลตอน Check-in
            </p>
          </div>
        </div>

        {/* Enable / Disable Toggle */}
        <button
          id="btn-toggle-lucky-draw"
          type="button"
          disabled={!isSuperAdmin || isSaving}
          onClick={() => {
            if (!isSuperAdmin) return;
            const updated = { ...config, enabled: !config.enabled };
            setConfig(updated);
            luckyDrawService.saveConfig(updated, currentUser).then(() => {
              onShowToast('info', updated.enabled ? 'เปิดใช้งานระบบสุ่มรางวัล' : 'ปิดใช้งานระบบสุ่มรางวัล');
            });
          }}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-bold transition-all ${
            config.enabled
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-slate-100 text-slate-600 border border-slate-300'
          }`}
        >
          {config.enabled ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>เปิดใช้งาน (Active)</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>ปิดใช้งาน (Disabled)</span>
            </>
          )}
        </button>
      </div>

      {/* Permission Warning if not Super Admin */}
      {!isSuperAdmin && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            บัญชีของคุณไม่ใช่ <strong>SUPER_ADMIN</strong> สามารถดูสถิติได้เท่านั้น หากต้องการเปลี่ยนแปลงช่วงตัวเลขหรือสั่งสุ่มหมายเลข กรุณาเข้าสู่ระบบด้วยบัญชี Super Admin
          </span>
        </div>
      )}

      {/* Statistics Tiles */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-slate-400 font-semibold block text-[11px]">ผู้ลงทะเบียนทั้งหมด</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
              {stats.totalRegistrations}
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200">
            <span className="text-emerald-700 font-semibold block text-[11px]">ได้รับหมายเลขรางวัลแล้ว</span>
            <span className="text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
              {stats.assignedCount}
            </span>
          </div>

          <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200">
            <span className="text-amber-700 font-semibold block text-[11px]">ยังไม่ได้รับหมายเลข</span>
            <span className="text-2xl font-black text-amber-900 font-mono mt-0.5 block">
              {stats.unassignedCount}
            </span>
          </div>

          <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200">
            <span className="text-indigo-700 font-semibold block text-[11px]">โควตาคงเหลือที่สุ่มได้</span>
            <span className="text-2xl font-black text-indigo-900 font-mono mt-0.5 block">
              {stats.remainingPoolCapacity} / {stats.totalPoolCapacity}
            </span>
          </div>
        </div>
      )}

      {/* Form Settings */}
      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Start Number */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              หมายเลขเริ่มต้น <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-lucky-start"
              type="number"
              min="1"
              required
              disabled={!isSuperAdmin || isSaving}
              value={config.start_number}
              onChange={(e) => setConfig({ ...config, start_number: parseInt(e.target.value, 10) || 1 })}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* End Number */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              หมายเลขสิ้นสุด <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-lucky-end"
              type="number"
              min="1"
              required
              disabled={!isSuperAdmin || isSaving}
              value={config.end_number}
              onChange={(e) => setConfig({ ...config, end_number: parseInt(e.target.value, 10) || 1 })}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Digits Padding */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              จำนวนหลัก (Digits) <span className="text-rose-500">*</span>
            </label>
            <select
              id="select-lucky-digits"
              disabled={!isSuperAdmin || isSaving}
              value={config.digits}
              onChange={(e) => setConfig({ ...config, digits: parseInt(e.target.value, 10) || 3 })}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="1">1 หลัก (1, 2, 9...)</option>
              <option value="2">2 หลัก (01, 02...)</option>
              <option value="3">3 หลัก (001, 002...)</option>
              <option value="4">4 หลัก (0001, 0002...)</option>
              <option value="5">5 หลัก (00001...)</option>
            </select>
          </div>

          {/* Optional Prefix */}
          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              คำนำหน้า (Prefix)
            </label>
            <input
              id="input-lucky-prefix"
              type="text"
              placeholder="เช่น L- หรือเว้นว่าง"
              disabled={!isSuperAdmin || isSaving}
              value={config.prefix}
              onChange={(e) => setConfig({ ...config, prefix: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Auto Assign Toggle & Prize Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-2xl border border-amber-200">
            <input
              id="checkbox-auto-assign"
              type="checkbox"
              disabled={!isSuperAdmin || isSaving}
              checked={config.auto_assign_on_register}
              onChange={(e) => setConfig({ ...config, auto_assign_on_register: e.target.checked })}
              className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500"
            />
            <label htmlFor="checkbox-auto-assign" className="cursor-pointer font-bold text-slate-800">
              สุ่มหมายเลขให้อัตโนมัติทันทีเมื่อมีผู้ลงทะเบียนใหม่
              <span className="block text-[11px] font-normal text-slate-500">
                หากเปิดใช้งาน ผู้ที่ลงทะเบียนสำเร็จจะได้รับหมายเลขรางวัลไม่ซ้ำกันทันที
              </span>
            </label>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              ข้อความกำกับของรางวัลบนบัตร Official Pass
            </label>
            <input
              id="input-lucky-note"
              type="text"
              disabled={!isSuperAdmin || isSaving}
              value={config.prize_note || ''}
              onChange={(e) => setConfig({ ...config, prize_note: e.target.value })}
              placeholder="นำหมายเลขนี้ไปแสดงเพื่อรับของรางวัลตอน Check-in เข้างาน"
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        {/* Save Config Button */}
        {isSuperAdmin && (
          <div className="flex justify-end pt-2">
            <button
              id="btn-save-lucky-config"
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าตัวเลขรางวัล'}</span>
            </button>
          </div>
        )}
      </form>

      {/* Immediate Batch Action Panel for Super Admin */}
      {isSuperAdmin && (
        <div className="pt-4 border-t border-amber-200 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <Shuffle className="w-4 h-4 text-amber-600" />
            <span>คำสั่งดำเนินการสุ่มหมายเลขรางวัล (Batch Execution)</span>
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            ระบบจะทำการสุ่มหมายเลขจากช่วงที่กำหนดแบบ <strong>ห้ามซ้ำกันเด็ดขาด (Strict Unique Non-repetitive)</strong> และบันทึกลงฐานข้อมูล Supabase โดยตรงทันที
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* 1. Batch Randomize Unassigned */}
            <button
              id="btn-batch-randomize-unassigned"
              type="button"
              disabled={isBatchRunning || !config.enabled}
              onClick={handleBatchRandomize}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white rounded-xl font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isBatchRunning ? 'กำลังประมวลผล...' : `สุ่มเลขให้ผู้ที่ยังไม่มีเลขทุกคน (${stats?.unassignedCount || 0} คน)`}
              </span>
            </button>

            {/* 2. Re-randomize All */}
            <button
              id="btn-trigger-rerandomize-all"
              type="button"
              disabled={isBatchRunning || !config.enabled || (stats?.totalRegistrations || 0) === 0}
              onClick={() => setIsReRandomizeConfirmOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>สุ่มใหม่ทั้งหมด (ทุกคน)</span>
            </button>

            {/* 3. Clear All */}
            <button
              id="btn-trigger-clear-all-lucky"
              type="button"
              disabled={isBatchRunning || (stats?.assignedCount || 0) === 0}
              onClick={() => setIsClearConfirmOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl font-semibold transition-colors ml-auto disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>ล้างหมายเลขทั้งหมด</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={isReRandomizeConfirmOpen}
        title="ยืนยันการสุ่มหมายเลขใหม่ทั้งหมด"
        message="การดำเนินการนี้จะทำการล้างหมายเลขรางวัลเดิมของผู้ลงทะเบียนทุกคน แล้วสุ่มหมายเลขรางวัลชุดใหม่ให้ทุกคนใหม่ทั้งหมด โดยตัวเลขจะถูกบันทึกลงในฐานข้อมูล Supabase ทันที คุณต้องการดำเนินการต่อหรือไม่?"
        confirmText="ยืนยัน สุ่มใหม่ทั้งหมด"
        isDestructive={false}
        isLoading={isBatchRunning}
        onConfirm={handleConfirmReRandomizeAll}
        onCancel={() => setIsReRandomizeConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        title="ยืนยันการล้างหมายเลขของรางวัลทั้งหมด"
        message="การดำเนินการนี้จะล้างหมายเลขของรางวัลออกจากผู้ลงทะเบียนทุกคนในฐานข้อมูล Supabase คุณแน่ใจหรือไม่?"
        confirmText="ยืนยัน ล้างหมายเลขทั้งหมด"
        isDestructive={true}
        isLoading={isBatchRunning}
        onConfirm={handleConfirmClearAll}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
};
