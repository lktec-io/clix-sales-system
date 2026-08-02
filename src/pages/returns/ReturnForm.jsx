import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiSearch } from 'react-icons/fi';
import * as saleService from '../../services/saleService';
import * as returnService from '../../services/returnService';
import * as inventoryService from '../../services/inventoryService';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/formatCurrency';

function ReturnForm() {
  const { t, i18n } = useTranslation(['returns', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const canApprove = usePermission('returns.approve');

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const REASONS = [
    { value: 'damaged', label: t('returns:form.reasons.damaged') },
    { value: 'wrong_item', label: t('returns:form.reasons.wrongItem') },
    { value: 'changed_mind', label: t('returns:form.reasons.changedMind') },
    { value: 'expired', label: t('returns:form.reasons.expired') },
    { value: 'other', label: t('returns:form.reasons.other') },
  ];

  const REFUND_METHODS = [
    { value: 'cash', label: t('returns:form.refundMethods.cash') },
    { value: 'mpesa', label: t('returns:form.refundMethods.mpesa') },
    { value: 'airtel_money', label: t('returns:form.refundMethods.airtelMoney') },
    { value: 'bank_transfer', label: t('returns:form.refundMethods.bankTransfer') },
  ];
  const [saleQuery, setSaleQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sale, setSale] = useState(null);
  const [stockByProduct, setStockByProduct] = useState({});
  const [selectedItems, setSelectedItems] = useState({});
  const [reason, setReason] = useState('damaged');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const findSale = async () => {
    if (!saleQuery.trim()) return;
    setSearching(true);
    setFormError('');
    try {
      const result = await saleService.listSales({ search: saleQuery, limit: 5 });
      setSearchResults(result.items);
    } finally {
      setSearching(false);
    }
  };

  const selectSale = async (saleId) => {
    const fullSale = await saleService.getSale(saleId);
    setSale(fullSale);
    setSearchResults([]);
    setSelectedItems({});

    // Spec: display Current Stock alongside each returnable line the
    // moment a sale is selected. One lookup per line item (bounded by
    // however many products a single sale has), not a bulk inventory
    // fetch — keeps this a targeted read instead of pulling every
    // product's stock for the branch.
    const stockEntries = await Promise.all(
      fullSale.items.map(async (item) => {
        try {
          const result = await inventoryService.listInventory({
            search: item.product_code,
            branchId: fullSale.branch_id,
            limit: 1,
          });
          return [item.product_id, result.items?.[0]?.available_quantity ?? null];
        } catch {
          return [item.product_id, null];
        }
      }),
    );
    setStockByProduct(Object.fromEntries(stockEntries));
  };

  const toggleItem = (saleItem) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[saleItem.id]) {
        delete next[saleItem.id];
      } else {
        next[saleItem.id] = saleItem.quantity;
      }
      return next;
    });
  };

  const updateQuantity = (saleItemId, quantity, max) => {
    setSelectedItems((prev) => ({ ...prev, [saleItemId]: Math.max(1, Math.min(max, Number(quantity) || 1)) }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const items = Object.entries(selectedItems).map(([saleItemId, quantity]) => ({
      saleItemId: Number(saleItemId),
      quantity,
    }));
    if (items.length === 0) {
      setFormError(t('returns:form.toast.selectAtLeastOneItem'));
      return;
    }

    setSubmitting(true);
    try {
      const created = await returnService.createReturn({ saleId: sale.id, reason, refundMethod, items });
      // Spec: "Approve Return" does everything in one step. Someone who
      // already holds returns.approve doesn't need a second trip to the
      // detail page to click Approve — someone without that authority
      // still lands on a pending request awaiting manager sign-off.
      if (canApprove) {
        await returnService.approveReturn(created.id);
        toast.success(t('returns:form.toast.approvedSuccess'));
      } else {
        toast.success(t('returns:form.toast.submittedSuccess'));
      }
      navigate(`/returns/${created.id}`, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('returns:form.toast.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('returns:form.title')}</h1>
          <p className="page-subtitle">{t('returns:form.subtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      {!sale ? (
        <div className="card">
          <div className="card-header"><span className="card-title">{t('returns:form.locateSale')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="saleQuery">{t('returns:form.saleQueryLabel')}</label>
                <input
                  id="saleQuery"
                  className="form-control"
                  value={saleQuery}
                  onChange={(e) => setSaleQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && findSale()}
                  placeholder={t('returns:form.saleQueryPlaceholder')}
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                <button type="button" className={`btn btn-primary ${searching ? 'btn-loading' : ''}`} onClick={findSale}>
                  <FiSearch aria-hidden="true" /> {t('returns:form.findSale')}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>{t('returns:columns.saleNumber')}</th><th>{t('returns:columns.date')}</th><th>{t('returns:columns.customer')}</th><th>{t('returns:columns.branch')}</th><th>{t('returns:columns.amount')}</th><th /></tr>
                  </thead>
                  <tbody>
                    {searchResults.map((row) => (
                      <tr key={row.id}>
                        <td>{row.sale_number}</td>
                        <td>{formatDateTime(row.created_at)}</td>
                        <td>{row.customer_first_name ? `${row.customer_first_name} ${row.customer_last_name || ''}`.trim() : t('returns:form.walkIn')}</td>
                        <td>{row.branch_name}</td>
                        <td>{formatCurrency(row.total_amount)}</td>
                        <td>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => selectSale(row.id)}>{t('common:actions.select')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {searchResults.length === 0 && saleQuery && !searching && (
              <p className="text-sm text-secondary mt-3">{t('returns:form.searchPrompt')}</p>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="card mb-5">
            <div className="card-header">
              <span className="card-title">{sale.sale_number}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSale(null)}>{t('returns:form.changeSale')}</button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th /><th>{t('returns:columns.product')}</th><th>{t('returns:columns.soldQty')}</th><th>{t('returns:columns.currentStock')}</th><th>{t('returns:columns.returnQty')}</th><th>{t('returns:columns.unitPrice')}</th></tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedItems[item.id])}
                          onChange={() => toggleItem(item)}
                          aria-label={t('returns:form.returnItemAria', { name: item.product_name })}
                        />
                      </td>
                      <td>{item.product_name}<div className="text-xs text-secondary">{item.product_code}</div></td>
                      <td>{item.quantity}</td>
                      <td>{stockByProduct[item.product_id] ?? '—'}</td>
                      <td style={{ width: 100 }}>
                        <input
                          type="number"
                          min="1"
                          max={item.quantity}
                          className="form-control"
                          disabled={!selectedItems[item.id]}
                          value={selectedItems[item.id] || item.quantity}
                          onChange={(e) => updateQuantity(item.id, e.target.value, item.quantity)}
                        />
                      </td>
                      <td>{formatCurrency(item.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mb-5">
            <div className="card-header"><span className="card-title">{t('returns:form.returnDetails')}</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="reason">{t('returns:form.reason')}</label>
                  <select id="reason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="refundMethod">{t('returns:form.refundMethod')}</label>
                  <select id="refundMethod" className="form-control" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                    {REFUND_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/returns')}>{t('returns:form.cancel')}</button>
            <button type="submit" className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`} disabled={submitting}>
              {canApprove ? t('returns:form.approveReturn') : t('returns:form.submitRequest')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default ReturnForm;
