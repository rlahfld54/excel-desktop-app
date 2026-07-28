import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ToastContext = createContext({ showToast: () => {} });

const styles = {
  success: 'border-accent-200 bg-white text-gray-900 dark:border-accent-500/40 dark:bg-gray-900 dark:text-white',
  error: 'border-red-200 bg-white text-gray-900 dark:border-red-500/40 dark:bg-gray-900 dark:text-white',
  warning: 'border-amber-200 bg-white text-gray-900 dark:border-amber-500/40 dark:bg-gray-900 dark:text-white',
  info: 'border-sky-200 bg-white text-gray-900 dark:border-sky-500/40 dark:bg-gray-900 dark:text-white',
};

const icons = { success: '✓', error: '!', warning: '!', info: 'i' };
const iconStyles = {
  success: 'bg-accent-100 text-accent-800 dark:bg-accent-500/20 dark:text-accent-200',
  error: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const showToast = useCallback(({ title = '알림', message = '', type = 'info', duration = 4500 } = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current.slice(-3), { id, title, message, type }]);
    if (duration > 0) window.setTimeout(() => dismissToast(id), duration);
    return id;
  }, [dismissToast]);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="pointer-events-none fixed right-5 top-5 z-[10000] flex w-[min(390px,calc(100vw-2.5rem))] flex-col gap-3" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => <div key={toast.id} className={`pointer-events-auto flex gap-3 rounded-xl border p-4 shadow-xl ${styles[toast.type] ?? styles.info}`} role="status">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${iconStyles[toast.type] ?? iconStyles.info}`}>{icons[toast.type] ?? icons.info}</span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">{toast.title}</p>{toast.message && <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{toast.message}</p>}</div>
        <button type="button" className="text-lg leading-none text-gray-400 hover:text-gray-700 dark:hover:text-gray-100" onClick={() => dismissToast(toast.id)} aria-label="알림 닫기">×</button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext);
}
