import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft } from 'react-icons/fi';
import PageSkeleton from '../../components/common/PageSkeleton';
import * as pharmacySaleService from '../../services/pharmacySaleService';
import { formatCurrency } from '../../utils/formatCurrency';

function PharmacySaleDetail() {
  const { t, i18n } = useTranslation(['pharmacy', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  useEffect(() => {
    pharmacySaleService.getSale(id).then(setSale);
  }, [id]);

  if (!sale) {
    return <PageSkeleton />;
  }

  const customerName = sale.customer_first_name ? `${sale.customer_first_name} ${sale.customer_last_name}` : t('pharmacy:sales.walkIn');

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/pharmacy/sales')}>
            <FiArrowLeft aria-hidden="true" /> {t('pharmacy:sales.detail.backToSales')}
          </button>
          <h1 className="page-title">{sale.sale_number}</h1>
          <p className="page-subtitle">
            {customerName} · {sale.branch_name} · {formatDateTime(sale.created_at)}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('pharmacy:sales.detail.itemsTitle')}</span></div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('pharmacy:sales.itemColumns.medicine')}</th>
                <th>{t('pharmacy:sales.itemColumns.batch')}</th>
                <th>{t('pharmacy:sales.itemColumns.quantity')}</th>
                <th>{t('pharmacy:sales.itemColumns.unitPrice')}</th>
                <th>{t('pharmacy:sales.itemColumns.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.medicine_name}</td>
                  <td>{item.batch_number}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                  <td>{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer flex justify-end">
          <span className="text-lg font-semibold">{t('pharmacy:sales.detail.totalLabel')}: {formatCurrency(sale.total_amount)}</span>
        </div>
      </div>
    </div>
  );
}

export default PharmacySaleDetail;
