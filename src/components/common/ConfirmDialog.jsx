import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, variant = 'danger' }) {
  const { t } = useTranslation('common');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
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
      <p className="text-sm text-secondary">{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;
