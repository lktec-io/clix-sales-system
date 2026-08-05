import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiDownload } from 'react-icons/fi';
import PageSkeleton from '../../components/common/PageSkeleton';
import * as billingService from '../../services/billingService';
import { formatCurrency } from '../../utils/formatCurrency';
import { ROUTES } from '../../constants/routes';
import '../../styles/pages/InvoiceDetail.css';

function InvoiceDetail() {
  const { t } = useTranslation('billing');
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await billingService.getMyInvoice(id);
      setInvoice(result);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) return <PageSkeleton />;
  if (error || !invoice) return <div className="alert alert-danger">{error || 'Invoice not found.'}</div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(ROUTES.BILLING)} aria-label="Back to billing">
            <FiArrowLeft />
          </button>
          <div>
            <h1 className="page-title">{t('invoice.title')} {invoice.invoice_number}</h1>
            <p className="page-subtitle">{invoice.plan_name_snapshot} · {invoice.billing_cycle}</p>
          </div>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => billingService.downloadMyInvoicePdf(invoice.id, invoice.invoice_number)}
          >
            <FiDownload aria-hidden="true" /> {t('invoice.downloadPdf')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <dl className="invoice-detail-list">
            <div><dt>{t('invoice.billingPeriod')}</dt><dd>{new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}</dd></div>
            <div><dt>{t('invoice.issueDate')}</dt><dd>{new Date(invoice.issue_date).toLocaleDateString()}</dd></div>
            <div><dt>{t('invoice.dueDate')}</dt><dd>{new Date(invoice.due_date).toLocaleDateString()}</dd></div>
            <div><dt>{t('invoice.paymentStatus')}</dt><dd>
              <span className={`badge ${invoice.payment_status === 'paid' ? 'badge-success' : 'badge-neutral'}`}>{t(`paymentStatus.${invoice.payment_status}`)}</span>
            </dd></div>
          </dl>

          <div className="invoice-detail-totals">
            <div><span>{t('invoice.subtotal')}</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
            <div><span>{t('invoice.tax')}</span><span>{formatCurrency(invoice.tax_amount, invoice.currency)}</span></div>
            <div><span>{t('invoice.discount')}</span><span>-{formatCurrency(invoice.discount_amount, invoice.currency)}</span></div>
            <div className="invoice-detail-total"><span>{t('invoice.total')}</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceDetail;
