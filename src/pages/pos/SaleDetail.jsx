import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiPrinter, FiDownload, FiPlusCircle } from 'react-icons/fi';
import PageSkeleton from '../../components/common/PageSkeleton';
import * as saleService from '../../services/saleService';
import { formatCurrency } from '../../utils/formatCurrency';
import '../../styles/pages/POS.css';

const RECEIPT_SIZES = [
  { value: '58', label: '58mm' },
  { value: '80', label: '80mm' },
  { value: 'a4', label: 'A4' },
];

function SaleDetail() {
  const { t, i18n } = useTranslation(['sales', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [receiptSize, setReceiptSize] = useState('80');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const PAYMENT_METHOD_LABELS = {
    cash: t('sales:payment.cash'),
    mpesa: t('sales:payment.mpesa'),
    airtel_money: t('sales:payment.airtelMoney'),
    bank_transfer: t('sales:payment.bankTransfer'),
    card: t('sales:payment.card'),
  };

  useEffect(() => {
    saleService.getSale(id).then(setSale);
  }, [id]);

  if (!sale) {
    return <PageSkeleton />;
  }

  const totalPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalPaid - Number(sale.total_amount);

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/pos/sales')}>
            <FiArrowLeft aria-hidden="true" /> {t('sales:detail.backToHistory')}
          </button>
          <h1 className="page-title">{sale.sale_number}</h1>
          <p className="page-subtitle">
            {sale.branch_name} · {formatDateTime(sale.created_at)} · {t('sales:detail.cashier')}: {sale.cashier_first_name} {sale.cashier_last_name}
            {sale.customer_first_name ? ` · ${t('sales:detail.customer')}: ${sale.customer_first_name} ${sale.customer_last_name}` : ` · ${t('sales:detail.walkInCustomer')}`}
          </p>
        </div>
        <div className="page-actions">
          <select
            className="form-control"
            style={{ width: 90 }}
            value={receiptSize}
            onChange={(e) => setReceiptSize(e.target.value)}
            aria-label={t('sales:detail.receiptPaperSizeAria')}
          >
            {RECEIPT_SIZES.map((option) => <option key={option.value} value={option.value}>{t(`sales:receiptSizes.${option.value}`)}</option>)}
          </select>
          <button type="button" className="btn btn-secondary" onClick={() => saleService.printReceipt(sale.id, receiptSize)}>
            <FiPrinter aria-hidden="true" /> {t('sales:detail.print')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => saleService.downloadReceiptPdf(sale.id, sale.sale_number, receiptSize)}>
            <FiDownload aria-hidden="true" /> {t('sales:detail.downloadPdf')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/pos')}>
            <FiPlusCircle aria-hidden="true" /> {t('sales:detail.newSale')}
          </button>
        </div>
      </div>

      {sale.notes && (
        <div className="alert alert-info mb-4" role="note">{sale.notes}</div>
      )}

      <div className="card mb-5">
        <div className="card-header"><span className="card-title">{t('sales:detail.items')}</span></div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('sales:columns.product')}</th>
                <th>{t('sales:columns.quantity')}</th>
                <th>{t('sales:columns.unitPrice')}</th>
                <th>{t('sales:columns.discount')}</th>
                <th>{t('sales:columns.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name}<div className="text-xs text-secondary">{item.product_code}</div></td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                  <td>{Number(item.discount_amount) > 0 ? `-${formatCurrency(item.discount_amount)}` : '—'}</td>
                  <td>{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer flex justify-end">
          <div style={{ minWidth: 240 }}>
            <div className="pos-totals-row"><span>{t('sales:detail.subtotal')}</span><span>{formatCurrency(sale.subtotal)}</span></div>
            {Number(sale.discount_amount) > 0 && (
              <div className="pos-totals-row"><span>{t('sales:detail.discount')}</span><span>-{formatCurrency(sale.discount_amount)}</span></div>
            )}
            <div className="pos-totals-row pos-totals-row-total"><span>{t('sales:detail.total')}</span><span>{formatCurrency(sale.total_amount)}</span></div>
          </div>
        </div>
      </div>

      {sale.profit && (
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('sales:detail.profit')}</span></div>
          <div className="card-body flex" style={{ gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div>
              <div className="text-xs text-secondary">{t('sales:detail.cost')}</div>
              <div className="text-sm font-semibold">{formatCurrency(sale.profit.cost)}</div>
            </div>
            <div>
              <div className="text-xs text-secondary">{t('sales:detail.grossProfit')}</div>
              <div className="text-sm font-semibold">{formatCurrency(sale.profit.grossProfit)}</div>
            </div>
            <div>
              <div className="text-xs text-secondary">{t('sales:detail.margin')}</div>
              <div className="text-sm font-semibold">{sale.profit.marginPercent.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">{t('sales:detail.payments')}</span></div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('sales:columns.method')}</th>
                <th>{t('sales:columns.amount')}</th>
                <th>{t('sales:columns.reference')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>{payment.reference_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer flex justify-end">
          <span className="text-sm font-semibold">{balance >= 0 ? t('sales:detail.change') : t('sales:detail.balanceDue')}: {formatCurrency(Math.abs(balance))}</span>
        </div>
      </div>
    </div>
  );
}

export default SaleDetail;
