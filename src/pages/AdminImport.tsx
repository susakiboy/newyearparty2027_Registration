import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { EventConfig, AdminUser, ImportPreviewRow, ImportResult } from '../types';
import { importService } from '../services/importService';

interface AdminImportProps {
  event: EventConfig;
  currentUser: AdminUser;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
  onImportComplete: () => void;
}

export const AdminImport: React.FC<AdminImportProps> = ({
  event,
  currentUser,
  onShowToast,
  onImportComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [parsedRows, setParsedRows] = useState<ImportPreviewRow[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Download Sample Template (Prompt Section 35)
  const handleDownloadTemplate = () => {
    try {
      importService.downloadTemplate();
      onShowToast('success', 'ดาวน์โหลดไฟล์เทมเพลตเรียบร้อยแล้ว');
    } catch (err) {
      console.error('Download template error:', err);
      onShowToast('error', 'ไม่สามารถดาวน์โหลดเทมเพลตได้');
    }
  };

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // Handle Drag and Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setImportResult(null);
    try {
      setIsValidating(true);
      const rows = await importService.parseExcelFile(file, event.id);
      setParsedRows(rows);
      onShowToast('info', `ตรวจพบข้อมูลทั้งหมด ${rows.length} แถว`);
    } catch (err: any) {
      console.error('File parsing error:', err);
      onShowToast('error', err.message || 'ไม่สามารถอ่านไฟล์ได้');
      setParsedRows(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Execute Final Import (Prompt Section 38)
  const handleExecuteImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;

    try {
      setIsImporting(true);
      const result = await importService.confirmImport(parsedRows, event.id, currentUser);
      setImportResult(result);
      onShowToast('success', `นำเข้าข้อมูลสำเร็จ ${result.successCount} รายการ`);
      onImportComplete();
    } catch (err: any) {
      console.error('Execute import error:', err);
      onShowToast('error', err.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows ? parsedRows.filter((r) => r.isValid).length : 0;
  const invalidCount = parsedRows ? parsedRows.filter((r) => !r.isValid).length : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            นำเข้าข้อมูลผู้ลงทะเบียน (Bulk Import)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            นำเข้าข้อมูลผู้เข้าร่วมงานจำนวนมากผ่านไฟล์ Excel (.xlsx) หรือ CSV
          </p>
        </div>

        <button
          id="btn-download-import-template"
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>ดาวน์โหลดไฟล์ต้นแบบ (Excel Template)</span>
        </button>
      </div>

      {/* Upload Box */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-400 transition-colors shadow-xs"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-14 h-14 bg-indigo-50 rounded-2xl mx-auto flex items-center justify-center text-indigo-600 mb-3 shadow-inner">
          <Upload className="w-7 h-7" />
        </div>

        <h3 className="text-sm font-bold text-slate-900">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</h3>
        <p className="text-xs text-slate-400 mt-1">
          รองรับไฟล์ Excel (.xlsx, .xls) หรือ CSV (ขนาดไม่เกิน 10MB)
        </p>

        <div className="mt-4">
          <button
            id="btn-browse-file"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            เลือกไฟล์จากอุปกรณ์
          </button>
        </div>

        {selectedFile && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl text-xs text-slate-700 font-medium">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{selectedFile.name}</span>
            <span className="text-slate-400 font-mono">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}
      </div>

      {/* Validation Results Panel */}
      {isValidating && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
          <p className="text-xs font-medium">กำลังตรวจสอบความถูกต้องของข้อมูลและโครงสร้างทีม...</p>
        </div>
      )}

      {parsedRows && !isValidating && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
          {/* Summary KPIs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                ผลการตรวจสอบข้อมูลก่อนนำเข้า (Pre-import Validation)
              </h3>
              <p className="text-xs text-slate-400">
                ตรวจสอบความถูกต้องของชื่อ สังกัดทีม และทีมย่อยในฐานข้อมูล
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>พร้อมนำเข้า: {validCount} แถว</span>
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>พบข้อผิดพลาด: {invalidCount} แถว</span>
                </div>
              )}
            </div>
          </div>

          {/* Validation Table Preview */}
          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <th className="py-2.5 px-3 w-16 text-center">แถวที่</th>
                  <th className="py-2.5 px-3">ชื่อ</th>
                  <th className="py-2.5 px-3">นามสกุล</th>
                  <th className="py-2.5 px-3">ทีม</th>
                  <th className="py-2.5 px-3">ทีมย่อย</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                  <th className="py-2.5 px-3">หมายเหตุ / ข้อผิดพลาด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.slice(0, 100).map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40'}
                  >
                    <td className="py-2 px-3 text-center font-mono text-slate-400">
                      {row.rowNumber}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">{row.first_name || '-'}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{row.last_name || '-'}</td>
                    <td className="py-2 px-3 text-slate-700">{row.team_name || '-'}</td>
                    <td className="py-2 px-3 text-slate-700">{row.sub_team_name || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" /> ผ่าน
                        </span>
                      ) : row.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                          <XCircle className="w-3 h-3" /> ชื่อซ้ำ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                          <XCircle className="w-3 h-3" /> ไม่ผ่าน
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-rose-600 font-medium">
                      {row.errors.length > 0 ? row.errors.join(', ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirm Import Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <p className="text-xs text-slate-500">
              * ระบบจะสร้าง Registration ID (เช่น SD2026-XXXXXX) และ QR Code ให้กับทุกแถวที่ผ่านเกณฑ์โดยอัตโนมัติ
            </p>

            <button
              id="btn-confirm-execute-import"
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting || validCount === 0}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังนำเข้าข้อมูล...</span>
                </>
              ) : (
                <>
                  <span>ยืนยันนำเข้าข้อมูล ({validCount} รายการ)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import Result Notification */}
      {importResult && (
        <div
          id="import-result-card"
          className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-emerald-900 space-y-2 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 font-bold text-base">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>กระบวนการนำเข้าข้อมูลเสร็จสมบูรณ์!</span>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2 text-xs">
            <div className="bg-white p-3 rounded-xl border border-emerald-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">
                นำเข้าสำเร็จ
              </span>
              <span className="text-lg font-black text-emerald-600 font-mono">
                {importResult.successCount}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">
                ข้ามเนื่องจากซ้ำ
              </span>
              <span className="text-lg font-black text-amber-600 font-mono">
                {importResult.duplicateCount}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">
                ล้มเหลว
              </span>
              <span className="text-lg font-black text-rose-600 font-mono">
                {importResult.errorCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
