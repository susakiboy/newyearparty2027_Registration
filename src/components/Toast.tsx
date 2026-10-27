import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export interface SingleToastProps {
  type: ToastType;
  message: string;
  onClose?: () => void;
}

export const Toast: React.FC<SingleToastProps> = ({ type, message, onClose }) => {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
  };

  const bgStyles = {
    success: 'bg-white border-emerald-200 text-slate-800 shadow-emerald-100',
    error: 'bg-white border-rose-200 text-slate-800 shadow-rose-100',
    warning: 'bg-white border-amber-200 text-slate-800 shadow-amber-100',
    info: 'bg-white border-blue-200 text-slate-800 shadow-blue-100',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between p-3 rounded-xl border shadow-lg transition-all animate-in fade-in duration-200 ${bgStyles[type]}`}
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        {icons[type]}
        <p className="text-xs font-semibold">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors ml-3"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none no-print">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  const bgStyles = {
    success: 'bg-white border-emerald-200 text-slate-800 shadow-emerald-100',
    error: 'bg-white border-rose-200 text-slate-800 shadow-rose-100',
    warning: 'bg-white border-amber-200 text-slate-800 shadow-amber-100',
    info: 'bg-white border-blue-200 text-slate-800 shadow-blue-100',
  };

  return (
    <div
      id={`toast-${toast.id}`}
      className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border shadow-lg transition-all transform translate-y-0 ${bgStyles[toast.type]}`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        {icons[toast.type]}
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
      <button
        id={`btn-close-toast-${toast.id}`}
        onClick={() => onDismiss(toast.id)}
        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors ml-3"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
