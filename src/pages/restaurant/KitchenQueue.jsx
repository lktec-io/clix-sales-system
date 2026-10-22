import { useCallback, useEffect, useMemo, useState } from 'react';
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
const LANES = ['new', 'preparing', 'ready'];
const WARN_MINUTES = 15;
const LATE_MINUTES = 30;

// Kitchen order tickets: each lane's items grouped by order, oldest first.
function groupTickets(items) {
  const byOrder = new Map();
  items.forEach((item) => {
    if (!byOrder.has(item.order_number)) {
      byOrder.set(item.order_number, { order: item.order_number, table: item.table_number, createdAt: item.order_created_at, items: [] });
    }
    byOrder.get(item.order_number).items.push(item);
  });
  return Array.from(byOrder.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function KitchenQueue() {
  const { t, i18n } = useTranslation(['restaurant', 'common']);
  const toast = useToast();
  const canManage = usePermission('kitchen.manage');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // Ticket age clock — ticks every 30s so timers stay current between polls.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';
  const formatTime = (isoString) => new Date(isoString).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

  const loadQueue = useCallback(() => {
    kitchenService.getKitchenQueue()
      .then((data) => {
        setItems(data);
        setUpdatedAt(new Date());
      })
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

  const lanes = useMemo(() => LANES.map((status) => {
    const laneItems = items.filter((item) => item.kitchen_status === status);
    return { status, count: laneItems.length, tickets: groupTickets(laneItems) };
  }), [items]);

  const ageMinutes = (iso) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  const ageTone = (minutes) => {
    if (minutes >= LATE_MINUTES) return 'late';
    if (minutes >= WARN_MINUTES) return 'warn';
    return 'ok';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('restaurant:kitchen.title')}</h1>
          <p className="page-subtitle">
            {t('restaurant:kitchen.subtitle')}
            {updatedAt && <span className="kitchen-updated"> · {t('restaurant:kitchen.updatedAt', { time: formatTime(updatedAt) })}</span>}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={loadQueue}>
            <FiRefreshCw aria-hidden="true" /> {t('restaurant:kitchen.refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="kitchen-board">
          {LANES.map((status) => (
            <div className="kitchen-lane" key={status}>
              <div className="kitchen-lane-header" data-status={status}>{t(`restaurant:kitchen.kitchenStatus.${status}`)}</div>
              <div className="kitchen-lane-body"><Skeleton height={140} /></div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t('restaurant:kitchen.empty')} />
      ) : (
        <div className="kitchen-board">
          {lanes.map((lane) => (
            <section className="kitchen-lane" key={lane.status} aria-label={t(`restaurant:kitchen.kitchenStatus.${lane.status}`)}>
              <div className="kitchen-lane-header" data-status={lane.status}>
                {t(`restaurant:kitchen.kitchenStatus.${lane.status}`)}
                <span className="kitchen-lane-count">{lane.count}</span>
              </div>
              <div className="kitchen-lane-body">
                {lane.tickets.length === 0 && <p className="kitchen-lane-empty">{t('restaurant:kitchen.laneEmpty')}</p>}
                {lane.tickets.map((ticket) => {
                  const minutes = ageMinutes(ticket.createdAt);
                  return (
                    <article key={ticket.order} className="kitchen-kot" data-age={ageTone(minutes)}>
                      <header className="kitchen-kot-header">
                        <span className="kitchen-kot-order">{ticket.order}</span>
                        <span className="kitchen-kot-age" title={formatTime(ticket.createdAt)}>{t('restaurant:kitchen.age', { count: minutes })}</span>
                      </header>
                      <div className="kitchen-kot-table">{ticket.table || t('restaurant:orders.takeaway')}</div>
                      <ul className="kitchen-kot-items">
                        {ticket.items.map((item) => (
                          <li key={item.id} className="kitchen-kot-item">
                            <span className="kitchen-ticket-qty">{item.quantity}×</span>
                            <span className="kitchen-kot-name">{item.menu_item_name}</span>
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
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default KitchenQueue;
