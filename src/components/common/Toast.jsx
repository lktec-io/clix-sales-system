import { motion } from 'framer-motion';
import { FiCheckCircle, FiAlertTriangle, FiXCircle, FiInfo, FiX } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

const VARIANT_ICONS = {
  success: FiCheckCircle,
  warning: FiAlertTriangle,
  error: FiXCircle,
  info: FiInfo,
};

// Auto-dismiss duration mirrored here so the CSS progress-bar animation
// (toast-progress, in Toast.css) and the JS dismiss timer in
// ToastContext.jsx never drift apart. Errors dismiss faster than
// success/warning/info by deliberate design — a normal, already-read
// error message ("Customer with this phone number already exists") should
// clear itself quickly rather than linger and block the next action, while
// still giving a moment to read it and a manual close button for anyone
// who needs longer.
export const TOAST_DURATION_MS = 4000;
export const TOAST_ERROR_DURATION_MS = 1200;

function Toast({ id, variant = 'info', message, onDismiss }) {
  const { t } = useTranslation('common');
  const Icon = VARIANT_ICONS[variant] || FiInfo;
  const duration = variant === 'error' ? TOAST_ERROR_DURATION_MS : TOAST_DURATION_MS;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`toast toast-${variant}`}
      role="status"
    >
      <span className="toast-icon-badge">
        <Icon className="toast-icon" aria-hidden="true" />
      </span>
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={() => onDismiss(id)} aria-label={t('toast.dismiss')}>
        <FiX />
      </button>
      <motion.div
        className="toast-progress"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

export default Toast;
