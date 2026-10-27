import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, X, AlertCircle, Volume2, VolumeX, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onScanSuccess,
  onClose,
}) => {
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [scanSuccessText, setScanSuccessText] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isProcessingScanRef = useRef<boolean>(false);
  const containerId = 'qr-reader-container';

  // Sound beep helper using web audio API
  const playBeep = (isSuccess: boolean = true) => {
    if (!soundEnabled) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch {
      // AudioContext may require user interaction
    }
  };

  const handleScanHit = (text: string) => {
    if (isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;
    playBeep(true);
    setScanSuccessText(text);

    // Brief animation delay so user sees scan feedback before closing/proceeding
    setTimeout(() => {
      onScanSuccess(text);
    }, 250);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error clearing scanner instance:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanner = async (camIdOrConfig: string | { facingMode: string }) => {
    try {
      setErrorMessage(null);
      setScanSuccessText(null);

      // Stop existing instance if any
      await stopScanner();

      // Ensure container DOM exists
      const containerEl = document.getElementById(containerId);
      if (!containerEl) {
        console.warn('Scanner container not yet rendered');
        return;
      }

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const cameraConfig =
        typeof camIdOrConfig === 'string' && camIdOrConfig.length > 0
          ? camIdOrConfig
          : { facingMode: 'environment' };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(180, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleScanHit(decodedText);
        },
        () => {
          // Frame scanner callback
        }
      );

      setIsScanning(true);

      // Now query cameras if not already queried
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          if (typeof camIdOrConfig === 'string' && camIdOrConfig) {
            setSelectedCamera(camIdOrConfig);
          }
        }
      } catch (e) {
        // Safe to ignore device list error if camera is already streaming
      }
    } catch (err: any) {
      console.warn('Primary camera start failed:', err);

      // Try fallback to user facingMode if environment failed
      if (typeof camIdOrConfig === 'object' && camIdOrConfig.facingMode === 'environment') {
        try {
          if (scannerRef.current) {
            await stopScanner();
          }
          const html5QrCode = new Html5Qrcode(containerId, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
          });
          scannerRef.current = html5QrCode;
          await html5QrCode.start(
            { facingMode: 'user' },
            {
              fps: 15,
              qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const size = Math.max(180, Math.floor(minEdge * 0.72));
                return { width: size, height: size };
              },
              aspectRatio: 1.0,
            },
            (decodedText) => handleScanHit(decodedText),
            () => {}
          );
          setIsScanning(true);
          return;
        } catch (fallbackErr) {
          console.warn('Fallback camera also failed:', fallbackErr);
        }
      }

      setErrorMessage(
        'ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์การเข้าถึงกล้องในเบราว์เซอร์ หรือเลือกไฟล์รูปภาพ QR Code เพื่อสแกนแทน'
      );
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      isProcessingScanRef.current = false;
      setScanSuccessText(null);
      return;
    }

    isProcessingScanRef.current = false;
    setScanSuccessText(null);
    setErrorMessage(null);

    // Give DOM a small tick to ensure qr-reader-container is mounted
    const timer = setTimeout(() => {
      // First try listing cameras
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length) {
            setCameras(devices);
            const backCam = devices.find(
              (d) =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('environment') ||
                d.label.toLowerCase().includes('rear')
            );
            const camId = backCam ? backCam.id : devices[0].id;
            setSelectedCamera(camId);
            startScanner(camId);
          } else {
            // No device list returned directly, try facingMode environment
            startScanner({ facingMode: 'environment' });
          }
        })
        .catch(() => {
          // If getCameras rejects (e.g. before permission is asked), try start directly with environment
          startScanner({ facingMode: 'environment' });
        });
    }, 100);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  // Handle uploading/selecting image file containing QR Code
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMessage(null);

    try {
      // Create fresh instance for file scan if needed
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      const decodedText = await scanner.scanFile(file, true);
      setIsProcessingFile(false);
      if (decodedText) {
        handleScanHit(decodedText);
      }
    } catch (err: any) {
      setIsProcessingFile(false);
      playBeep(false);
      setErrorMessage('ไม่พบ QR Code ในภาพที่เลือก กรุณาลองเลือกภาพที่คมชัดกว่านี้');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCamera(newId);
    startScanner(newId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 no-print">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col relative animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-sm">สแกน QR Code เพื่อ Check-in</h3>
              <p className="text-[11px] text-slate-400">หันกล้องไปที่ QR Code ของผู้เข้าร่วม</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              id="btn-toggle-sound"
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              title={soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              id="btn-close-scanner"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera Selector Bar */}
        {cameras.length > 1 && (
          <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 text-xs">
            <span className="text-slate-500 shrink-0 font-medium">สลับกล้อง:</span>
            <select
              id="select-camera"
              value={selectedCamera}
              onChange={handleCameraChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none"
            >
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Camera ${cam.id.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Video Canvas Container */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[320px] overflow-hidden">
          <div id={containerId} className="w-full max-w-[360px]" />

          {/* Success Overlay Flash */}
          {scanSuccessText && (
            <div className="absolute inset-0 bg-emerald-600/90 flex flex-col items-center justify-center p-6 text-center text-white z-20 animate-in fade-in duration-100">
              <CheckCircle2 className="w-16 h-16 text-white mb-2 animate-bounce" />
              <p className="text-lg font-black tracking-tight">สแกนสำเร็จ!</p>
              <p className="text-xs font-mono opacity-90 mt-1">{scanSuccessText}</p>
              <p className="text-[11px] text-emerald-100 mt-2">กำลังบันทึกข้อมูล Check-in...</p>
            </div>
          )}

          {/* Error Message Overlay */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-10">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs font-medium text-slate-200 max-w-xs">{errorMessage}</p>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <button
                  id="btn-retry-camera"
                  type="button"
                  onClick={() => startScanner(selectedCamera || { facingMode: 'environment' })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  ลองเปิดกล้องใหม่
                </button>
                <button
                  id="btn-upload-qr-error-fallback"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  เลือกภาพ QR จากเครื่อง
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for QR Image Scan */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Footer Actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              id="btn-upload-qr-file"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium shadow-2xs transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isProcessingFile ? 'กำลังอ่านไฟล์ภาพ...' : 'อัปโหลดภาพ QR'}</span>
            </button>
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              {isScanning ? '● กล้องพร้อมใช้งาน' : 'กล้องหยุดทำงาน'}
            </span>
          </div>

          <button
            id="btn-close-scanner-bottom"
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
