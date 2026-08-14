import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, variant = 'danger', error }) {
  const { t } = useTranslation('common');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Swallow — a rejecting onConfirm means the caller wants the dialog to
      // stay open (e.g. to keep a friendly error visible via the `error`
      // prop) rather than close silently. The caller owns its own error
      // state; this just stops the rejection propagating as unhandled.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? t('confirmDialog.areYouSure')}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            className={`btn btn-${variant} ${submitting ? 'btn-loading' : ''}`}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {confirmLabel ?? t('actions.confirm')}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger mb-3" role="alert">{error}</div>}
      <p className="text-sm text-secondary">{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;
