import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { useToast } from '../../hooks/useToast';

// Extracted from ProductForm.jsx's own local QuickAddModal (Category/Brand
// "+ Add" popups) — reused as-is by MedicineForm.jsx and MenuItemForm.jsx,
// the two other forms with a required-or-useful categoryId select and no
// way to populate it (the actual root cause of "cannot add categories in
// some areas": Pharmacy/Restaurant tenants have the Products module
// disabled, so ProductForm's popup was simply unreachable for them —
// see backend/database/migrations/031_create_pharmacy_tables.sql and
// 033_create_restaurant_tables.sql, both of which disable module_id 9
// (products) for their template). Reusing this exact component rather
// than a new generic "category management" page/system, per the explicit
// "don't create unnecessary generic systems if one already exists"
// instruction — the categories table/API/service already exist and work
// correctly; only the create-affordance was missing in two forms.
function QuickAddModal({ open, title, onClose, onCreate }) {
  const { t } = useTranslation('common');
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetFields = () => {
    setName('');
    setCode('');
    setError('');
  };

  const handleClose = () => {
    resetFields();
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), code: code.trim() });
      resetFields();
      toast.success(t('quickAdd.createSuccess'));
    } catch (err) {
      setError(err.response?.data?.message || t('quickAdd.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>{t('quickAdd.cancel')}</button>
          <button type="submit" form="quick-add-form" className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
            {t('quickAdd.create')}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
      <form id="quick-add-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="quick-add-name">{t('quickAdd.name')}</label>
          <input id="quick-add-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="quick-add-code">{t('quickAdd.code')}</label>
          <input id="quick-add-code" className="form-control" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
      </form>
    </Modal>
  );
}

export default QuickAddModal;
