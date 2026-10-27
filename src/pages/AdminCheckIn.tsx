import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  RefreshCw,
  Camera,
  ArrowRight,
  Flame,
  Gift,
} from 'lucide-react';
import { EventConfig, AdminUser, Registration } from '../types';
import { checkInService, CheckInResult } from '../services/checkInService';
import { registrationService } from '../services/registrationService';
import { subscribeToChanges } from '../services/storage';
import { QRScannerModal } from '../components/QRScannerModal';

interface AdminCheckInProps {
  event: EventConfig;
  currentUser: AdminUser;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AdminCheckIn: React.FC<AdminCheckInProps> = ({
  event,
  currentUser,
  onShowToast,
}) => {
  // Check-in input state
  const [identifierInput, setIdentifierInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Check-in Response Result
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);

  // Live Stats State
  const [stats, setStats] = useState<{
    total: number;
    checkedIn: number;
    notCheckedIn: number;
    percentage: number;
    teamBreakdown: {
      team_id: string;
      team_name: string;
      color_hex: string;
      total: number;
      checked_in: number;
      percentage: number;
    }[];
  } | null>(null);

  // Manual Search Preview
  const [searchPreview, setSearchPreview] = useState<Registration[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadCheckInStats();
    const unsubStorage = subscribeToChanges(() => {
      loadCheckInStats();
    });
    const unsubCheckIns = checkInService.subscribeToCheckIns(() => {
      loadCheckInStats();
    });
    const unsubRegs = registrationService.subscribeToRegistrations(() => {
      loadCheckInStats();
    });
    return () => {
      unsubStorage();
      unsubCheckIns();
      unsubRegs();
    };
  }, [event.id]);

  const loadCheckInStats = async () => {
    try {
      const data = await checkInService.getCheckInStats(event.id);
      setStats(data);
    } catch (err) {
      console.error('Failed to load check-in stats:', err);
    }
  };

  // Search autocomplete for manual search fallback
  useEffect(() => {
    if (!identifierInput.trim() || identifierInput.trim().length < 2) {
      setSearchPreview([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const { data } = await registrationService.getRegistrations(
          { search: identifierInput.trim(), registration_status: 'CONFIRMED' },
          1,
          5
        );
        setSearchPreview(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [identifierInput]);

  // Execute Check-in
  const handleCheckIn = async (identifier: string, method: 'QR_SCAN' | 'MANUAL_SEARCH' = 'MANUAL_SEARCH') => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      onShowToast('warning', 'กรุณาระบุรหัสลงทะเบียนหรือ QR Code');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await checkInService.processCheckIn(trimmed, currentUser, method);
      setLastResult(result);
      setIdentifierInput('');
      setSearchPreview([]);
      loadCheckInStats();

      if (result.success) {
        onShowToast('success', `✓ Check-in สำเร็จ: ${result.registration?.full_name}`);
      } else if (result.isDuplicate) {
        onShowToast('warning', `แจ้งเตือน: ${result.message}`);
      }
    } catch (err: any) {
      console.error('Check-in error:', err);
      const msg = err.message || 'เกิดข้อผิดพลาดในการ Check-in';
      onShowToast('error', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Callback from Camera QR Scanner
  const handleScanSuccess = (decodedText: string) => {
    setIsScannerOpen(false);
    handleCheckIn(decodedText, 'QR_SCAN');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Live Check-in Stats Bar (Prompt Section 28) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
              <Flame className="w-3.5 h-3.5" />
              Live Check-in Station
            </div>
            <h2 className="text-xl font-black text-slate-900">
              สถานีตรวจสอบและ Check-in หน้างาน
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">ลงทะเบียนแล้ว</span>
              <strong className="text-base font-black text-slate-900 font-mono">
                {stats?.total || 0}
              </strong>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[11px]">Check-in แล้ว</span>
              <strong className="text-base font-black text-emerald-600 font-mono">
                {stats?.checkedIn || 0}
              </strong>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[11px]">ยังไม่ Check-in</span>
              <strong className="text-base font-black text-amber-500 font-mono">
                {stats?.notCheckedIn || 0}
              </strong>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[11px]">อัตราส่วน</span>
              <strong className="text-base font-black text-indigo-600 font-mono">
                {stats?.percentage || 0}%
              </strong>
            </div>
          </div>
        </div>

        {/* Dynamic Team Progress Breakdown */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            {stats.teamBreakdown.map((t) => (
              <div key={t.team_id} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="truncate flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color_hex }}
                    />
                    <span className="truncate">{t.team_name}</span>
                  </span>
                  <span className="font-mono text-slate-700">
                    {t.checked_in}/{t.total} ({t.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${t.percentage}%`, backgroundColor: t.color_hex }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Check-In Controls Section (Mode 1 & Mode 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Check-in Actions & Manual Input */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
            {/* Mode 1: Big Camera Scan Trigger Button */}
            <div>
              <button
                id="btn-open-camera-scanner"
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-base shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all transform active:scale-98"
              >
                <Camera className="w-6 h-6 animate-pulse" />
                <span>เปิดกล้องสแกน QR Code (Mode 1 — QR Scanner)</span>
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-slate-200" />
              <span className="shrink mx-4 text-xs text-slate-400 uppercase font-bold tracking-wider">
                หรือ ค้นหาด้วยรหัส / ชื่อ (Mode 2 — Manual Check-in)
              </span>
              <div className="grow border-t border-slate-200" />
            </div>

            {/* Mode 2: Manual Search & Check-in */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                รหัสลงทะเบียน (เช่น SD2026-000001) หรือ ชื่อผู้เข้าร่วม
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    id="input-checkin-search"
                    type="text"
                    value={identifierInput}
                    onChange={(e) => setIdentifierInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCheckIn(identifierInput, 'MANUAL_SEARCH');
                      }
                    }}
                    placeholder="พิมพ์รหัส หรือ ชื่อ-นามสกุล..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
                  />
                </div>
                <button
                  id="btn-trigger-manual-checkin"
                  type="button"
                  onClick={() => handleCheckIn(identifierInput, 'MANUAL_SEARCH')}
                  disabled={isProcessing || !identifierInput.trim()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>CHECK-IN</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Search Suggestions Dropdown */}
              {searchPreview.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-md divide-y divide-slate-100 animate-in fade-in duration-100">
                  {searchPreview.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleCheckIn(item.registration_code, 'MANUAL_SEARCH')}
                      className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 mr-2">
                          {item.registration_code}
                        </span>
                        {item.lucky_number && (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md mr-2">
                            <Gift className="w-3 h-3 text-amber-600" />
                            {item.lucky_number}
                          </span>
                        )}
                        <span className="font-semibold text-xs text-slate-800">
                          {item.full_name}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-2">
                          ({item.team_name_snapshot} {item.sub_team_name_snapshot && `- ${item.sub_team_name_snapshot}`})
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          item.check_in_status === 'CHECKED_IN'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.check_in_status === 'CHECKED_IN' ? 'เช็คอินแล้ว' : 'ยังไม่เช็คอิน'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Check-in Result Card (Success or Duplicate Warning) */}
        <div className="lg:col-span-5">
          {lastResult ? (
            <div
              id="checkin-result-card"
              className={`rounded-3xl border p-6 shadow-lg animate-in fade-in zoom-in duration-200 ${
                lastResult.success
                  ? 'bg-emerald-50/50 border-emerald-300'
                  : 'bg-amber-50/70 border-amber-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-2xl shrink-0 ${
                    lastResult.success
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {lastResult.success ? (
                    <CheckCircle2 className="w-8 h-8" />
                  ) : (
                    <AlertTriangle className="w-8 h-8" />
                  )}
                </div>

                <div className="flex-1">
                  <h3
                    className={`text-lg font-black uppercase tracking-tight ${
                      lastResult.success ? 'text-emerald-900' : 'text-amber-900'
                    }`}
                  >
                    {lastResult.success ? '✓ CHECK-IN SUCCESS' : 'แจ้งเตือน: ตรวจสอบแล้ว'}
                  </h3>
                  <p
                    className={`text-xs font-semibold mt-0.5 ${
                      lastResult.success ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {lastResult.message}
                  </p>
                </div>
              </div>

              {/* Participant Profile Card */}
              {lastResult.registration && (
                <div className="mt-5 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                  {/* HIGH VISIBILITY LUCKY DRAW PRIZE CARD FOR CHECK-IN STAFF */}
                  <div className="p-4 bg-gradient-to-r from-amber-500/15 via-yellow-400/25 to-amber-500/15 border-2 border-amber-400 rounded-2xl text-center shadow-inner">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-amber-900 tracking-wider">
                      <Gift className="w-4 h-4 text-amber-600" />
                      <span>หมายเลขรับของรางวัล (LUCKY DRAW NUMBER)</span>
                    </div>
                    {lastResult.registration.lucky_number ? (
                      <div className="mt-1">
                        <div className="font-mono text-4xl sm:text-5xl font-black text-amber-950 tracking-widest py-1 drop-shadow-xs">
                          {lastResult.registration.lucky_number}
                        </div>
                        <p className="text-[11px] font-bold text-amber-800">
                          ★ มอบของรางวัลตามหมายเลขนี้ในตอน Check-in เข้างาน ★
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-800/80 font-medium py-1.5">
                        ยังไม่ได้รับหมายเลขสุ่มของรางวัล
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-xs text-slate-400 uppercase font-semibold">
                      Registration ID
                    </span>
                    <span className="font-mono font-black text-base text-slate-900">
                      {lastResult.registration.registration_code}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block">ชื่อ-นามสกุล</span>
                    <span className="text-base font-bold text-slate-900">
                      {lastResult.registration.full_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-400 block">สังกัดทีม</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              lastResult.registration.team_color_hex || '#6366f1',
                          }}
                        />
                        <span className="text-xs font-bold text-slate-800">
                          {lastResult.registration.team_name_snapshot ||
                            (lastResult.registration as any).team_name}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">กลุ่ม / ทีมย่อย</span>
                      <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                        {lastResult.registration.sub_team_name_snapshot ||
                          (lastResult.registration as any).sub_team_name ||
                          '-'}
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Info (Prompt Section 26) */}
                  {lastResult.isDuplicate && (
                    <div className="mt-3 p-3 bg-amber-100/60 rounded-xl text-xs text-amber-900 space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        เวลาที่ Check-in ครั้งแรก:
                      </p>
                      <p className="font-mono pl-4.5">
                        {lastResult.firstCheckInTime
                          ? new Date(lastResult.firstCheckInTime).toLocaleString('th-TH')
                          : '-'}
                      </p>
                      {lastResult.checkedInBy && (
                        <p className="text-[11px] text-amber-800 pl-4.5">
                          โดยเจ้าหน้าที่: {lastResult.checkedInBy}
                        </p>
                      )}
                    </div>
                  )}

                  {lastResult.success && (
                    <div className="mt-2 text-right text-[11px] text-slate-400 font-mono">
                      Check-in เมื่อ:{' '}
                      {new Date(lastResult.firstCheckInTime || '').toLocaleTimeString('th-TH')}
                    </div>
                  )}

                  {/* Quick Action: Scan Next Participant */}
                  <div className="pt-2">
                    <button
                      id="btn-scan-next-participant"
                      type="button"
                      onClick={() => {
                        setLastResult(null);
                        setIsScannerOpen(true);
                      }}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>สแกน QR Code คนถัดไป</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full min-h-[260px]">
              <QrCode className="w-12 h-12 text-slate-300 mb-2" />
              <p className="font-medium text-xs">พร้อมสำหรับการ Check-in</p>
              <p className="text-[11px] text-slate-400 mt-1">
                สแกน QR Code หรือค้นหารหัสผู้เข้าร่วมเพื่อเริ่มการบันทึก
              </p>
            </div>
          )}
        </div>
      </div>

      {/* QR CAMERA SCANNER MODAL */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onScanSuccess={handleScanSuccess}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
};
