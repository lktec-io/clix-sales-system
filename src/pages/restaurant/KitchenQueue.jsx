import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiRefreshCw } from 'react-icons/fi';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as kitchenService from '../../services/kitchenService';
import '../../styles/pages/Kitchen.css';

// A ticket per still-in-flight item (new/preparing/ready), not per order —
// each dish is what kitchen staff actually act on. Polled rather than
// pushed: no websocket/real-time infrastructure exists anywhere else in
// this app, and a 15s refresh is more than fast enough for a kitchen
// screen that's also glanced at directly.
const POLL_INTERVAL_MS = 15000;

function KitchenQueue() {
  const { t, i18n } = useTranslation(['restaurant', 'common']);
  const toast = useToast();
  const canManage = usePermission('kitchen.manage');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatTime = (isoString) => new Date(isoString).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

  const loadQueue = useCallback(() => {
    kitchenService.getKitchenQueue()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const advanceItem = async (item) => {
    const nextStatus = item.kitchen_status === 'new' ? 'preparing' : 'ready';
    setUpdatingId(item.id);
    try {
      await kitchenService.updateItemStatus(item.id, nextStatus);
      toast.success(t('restaurant:kitchen.updateSuccess'));
      loadQueue();
    } catch {
      toast.error(t('restaurant:kitchen.updateError'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('restaurant:kitchen.title')}</h1>
          <p className="page-subtitle">{t('restaurant:kitchen.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={loadQueue}>
            <FiRefreshCw aria-hidden="true" /> {t('restaurant:kitchen.refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="kitchen-grid">
          {Array.from({ length: 4 }, (_, i) => `kitchen-skeleton-${i}`).map((key) => (
            <div className="card kitchen-ticket" key={key}><Skeleton height={140} /></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t('restaurant:kitchen.empty')} />
      ) : (
        <div className="kitchen-grid">
          {items.map((item) => (
            <div key={item.id} className={`card kitchen-ticket kitchen-ticket-${item.kitchen_status}`}>
              <div className="kitchen-ticket-header">
                <span className="kitchen-ticket-order">{item.order_number}</span>
                <span className="kitchen-ticket-time">{formatTime(item.order_created_at)}</span>
              </div>
              <div className="kitchen-ticket-table">{item.table_number || t('restaurant:orders.takeaway')}</div>
              <div className="kitchen-ticket-item">
                <span className="kitchen-ticket-qty">{item.quantity}×</span> {item.menu_item_name}
              </div>
              <div className="kitchen-ticket-footer">
                <span className={`badge badge-${item.kitchen_status === 'new' ? 'neutral' : item.kitchen_status === 'preparing' ? 'info' : 'warning'}`}>
                  {t(`restaurant:kitchen.kitchenStatus.${item.kitchen_status}`)}
                </span>
                {canManage && item.kitchen_status !== 'ready' && (
                  <button
                    type="button"
                    className={`btn btn-primary btn-sm ${updatingId === item.id ? 'btn-loading' : ''}`}
                    disabled={updatingId === item.id}
                    onClick={() => advanceItem(item)}
                  >
                    {t(item.kitchen_status === 'new' ? 'restaurant:kitchen.startPreparing' : 'restaurant:kitchen.markReady')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KitchenQueue;
