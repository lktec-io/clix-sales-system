import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastContext } from './toastContextInstance';
import Toast, { TOAST_DURATION_MS, TOAST_ERROR_DURATION_MS } from '../components/common/Toast';
import '../styles/components/Toast.css';

let nextId = 1;

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message, variant = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    const timer = setTimeout(() => dismissToast(id), variant === 'error' ? TOAST_ERROR_DURATION_MS : TOAST_DURATION_MS);
    timers.current.set(id, timer);
    return id;
  }, [dismissToast]);

  const value = useMemo(() => ({
    showToast,
    success: (message) => showToast(message, 'success'),
    error: (message) => showToast(message, 'error'),
    warning: (message) => showToast(message, 'warning'),
    info: (message) => showToast(message, 'info'),
  }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-viewport">
          <AnimatePresence>
            {toasts.map((toast) => (
              <Toast key={toast.id} {...toast} onDismiss={dismissToast} />
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
