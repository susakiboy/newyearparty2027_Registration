import React from 'react';
import { Registration } from '../types';
import { Printer, X } from 'lucide-react';

interface PrintAttendanceListProps {
  title: string;
  registrations: Registration[];
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintAttendanceList: React.FC<PrintAttendanceListProps> = ({
  title,
  registrations,
  eventName,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col my-auto overflow-hidden">
        {/* Modal Header for Screen */}
        <div className="no-print p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 text-base">พิมพ์ใบรายชื่อผู้เข้าร่วม / Attendance Sheet</h3>
            <p className="text-xs text-slate-500">จำนวนทั้งหมด {registrations.length} รายการ</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-trigger-print-attendance"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs"
            >
              <Printer className="w-4 h-4" />
              พิมพ์เอกสาร (Print)
            </button>
            <button
              id="btn-close-print-modal"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-white text-black font-sans">
          {/* Document Header */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-wider">{eventName}</h1>
            <h2 className="text-lg font-semibold text-slate-700 mt-1">{title}</h2>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2 border-t border-slate-200">
              <span>วันที่พิมพ์: {new Date().toLocaleString('th-TH')}</span>
              <span>รวมทั้งสิ้น: {registrations.length} คน</span>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-400 text-xs font-bold text-slate-700 uppercase bg-slate-100/70">
                <th className="py-2 px-2 w-12 text-center">ลำดับ</th>
                <th className="py-2 px-3 w-32">รหัสลงทะเบียน</th>
                <th className="py-2 px-3 w-24 text-center">เบอร์รางวัล</th>
                <th className="py-2 px-3">ชื่อ-นามสกุล</th>
                <th className="py-2 px-3 w-28">ทีม</th>
                <th className="py-2 px-3 w-28">ทีมย่อย</th>
                <th className="py-2 px-3 w-24 text-center">Check-in</th>
                <th className="py-2 px-3 w-28 text-center">ลายมือชื่อ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    ไม่มีข้อมูลผู้ลงทะเบียนตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                registrations.map((r, index) => (
                  <tr key={r.id} className="hover:bg-slate-50 text-xs">
                    <td className="py-2 px-2 text-center font-medium text-slate-500">{index + 1}</td>
                    <td className="py-2 px-3 font-mono font-semibold">{r.registration_code}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-amber-700 bg-amber-50/50">
                      {r.lucky_number || '-'}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900">{r.full_name}</td>
                    <td className="py-2 px-3 text-slate-700">{r.team_name_snapshot}</td>
                    <td className="py-2 px-3 text-slate-500">{r.sub_team_name_snapshot || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      {r.check_in_status === 'CHECKED_IN' ? (
                        <span className="font-semibold text-emerald-700">✓ มาแล้ว</span>
                      ) : (
                        <span className="text-slate-400">ขาด</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center border-b border-dotted border-slate-300"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Document Footer */}
          <div className="mt-12 pt-6 border-t border-slate-300 flex justify-between text-xs text-slate-500">
            <div>
              <p>ผู้พิมพ์เอกสาร: ......................................................</p>
              <p className="mt-1">วันที่: ....../....../............</p>
            </div>
            <div className="text-right">
              <p>ผู้ตรวจสอบ: ......................................................</p>
              <p className="mt-1">วันที่: ....../....../............</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
