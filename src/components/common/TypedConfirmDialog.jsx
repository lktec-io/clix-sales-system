import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

// A stronger variant of ConfirmDialog for genuinely high-risk, hard-to-undo
// actions (permanently deleting a purchase and reversing its stock effect,
// for example) — the confirm button stays disabled until the user types the
// exact confirmWord, so a stray click can never trigger it the way a plain
// Confirm/Cancel dialog could. Same open/onClose/onConfirm/error contract
// as ConfirmDialog so callers that outgrow the plain version can switch
// with minimal changes, not a redesign.
function TypedConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, confirmWord = 'DELETE', error }) {
  const { t } = useTranslation('common');
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setTyped('');
    onClose();
  };

  const handleConfirm = async () => {
    if (typed !== confirmWord) return;
    setSubmitting(true);
    try {
      await onConfirm();
      setTyped('');
      onClose();
    } catch {
      // Swallow — same convention as ConfirmDialog: a rejecting onConfirm
      // means the caller wants the dialog to stay open with its own error
      // state visible via the `error` prop, not closed silently.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title ?? t('confirmDialog.areYouSure')}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            className={`btn btn-danger ${submitting ? 'btn-loading' : ''}`}
            onClick={handleConfirm}
            disabled={submitting || typed !== confirmWord}
          >
            {confirmLabel ?? t('actions.confirm')}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger mb-3" role="alert">{error}</div>}
      <p className="text-sm text-secondary mb-4">{message}</p>
      <div className="form-group mb-0">
        <label className="form-label" htmlFor="typed-confirm-input">
          {t('confirmDialog.typeToConfirm', { word: confirmWord })}
        </label>
        <input
          id="typed-confirm-input"
          className="form-control"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </div>
    </Modal>
  );
}

export default TypedConfirmDialog;
