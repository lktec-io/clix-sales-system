import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiDownload, FiUpload, FiCheckCircle } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import * as medicineImportService from '../../services/medicineImportService';
import * as branchService from '../../services/branchService';
import { formatCurrency } from '../../utils/formatCurrency';

// Pharmacy's own "Import Medicines" wizard — structured the same way as
// PurchaseImportModal.jsx (select branch + upload -> preview & validation
// errors -> confirm & result) but reads as a distinctly pharmacy-branded
// flow: its own template, its own copy ("Import Medicines", never "Import
// Products"), its own columns (Medicine Name/Category/Unit/Purchase Price/
// Selling Price/Opening Stock/Minimum Stock/Batch Number/Expiry Date/
// Supplier). Nothing is written to the database until "Import Medicines"
// is confirmed on the preview step.
function MedicineImportModal({ open, onClose, onImported }) {
  const { t } = useTranslation(['pharmacy', 'common']);
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
      await medicineImportService.downloadImportTemplate();
    } catch {
      setError(t('pharmacy:import.downloadError'));
    }
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setFileName(file.name);
    setLoading(true);
    try {
      const data = await medicineImportService.previewImport(file);
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.message || t('pharmacy:import.readFileError'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await medicineImportService.commitImport({ branchId: Number(branchId), rows: preview.validRows });
      setResult(data);
      setStep('result');
      onImported?.();
    } catch (err) {
      setError(err.response?.data?.message || t('pharmacy:import.importError'));
    } finally {
      setLoading(false);
    }
  };

  const validCount = preview?.validRows.length || 0;
  const errorCount = preview?.errors.length || 0;

  return (
    <Modal open={open} onClose={handleClose} title={t('pharmacy:import.title')} size="lg">
      {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}

      {step === 'select' && (
        <div>
          <p className="text-sm text-secondary mb-4">
            {t('pharmacy:import.instructions')}
          </p>

          <div className="form-group mb-4">
            <label className="form-label form-label-required" htmlFor="medicineImportBranch">{t('pharmacy:import.branchLabel')}</label>
            <select id="medicineImportBranch" className="form-control" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('pharmacy:import.selectBranch')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="form-row">
            <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate}>
              <FiDownload aria-hidden="true" /> {t('pharmacy:import.downloadTemplate')}
            </button>
            <button
              type="button"
              className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
              disabled={!branchId || loading}
              onClick={() => fileInputRef.current?.click()}
            >
              <FiUpload aria-hidden="true" /> {t('pharmacy:import.uploadTemplate')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
          </div>
          {!branchId && <p className="text-xs text-secondary mt-2">{t('pharmacy:import.selectBranchHint')}</p>}
        </div>
      )}

      {step === 'preview' && preview && (
        <div>
          <p className="text-sm text-secondary mb-3">{fileName}</p>
          <div className="form-row mb-4">
            <span className="badge badge-neutral">{t('pharmacy:import.rowsCount', { count: preview.totalRows })}</span>
            <span className="badge badge-success">{t('pharmacy:import.validCount', { count: validCount })}</span>
            <span className="badge badge-danger">{t('pharmacy:import.errorCount', { count: errorCount })}</span>
          </div>

          {errorCount > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">{t('pharmacy:import.validationErrorsTitle')}</p>
              <div className="table-wrapper" style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('pharmacy:import.columnRow')}</th>
                      <th>{t('pharmacy:import.columnField')}</th>
                      <th>{t('pharmacy:import.columnProblem')}</th>
                      <th>{t('pharmacy:import.columnExpected')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((e, i) => (
                      <tr key={`err-${e.row}-${i}`}>
                        <td>{e.row}</td>
                        <td>{e.field}</td>
                        <td>{e.problem}</td>
                        <td className="text-xs text-secondary">{e.expected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-sm font-semibold mb-2">{t('pharmacy:import.previewTitle')}</p>
          {validCount === 0 ? (
            <p className="text-sm text-secondary mb-4">{t('pharmacy:import.noValidRows')}</p>
          ) : (
            <div className="table-wrapper mb-4" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('pharmacy:import.columnRow')}</th>
                    <th>{t('pharmacy:import.columnMedicine')}</th>
                    <th>{t('pharmacy:import.columnCategory')}</th>
                    <th>{t('pharmacy:import.columnUnit')}</th>
                    <th>{t('pharmacy:import.columnPurchasePrice')}</th>
                    <th>{t('pharmacy:import.columnSellingPrice')}</th>
                    <th>{t('pharmacy:import.columnOpeningStock')}</th>
                    <th>{t('pharmacy:import.columnMinimumStock')}</th>
                    <th>{t('pharmacy:import.columnBatchNumber')}</th>
                    <th>{t('pharmacy:import.columnExpiryDate')}</th>
                    <th>{t('pharmacy:import.columnSupplier')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.validRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.medicineName}</td>
                      <td>{row.category || '—'}</td>
                      <td>{row.unit}</td>
                      <td>{row.purchasePrice != null ? formatCurrency(row.purchasePrice) : '—'}</td>
                      <td>{formatCurrency(row.sellingPrice)}</td>
                      <td>{row.openingStock}</td>
                      <td>{row.minimumStock}</td>
                      <td>{row.batchNumber || '—'}</td>
                      <td>{row.expiryDate || '—'}</td>
                      <td>{row.supplier || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={reset}>{t('pharmacy:import.startOver')}</button>
            <button
              type="button"
              className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
              disabled={validCount === 0 || loading}
              onClick={handleConfirmImport}
            >
              {t('pharmacy:import.confirmImport', { count: validCount })}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div>
          <div className="text-center mb-4">
            <FiCheckCircle size={40} className="text-success" aria-hidden="true" />
            <h3 className="mt-2">{t('pharmacy:import.importComplete')}</h3>
          </div>
          <div className="form-row mb-4">
            <span className="badge badge-success">{t('pharmacy:import.medicinesCreated', { count: result.medicinesCreated })}</span>
            <span className="badge badge-neutral">{t('pharmacy:import.batchesCreated', { count: result.batchesCreated })}</span>
            <span className="badge badge-warning">{t('pharmacy:import.rowsSkipped', { count: result.rowsSkipped })}</span>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">{t('pharmacy:import.errorsTitle')}</p>
              <ul className="text-xs text-secondary">
                {result.errors.map((e, i) => (
                  <li key={`result-err-${e.row}-${i}`}>
                    {t('pharmacy:import.rowFieldMessage', { row: e.row, field: e.field, problem: e.problem })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={handleClose}>{t('pharmacy:import.done')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default MedicineImportModal;
