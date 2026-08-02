import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiDownload, FiUpload, FiCheckCircle } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import * as purchaseService from '../../services/purchaseService';
import * as branchService from '../../services/branchService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = { valid: 'badge-success', invalid: 'badge-danger' };

// Three-step wizard: pick a branch + upload a file (server parses and
// validates every row without writing anything yet) -> review the preview
// table (valid/invalid/duplicate flags, nothing imports until this is
// confirmed) -> commit and show the final summary. Closing at any step
// before "Confirm Import" leaves the database untouched.
function PurchaseImportModal({ open, onClose, onImported }) {
  const { t } = useTranslation(['purchases', 'common']);
  const [step, setStep] = useState('select');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) branchService.listActiveBranches().then(setBranches);
  }, [open]);

  const reset = () => {
    setStep('select');
    setFileName('');
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      await purchaseService.downloadImportTemplate();
    } catch {
      setError(t('purchases:import.downloadError'));
    }
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setFileName(file.name);
    setLoading(true);
    try {
      const data = await purchaseService.previewImport(file);
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.message || t('purchases:import.readFileError'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await purchaseService.commitImport({ branchId: Number(branchId), rows: preview.rows });
      setResult(data);
      setStep('result');
      onImported?.();
    } catch (err) {
      setError(err.response?.data?.message || t('purchases:import.importError'));
    } finally {
      setLoading(false);
    }
  };

  const validCount = preview?.summary.validRows || 0;

  return (
    <Modal open={open} onClose={handleClose} title={t('purchases:import.title')} size="lg">
      {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}

      {step === 'select' && (
        <div>
          <p className="text-sm text-secondary mb-4">
            {t('purchases:import.instructions')}
          </p>

          <div className="form-group mb-4">
            <label className="form-label form-label-required" htmlFor="importBranch">{t('purchases:import.branchLabel')}</label>
            <select id="importBranch" className="form-control" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('purchases:import.selectBranch')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="form-row">
            <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate}>
              <FiDownload aria-hidden="true" /> {t('purchases:import.downloadTemplate')}
            </button>
            <button
              type="button"
              className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
              disabled={!branchId || loading}
              onClick={() => fileInputRef.current?.click()}
            >
              <FiUpload aria-hidden="true" /> {t('purchases:import.uploadTemplate')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
          </div>
          {!branchId && <p className="text-xs text-secondary mt-2">{t('purchases:import.selectBranchHint')}</p>}
        </div>
      )}

      {step === 'preview' && preview && (
        <div>
          <p className="text-sm text-secondary mb-3">{fileName}</p>
          <div className="form-row mb-4">
            <span className="badge badge-neutral">{t('purchases:import.rowsCount', { count: preview.summary.totalRows })}</span>
            <span className="badge badge-success">{t('purchases:import.validCount', { count: preview.summary.validRows })}</span>
            <span className="badge badge-danger">{t('purchases:import.invalidCount', { count: preview.summary.invalidRows })}</span>
            <span className="badge badge-warning">{t('purchases:import.duplicateCount', { count: preview.summary.duplicateRows })}</span>
            <span className="badge badge-neutral">{t('purchases:import.newProductsCount', { count: preview.summary.rowsToCreate })}</span>
            <span className="badge badge-neutral">{t('purchases:import.productUpdatesCount', { count: preview.summary.rowsToUpdate })}</span>
          </div>

          <div className="table-wrapper mb-4" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('purchases:import.columnRow')}</th><th>{t('purchases:import.columnProduct')}</th><th>{t('purchases:import.columnCategory')}</th><th>{t('purchases:import.columnSupplier')}</th><th>{t('purchases:import.columnQty')}</th>
                  <th>{t('purchases:import.columnBuyingPrice')}</th><th>{t('purchases:import.columnAction')}</th><th>{t('purchases:import.columnStatus')}</th><th>{t('purchases:import.columnNotes')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.productName || '—'}</td>
                    <td>{row.category || '—'}</td>
                    <td>{row.supplier || '—'}</td>
                    <td>{row.quantity ?? '—'}</td>
                    <td>{row.buyingPrice != null ? formatCurrency(row.buyingPrice) : '—'}</td>
                    <td>{row.status === 'valid' ? (row.action === 'update' ? t('purchases:import.actionUpdate') : t('purchases:import.actionCreate')) : '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[row.status] || 'badge-neutral'}`}>{t(`purchases:import.rowStatus.${row.status}`, row.status)}</span></td>
                    <td className="text-xs">
                      {[...row.errors, ...row.warnings].join('; ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={reset}>{t('purchases:import.startOver')}</button>
            <button
              type="button"
              className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
              disabled={validCount === 0 || loading}
              onClick={handleConfirmImport}
            >
              {t('purchases:import.confirmImport', { count: validCount })}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div>
          <div className="text-center mb-4">
            <FiCheckCircle size={40} className="text-success" aria-hidden="true" />
            <h3 className="mt-2">{t('purchases:import.importComplete')}</h3>
          </div>
          <div className="form-row mb-4">
            <span className="badge badge-success">{t('purchases:import.rowsImported', { count: result.rowsImported })}</span>
            <span className="badge badge-neutral">{t('purchases:import.productsCreated', { count: result.productsCreated })}</span>
            <span className="badge badge-neutral">{t('purchases:import.productsUpdated', { count: result.productsUpdated })}</span>
            <span className="badge badge-warning">{t('purchases:import.rowsSkipped', { count: result.rowsSkipped })}</span>
            <span className="badge badge-neutral">{t('purchases:import.purchaseOrdersCreated', { count: result.purchaseOrdersCreated })}</span>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">{t('purchases:import.errorsTitle')}</p>
              <ul className="text-xs text-secondary">
                {result.errors.map((e) => <li key={`err-${e.row}`}>{t('purchases:import.rowMessage', { row: e.row, message: e.message })}</li>)}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">{t('purchases:import.warningsTitle')}</p>
              <ul className="text-xs text-secondary">
                {result.warnings.map((w, i) => <li key={`warn-${w.row}-${i}`}>{t('purchases:import.rowMessage', { row: w.row, message: w.message })}</li>)}
              </ul>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={handleClose}>{t('purchases:import.done')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default PurchaseImportModal;
