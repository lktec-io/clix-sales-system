import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiSend, FiCheck, FiDollarSign, FiX } from 'react-icons/fi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import PageSkeleton from '../../components/common/PageSkeleton';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as restaurantOrderService from '../../services/restaurantOrderService';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_BADGE = {
  open: 'badge-neutral', sent_to_kitchen: 'badge-info', preparing: 'badge-info',
  ready: 'badge-warning', served: 'badge-warning', paid: 'badge-success',
  completed: 'badge-success', cancelled: 'badge-danger',
};

const KITCHEN_BADGE = { new: 'badge-neutral', preparing: 'badge-info', ready: 'badge-warning', served: 'badge-success' };

function OrderDetail() {
  const { t, i18n } = useTranslation(['restaurant', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const canManage = usePermission('restaurant_orders.manage');

  const [order, setOrder] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatDateTime = (isoString) => new Date(isoString).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const paymentForm = useForm({ defaultValues: { paymentMethod: 'cash' } });

  const loadOrder = useCallback(() => {
    restaurantOrderService.getOrder(id).then(setOrder);
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (!order) {
    return <PageSkeleton />;
  }

  const runAction = async (action, successKey) => {
    setActionError('');
    setActionLoading(true);
    try {
      await action();
      toast.success(t(successKey));
      loadOrder();
    } catch (err) {
      setActionError(err.response?.data?.message || t('restaurant:orders.detail.actionError'));
    } finally {
      setActionLoading(false);
      setDialog(null);
    }
  };

  const submitPayment = async (values) => {
    setActionError('');
    try {
      await restaurantOrderService.recordPayment(order.id, values.paymentMethod);
      toast.success(t('restaurant:orders.detail.actionSuccess'));
      setPaymentModalOpen(false);
      loadOrder();
    } catch (err) {
      setActionError(err.response?.data?.message || t('restaurant:orders.detail.actionError'));
    }
  };

  const canSend = canManage && order.status === 'open';
  const canServe = canManage && order.status === 'ready';
  const canPay = canManage && order.status === 'served';
  const canCancel = canManage && !['paid', 'completed', 'cancelled'].includes(order.status);

  const customerName = order.customer_first_name ? `${order.customer_first_name} ${order.customer_last_name}` : t('restaurant:orders.walkIn');

  return (
    <div>
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={() => navigate('/restaurant/orders')}>
            <FiArrowLeft aria-hidden="true" /> {t('restaurant:orders.detail.backToOrders')}
          </button>
          <h1 className="page-title">{order.order_number}</h1>
          <p className="page-subtitle">
            {order.table_number || t('restaurant:orders.takeaway')} · {customerName} · {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="page-actions">
          {canSend && (
            <button type="button" className="btn btn-primary" onClick={() => runAction(() => restaurantOrderService.sendToKitchen(order.id), 'restaurant:orders.detail.actionSuccess')} disabled={actionLoading}>
              <FiSend aria-hidden="true" /> {t('restaurant:orders.detail.sendToKitchen')}
            </button>
          )}
          {canServe && (
            <button type="button" className="btn btn-primary" onClick={() => runAction(() => restaurantOrderService.markServed(order.id), 'restaurant:orders.detail.actionSuccess')} disabled={actionLoading}>
              <FiCheck aria-hidden="true" /> {t('restaurant:orders.detail.markServed')}
            </button>
          )}
          {canPay && (
            <button type="button" className="btn btn-primary" onClick={() => setPaymentModalOpen(true)}>
              <FiDollarSign aria-hidden="true" /> {t('restaurant:orders.detail.completePayment')}
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-danger" onClick={() => setDialog('cancel')}>
              <FiX aria-hidden="true" /> {t('restaurant:orders.detail.cancelOrder')}
            </button>
          )}
        </div>
      </div>

      {actionError && <div className="alert alert-danger mb-4" role="alert">{actionError}</div>}

      <div className="card mb-5">
        <div className="card-body">
          <div className="form-row">
            <div>
              <span className="text-xs text-secondary">{t('restaurant:orders.columns.status')}</span>
              <div><span className={`badge ${STATUS_BADGE[order.status] || 'badge-neutral'}`}>{t(`restaurant:orders.status.${order.status}`)}</span></div>
            </div>
            {order.payment_method && (
              <div>
                <span className="text-xs text-secondary">{t('restaurant:orders.detail.paymentMethodLabel')}</span>
                <div className="text-sm">{t(`restaurant:orders.paymentMethods.${order.payment_method}`)}</div>
              </div>
            )}
            <div>
              <span className="text-xs text-secondary">{t('restaurant:orders.columns.branch')}</span>
              <div className="text-sm">{order.branch_name}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('restaurant:orders.detail.itemsTitle')}</span></div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('restaurant:orders.itemColumns.item')}</th>
                <th>{t('restaurant:orders.itemColumns.quantity')}</th>
                <th>{t('restaurant:orders.itemColumns.unitPrice')}</th>
                <th>{t('restaurant:orders.itemColumns.lineTotal')}</th>
                <th>{t('restaurant:orders.itemColumns.kitchenStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.menu_item_name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                  <td>{formatCurrency(item.line_total)}</td>
                  <td><span className={`badge ${KITCHEN_BADGE[item.kitchen_status] || 'badge-neutral'}`}>{t(`restaurant:kitchen.kitchenStatus.${item.kitchen_status}`)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer flex justify-end">
          <span className="text-lg font-semibold">{t('restaurant:orders.detail.totalLabel')}: {formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction(() => restaurantOrderService.cancelOrder(order.id), 'restaurant:orders.detail.actionSuccess')}
        title={t('restaurant:orders.detail.cancelConfirmTitle')}
        message={t('restaurant:orders.detail.cancelConfirmMessage')}
        confirmLabel={t('restaurant:orders.detail.cancelConfirmButton')}
        variant="danger"
      />

      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={t('restaurant:orders.detail.completePayment')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPaymentModalOpen(false)}>{t('common:actions.cancel')}</button>
            <button type="submit" form="payment-form" className="btn btn-primary">{t('restaurant:orders.detail.confirmPayment')}</button>
          </>
        }
      >
        <div className="form-group">
          <span className="text-xs text-secondary">{t('restaurant:orders.detail.totalLabel')}</span>
          <div className="text-sm font-semibold">{formatCurrency(order.total_amount)}</div>
        </div>
        <form id="payment-form" onSubmit={paymentForm.handleSubmit(submitPayment)} noValidate>
          <div className="form-group mb-0">
            <label className="form-label" htmlFor="paymentMethod">{t('restaurant:orders.detail.paymentMethodLabel')}</label>
            <select id="paymentMethod" className="form-control" {...paymentForm.register('paymentMethod')}>
              <option value="cash">{t('restaurant:orders.paymentMethods.cash')}</option>
              <option value="mobile_money">{t('restaurant:orders.paymentMethods.mobile_money')}</option>
              <option value="bank_transfer">{t('restaurant:orders.paymentMethods.bank_transfer')}</option>
              <option value="card">{t('restaurant:orders.paymentMethods.card')}</option>
              <option value="other">{t('restaurant:orders.paymentMethods.other')}</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default OrderDetail;
