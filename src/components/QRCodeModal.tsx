import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, X, Check, ShieldCheck, Gift } from 'lucide-react';
import { Registration, Team } from '../types';

interface QRCodeModalProps {
  registration: Registration;
  team?: Team | null;
  eventName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  registration,
  team,
  eventName = 'NEW YEAR PARTY 2027',
  isOpen,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      // Generate QR Code with high resolution
      QRCode.toCanvas(canvasRef.current, registration.registration_code, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).catch((err) => console.error('QR code generation error:', err));
    }
  }, [isOpen, registration.registration_code]);

  if (!isOpen) return null;

  const handleDownloadQR = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `OfficialPass_${registration.registration_code}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(registration.registration_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const accentColor = team?.color_hex || '#8B5CF6';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      {/* Container - Screen & Print Friendly */}
      <div
        id="qr-modal-container"
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative my-auto animate-in fade-in zoom-in duration-150"
      >
        {/* Header Color Banner */}
        <div
          className="p-6 text-white text-center relative overflow-hidden"
          style={{ backgroundColor: accentColor }}
        >
          <button
            id="btn-close-qr-modal"
            onClick={onClose}
            className="no-print absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold tracking-wider uppercase mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Official Pass
          </div>

          <h2 className="text-xl font-bold tracking-tight">{eventName}</h2>
          <p className="text-white/80 text-xs mt-0.5">บัตรประจำตัวผู้เข้าร่วมกิจกรรม</p>
        </div>

        {/* Card Body */}
        <div className="p-6 flex flex-col items-center">
          {/* Registration Code Badge */}
          <div
            onClick={handleCopyCode}
            className="cursor-pointer group flex items-center gap-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl mb-3.5 transition-colors"
            title="คลิกเพื่อคัดลอกรหัส"
          >
            <span className="text-xs text-slate-500 font-medium">รหัสลงทะเบียน:</span>
            <span className="font-mono font-bold text-slate-900 tracking-wider">
              {registration.registration_code}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <span className="text-[10px] text-slate-400 group-hover:text-slate-600">คัดลอก</span>
            )}
          </div>

          {/* LARGE BOLD LUCKY DRAW PRIZE NUMBER SECTION */}
          <div className="w-full mb-4 overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 shadow-md">
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 py-1.5 px-3 text-white flex items-center justify-center gap-1.5 shadow-xs">
              <Gift className="w-4 h-4 text-amber-200" />
              <span className="text-[11px] font-black uppercase tracking-widest">
                หมายเลขลุ้นของรางวัล (LUCKY DRAW NO.)
              </span>
            </div>
            <div className="p-3.5 text-center">
              {registration.lucky_number ? (
                <>
                  <div className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-amber-950 py-1 drop-shadow-xs">
                    {registration.lucky_number}
                  </div>
                  <p className="text-[11px] font-bold text-amber-800 tracking-wide mt-0.5">
                    ★ นำหมายเลขนี้แสดงเพื่อรับของรางวัลในตอน Check-in เข้างาน ★
                  </p>
                </>
              ) : (
                <div className="py-2">
                  <span className="inline-block text-xs font-bold text-amber-800 bg-amber-100/90 px-3 py-1 rounded-full">
                    รอการสุ่มหมายเลขของรางวัลจากระบบ
                  </span>
                  <p className="text-[10px] text-amber-700 mt-1">
                    ผู้จัดงานจะทำการสุ่มหมายเลขรางวัลก่อนเริ่มกิจกรรม
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* QR Canvas */}
          <div className="p-2.5 bg-white rounded-2xl border-2 border-slate-200 shadow-xs mb-4">
            <canvas ref={canvasRef} className="block rounded-lg" />
          </div>

          {/* Participant Info */}
          <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center space-y-2">
            <div>
              <p className="text-xs text-slate-500">ชื่อ-นามสกุล</p>
              <p className="text-lg font-bold text-slate-900">{registration.full_name}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
              <div>
                <p className="text-xs text-slate-500">สังกัดทีม</p>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span className="text-sm font-semibold text-slate-800">
                    {registration.team_name_snapshot}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500">ทีมย่อย / กลุ่ม</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">
                  {registration.sub_team_name_snapshot || '-'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
              <span>สถานะ: {registration.check_in_status === 'CHECKED_IN' ? '✓ Check-in แล้ว' : 'ยังไม่ Check-in'}</span>
              <span>{new Date(registration.registered_at).toLocaleDateString('th-TH')}</span>
            </div>
          </div>

          {/* Action Buttons (Hidden on Print) */}
          <div className="no-print w-full grid grid-cols-2 gap-3 mt-6">
            <button
              id="btn-download-qr-image"
              type="button"
              onClick={handleDownloadQR}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              บันทึกรูป QR
            </button>

            <button
              id="btn-print-card"
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white text-sm font-semibold shadow-sm transition-all"
              style={{ backgroundColor: accentColor }}
            >
              <Printer className="w-4 h-4" />
              พิมพ์บัตร
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
