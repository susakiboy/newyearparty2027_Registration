import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  User,
  Users,
  Layers,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Printer,
  Download,
  RotateCcw,
  Sparkles,
  Lock,
  ArrowRight,
  ShieldAlert,
  Gift,
} from 'lucide-react';
import { EventConfig, Team, SubTeam, Registration } from '../types';
import { eventService } from './../services/eventService';
import { teamService } from './../services/teamService';
import { subTeamService } from './../services/subTeamService';
import { registrationService } from './../services/registrationService';
import { QRCodeModal } from '../components/QRCodeModal';
import { HealthCheckResult } from '../services/healthService';

interface PublicRegistrationProps {
  onNavigateToAdmin: () => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
  connectionHealth?: HealthCheckResult | null;
  onTestConnection?: () => void;
}

export const PublicRegistration: React.FC<PublicRegistrationProps> = ({
  onNavigateToAdmin,
  onShowToast,
  connectionHealth,
  onTestConnection,
}) => {
  // Event & Teams Data
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [subTeams, setSubTeams] = useState<SubTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedSubTeamId, setSelectedSubTeamId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Registration | null>(null);

  // Success Screen State
  const [registeredResult, setRegisteredResult] = useState<Registration | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Real-time Duplicate Check across Event Registrations
  useEffect(() => {
    let isCurrent = true;
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (trimmedFirst.length >= 2 && trimmedLast.length >= 2 && event) {
      registrationService.checkDuplicate(trimmedFirst, trimmedLast, event.id).then((existing) => {
        if (!isCurrent) return;
        setDuplicateWarning(existing);
        if (existing) {
          setErrorMessage(
            `ห้ามทำการบันทึกซ้ำเด็ดขาด! พบรายชื่อ "${trimmedFirst} ${trimmedLast}" ลงทะเบียนในระบบแล้ว (รหัส: ${existing.registration_code})`
          );
        } else {
          setErrorMessage((prev) => (prev && prev.includes('ห้ามทำการบันทึกซ้ำ') ? null : prev));
        }
      });
    } else {
      setDuplicateWarning(null);
      setErrorMessage((prev) => (prev && prev.includes('ห้ามทำการบันทึกซ้ำ') ? null : prev));
    }
    return () => {
      isCurrent = false;
    };
  }, [firstName, lastName, event]);

  // Load active event and teams
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const activeEvent = await eventService.getActiveEvent();
      setEvent(activeEvent);

      if (activeEvent) {
        const activeTeams = await teamService.getActiveTeams(activeEvent.id);
        setTeams(activeTeams);
      }
    } catch (err: any) {
      console.error('Failed to load event data:', err);
      onShowToast('error', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic Sub-Team Logic (Prompt Section 9):
  // When user selects Team, query DB for active sub teams of that team.
  useEffect(() => {
    const fetchSubTeams = async () => {
      setSelectedSubTeamId('');
      if (!selectedTeamId) {
        setSubTeams([]);
        return;
      }

      try {
        const activeSubs = await subTeamService.getActiveSubTeams(selectedTeamId);
        setSubTeams(activeSubs);
      } catch (err) {
        console.error('Failed to load sub-teams:', err);
        setSubTeams([]);
      }
    };

    fetchSubTeams();
  }, [selectedTeamId]);

  // Selected Team Info & Dynamic Color UI (Prompt Section 10)
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const teamColorHex = selectedTeam ? selectedTeam.color_hex : '#6366F1'; // Default Indigo

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) {
      setErrorMessage('กรุณากรอกชื่อจริง');
      return;
    }
    if (!trimmedLast) {
      setErrorMessage('กรุณากรอกนามสกุล');
      return;
    }
    if (!selectedTeamId) {
      setErrorMessage('กรุณาเลือกบริษัท');
      return;
    }
    if (subTeams.length > 0 && !selectedSubTeamId) {
      setErrorMessage('กรุณาเลือกสาขาย่อย / โรงงาน');
      return;
    }

    if (!event) return;

    // Strict Duplicate Check (ห้ามบันทึกซ้ำเด็ดขาด)
    const duplicate = await registrationService.checkDuplicate(trimmedFirst, trimmedLast, event.id);
    if (duplicate) {
      const errText = `ห้ามทำการบันทึกซ้ำเด็ดขาด! พบรายชื่อ "${trimmedFirst} ${trimmedLast}" ได้ลงทะเบียนไว้แล้วในระบบ (รหัส: ${duplicate.registration_code}, บริษัท: ${duplicate.team_name_snapshot || 'ไม่ระบุ'})`;
      setErrorMessage(errText);
      setDuplicateWarning(duplicate);
      onShowToast('error', errText);
      return;
    }

    // Check if open
    const statusCheck = eventService.isRegistrationCurrentlyOpen(event);
    if (!statusCheck.isOpen) {
      setErrorMessage(statusCheck.reason || 'ขณะนี้ระบบปิดรับลงทะเบียน');
      return;
    }

    try {
      setIsSubmitting(true);
      const newRegistration = await registrationService.register({
        eventId: event.id,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        teamId: selectedTeamId,
        subTeamId: subTeams.length > 0 ? selectedSubTeamId : null,
      });

      setRegisteredResult(newRegistration);

      // Trigger celebratory confetti effect
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: [teamColorHex, '#10B981', '#F59E0B', '#3B82F6'],
        });
      } catch {
        // Confetti fallback
      }

      onShowToast('success', 'ลงทะเบียนสำเร็จ! กรุณาบันทึกรหัสและ QR Code');
    } catch (err: any) {
      console.error('Registration failed:', err);
      const msg = err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน';
      setErrorMessage(msg);
      onShowToast('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFirstName('');
    setLastName('');
    setSelectedTeamId('');
    setSelectedSubTeamId('');
    setRegisteredResult(null);
    setErrorMessage(null);
    setDuplicateWarning(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-sm">กำลังโหลดข้อมูลระบบลงทะเบียน...</p>
      </div>
    );
  }

  const isRegistrationOpen = event ? eventService.isRegistrationCurrentlyOpen(event).isOpen : false;

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-100 via-slate-50 to-white text-slate-900 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Bar Navigation */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between no-print">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200 transition-colors duration-300"
            style={{ backgroundColor: teamColorHex }}
          >
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
              {event?.name || 'NEW YEAR PARTY'} {event?.year || '2027'}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">ระบบลงทะเบียนและตรวจสอบรายชื่อ</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Cloud Status Badge */}
          <div
            title={connectionHealth?.message || 'สถานะการเชื่อมต่อระบบ'}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              connectionHealth?.databaseConnected && connectionHealth?.authConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : connectionHealth?.isConfigured
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionHealth?.databaseConnected && connectionHealth?.authConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionHealth?.isConfigured
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
            />
            <span>
              {connectionHealth?.databaseConnected && connectionHealth?.authConnected
                ? 'Cloud Sync'
                : connectionHealth?.isConfigured
                ? 'Supabase Error'
                : 'Local Mode'}
            </span>
          </div>

          <button
            id="btn-nav-to-admin"
            onClick={onNavigateToAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
          >
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>สำหรับเจ้าหน้าที่</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center my-6">
        {/* SUCCESS VIEW (Prompt Section 14, 15) */}
        {registeredResult ? (
          <div
            id="registration-success-card"
            className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200"
          >
            {/* Top Color Header */}
            <div
              className="p-6 sm:p-8 text-white text-center transition-colors duration-300 relative overflow-hidden"
              style={{ backgroundColor: teamColorHex }}
            >
              <div className="w-16 h-16 bg-white/20 backdrop-blur-xs rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">ลงทะเบียนสำเร็จ!</h2>
              <p className="text-white/90 text-sm mt-1">REGISTRATION SUCCESSFUL</p>
              <div className="mt-3 inline-block px-4 py-1 rounded-full bg-white/25 text-xs font-bold tracking-widest uppercase">
                {event?.name} {event?.year}
              </div>
            </div>

            {/* Content Details */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Registration Code Showcase */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Registration ID (รหัสประจำตัว)
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900 tracking-wider mt-1 block">
                  {registeredResult.registration_code}
                </span>
              </div>

              {/* Lucky Draw Prize Number Showcase */}
              {registeredResult.lucky_number && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-yellow-500/10 border-2 border-amber-400 rounded-2xl p-4 text-center shadow-xs">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-amber-800 tracking-wider">
                    <Gift className="w-4 h-4 text-amber-600" />
                    <span>หมายเลขลุ้นของรางวัล (LUCKY DRAW NUMBER)</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-mono font-black text-amber-950 tracking-widest mt-1">
                    {registeredResult.lucky_number}
                  </div>
                  <p className="text-[11px] font-bold text-amber-800 mt-1">
                    ★ แสดงหมายเลขนี้เพื่อรับของรางวัลตอน Check-in เข้างาน ★
                  </p>
                </div>
              )}

              {/* Participant Profile Details */}
              <div className="divide-y divide-slate-100 text-sm">
                <div className="py-3 flex justify-between items-center">
                  <span className="text-slate-500">ชื่อ-นามสกุล</span>
                  <span className="font-bold text-slate-900 text-base">{registeredResult.full_name}</span>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <span className="text-slate-500">บริษัท</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: teamColorHex }}
                    />
                    <span className="font-bold text-slate-900">
                      {registeredResult.team_name_snapshot}
                    </span>
                  </div>
                </div>
                {registeredResult.sub_team_name_snapshot && (
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-slate-500">สาขาย่อย</span>
                    <span className="font-semibold text-slate-800">
                      {registeredResult.sub_team_name_snapshot}
                    </span>
                  </div>
                )}
                <div className="py-3 flex justify-between items-center">
                  <span className="text-slate-500">เวลาที่ลงทะเบียน</span>
                  <span className="text-slate-600 font-mono text-xs">
                    {new Date(registeredResult.registered_at).toLocaleString('th-TH')}
                  </span>
                </div>
              </div>

              {/* Event Success Message */}
              {event?.success_message && (
                <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
                  {event.success_message}
                </div>
              )}

              {/* Action Buttons: QR Card, Download, Register Another */}
              <div className="space-y-2.5 pt-2">
                <button
                  id="btn-view-qr-pass"
                  type="button"
                  onClick={() => setIsQRModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-md transition-all duration-200 transform active:scale-98"
                  style={{ backgroundColor: teamColorHex }}
                >
                  <QrCode className="w-5 h-5" />
                  <span>ดู QR Code & บัตรประจำตัว (Print / Save)</span>
                </button>

                <button
                  id="btn-register-another"
                  type="button"
                  onClick={handleResetForm}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>ลงทะเบียนบุคคลอื่น (Register Another Person)</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* REGISTRATION FORM VIEW */
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Form Top Banner */}
            <div
              className="p-6 sm:p-8 text-white relative transition-colors duration-300 overflow-hidden"
              style={{ backgroundColor: teamColorHex }}
            >
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>New Year Party 2027</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                {event?.name || 'NEW YEAR PARTY'} {event?.year || '2027'}
              </h2>
              <p className="text-white/90 text-sm mt-1">
                {(event?.description || '')
                  .replace(/\n?<!--.*?-->/gs, '')
                  .trim() || 'ร่วมสังสรรค์รับวันปีใหม่ ประจำปี 2570 พร้อมของรางวัลมากมาย'}
              </p>
            </div>

            {/* Form Body */}
            <div className="p-6 sm:p-8">
              {!isRegistrationOpen ? (
                <div
                  id="registration-closed-notice"
                  className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3"
                >
                  <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
                  <h3 className="text-lg font-bold text-amber-900">ขณะนี้ระบบปิดรับลงทะเบียน</h3>
                  <p className="text-sm text-amber-700">
                    การลงทะเบียนสำหรับกิจกรรมนี้ได้ปิดระบบเรียบร้อยแล้ว หรืออยู่นอกช่วงเวลาที่กำหนด
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {errorMessage && (
                    <div
                      id="form-error-alert"
                      className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-sm animate-in fade-in duration-150"
                    >
                      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* First Name & Last Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="input-first-name"
                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                      >
                        ชื่อจริง (First Name) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          id="input-first-name"
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="เช่น สมชาย"
                          className={`w-full pl-10 pr-3.5 py-3 rounded-xl border text-sm focus:outline-none transition-all ${
                            duplicateWarning
                              ? 'border-rose-400 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/30'
                              : 'border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="input-last-name"
                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                      >
                        นามสกุล (Last Name) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          id="input-last-name"
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="เช่น ใจดี"
                          className={`w-full pl-10 pr-3.5 py-3 rounded-xl border text-sm focus:outline-none transition-all ${
                            duplicateWarning
                              ? 'border-rose-400 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/30'
                              : 'border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Real-Time Duplicate Warning Alert */}
                  {duplicateWarning && (
                    <div
                      id="duplicate-warning-banner"
                      className="p-4 bg-rose-50/90 border-2 border-rose-300 rounded-2xl flex items-start gap-3.5 text-rose-900 animate-in fade-in duration-200 shadow-sm"
                    >
                      <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1.5 text-xs flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-rose-950">
                            ตรวจพบรายชื่อและนามสกุลนี้ในระบบแล้ว
                          </span>
                          <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-[11px] font-black uppercase tracking-wider">
                            ห้ามบันทึกซ้ำเด็ดขาด
                          </span>
                        </div>
                        <p className="text-rose-800 leading-relaxed text-xs">
                          คุณ <strong>"{duplicateWarning.first_name} {duplicateWarning.last_name}"</strong> มีข้อมูลการลงทะเบียนในระบบเรียบร้อยแล้ว ระบบไม่อนุญาตให้บันทึกซ้ำซ้อน
                        </p>
                        <div className="p-2.5 bg-white/95 border border-rose-200 rounded-xl font-mono text-[11px] text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>รหัสผู้ลงทะเบียน: <strong className="text-indigo-600 font-bold">{duplicateWarning.registration_code}</strong></span>
                          <span>ชื่อบริษัท: <strong className="text-slate-900">{duplicateWarning.team_name_snapshot}</strong></span>
                          {duplicateWarning.sub_team_name_snapshot && (
                            <span>สาขาย่อย: <strong className="text-slate-900">{duplicateWarning.sub_team_name_snapshot}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Team Selection (Prompt Section 9 - DYNAMIC FROM DATABASE, NOT HARDCODED) */}
                  <div>
                    <label
                      htmlFor="select-team"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      ชื่อบริษัท (Company) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <select
                        id="select-team"
                        required
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="w-full pl-10 pr-8 py-3 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 appearance-none transition-all font-medium"
                      >
                        <option value="">-- กรุณาเลือกบริษัท --</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Team Color Quick Indicator Pills */}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {teams.map((t) => {
                      const isSelected = t.id === selectedTeamId;
                      return (
                        <button
                          key={t.id}
                          id={`btn-team-chip-${t.id}`}
                          type="button"
                          onClick={() => setSelectedTeamId(t.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                            isSelected
                              ? 'ring-2 ring-offset-1 text-white shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          style={{
                            backgroundColor: isSelected ? t.color_hex : undefined,
                            borderColor: isSelected ? t.color_hex : undefined,
                          }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: isSelected ? '#ffffff' : t.color_hex }}
                          />
                          <span>{t.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Conditional Sub-Team Dropdown (Prompt Section 9) */}
                  {selectedTeamId && subTeams.length > 0 && (
                    <div className="animate-in fade-in duration-200">
                      <label
                        htmlFor="select-sub-team"
                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                      >
                        สาขาย่อย / โรงงาน (Sub-branch) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Layers className="w-4 h-4" />
                        </div>
                        <select
                          id="select-sub-team"
                          required
                          value={selectedSubTeamId}
                          onChange={(e) => setSelectedSubTeamId(e.target.value)}
                          className="w-full pl-10 pr-8 py-3 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 appearance-none transition-all font-medium"
                        >
                          <option value="">-- กรุณาเลือกสาขาย่อย / โรงงาน --</option>
                          {subTeams.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                          ▼
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      id="btn-submit-registration"
                      type="submit"
                      disabled={isSubmitting || Boolean(duplicateWarning)}
                      className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-base shadow-md transition-all duration-200 transform active:scale-98 ${
                        duplicateWarning
                          ? 'bg-rose-100 text-rose-700 border-2 border-rose-300 cursor-not-allowed shadow-none'
                          : 'text-white disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                      style={!duplicateWarning ? { backgroundColor: teamColorHex } : undefined}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>กำลังบันทึกข้อมูล...</span>
                        </>
                      ) : duplicateWarning ? (
                        <>
                          <ShieldAlert className="w-5 h-5 text-rose-600" />
                          <span>ห้ามบันทึกซ้ำ (พบรายชื่อนี้ในระบบแล้ว)</span>
                        </>
                      ) : (
                        <>
                          <span>ยืนยันการลงทะเบียน</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 no-print">
        <p>
          © {event?.year || '2027'} {event?.name || 'NEW YEAR PARTY'}. All Rights Reserved. • Powered by
          AI Studio Production Architecture
        </p>
      </footer>

      {/* Printable QR Code Modal */}
      {registeredResult && (
        <QRCodeModal
          registration={registeredResult}
          team={selectedTeam}
          eventName={`${event?.name || 'NEW YEAR PARTY'} ${event?.year || '2027'}`}
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
        />
      )}
    </div>
  );
};
