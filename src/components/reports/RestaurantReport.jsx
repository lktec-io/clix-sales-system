import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCoffee, FiLayers } from 'react-icons/fi';
import { ReportShell, ReportSection, ReportGrid, ReportTable, BarList } from './ReportShell';
import BarChart from '../charts/BarChart';
import * as restaurantOrderService from '../../services/restaurantOrderService';
import * as menuItemService from '../../services/menuItemService';
import { useReportLoader } from '../../hooks/useReportLoader';
import { fetchAllPages, inRange, toDayKey, presetRange, sum, groupBy, percent } from '../../utils/reportData';
import { downloadCsv } from '../../utils/exportCsv';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import styles from './ModuleReports.module.css';

const SETTLED = ['paid', 'completed'];
const ITEM_DETAIL_CAP = 60;
const STATUS_BADGE = {
  open: 'badge-neutral', sent_to_kitchen: 'badge-info', preparing: 'badge-info', ready: 'badge-warning',
  served: 'badge-warning', paid: 'badge-success', completed: 'badge-success', cancelled: 'badge-danger',
};

// Food & Beverage summary for the selected days: order-level figures from
// GET /restaurant/orders, plus an on-demand item & category breakdown read
// from the settled orders' own line items (capped, and labelled when capped).
function RestaurantReport() {
  const { t, i18n } = useTranslation(['reports', 'restaurant']);
  const navigate = useNavigate();
  const [range, setRange] = useState(() => presetRange('today'));
  const [items, setItems] = useState({ status: 'idle', rows: [], categories: [], sampled: 0, total: 0, rangeKey: '' });
  const rangeKey = `${range.from}:${range.to}`;
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';

  const orders = useReportLoader(async () => {
    const { items: rows, truncated } = await fetchAllPages(
      ({ page, limit }) => restaurantOrderService.listOrders({ page, limit }),
      { isBeforeRange: (row) => toDayKey(row.created_at) < range.from },
    );
    return { rows: rows.filter((row) => inRange(row.created_at, range.from, range.to)), truncated };
  }, [range.from, range.to]);

  const report = useMemo(() => {
    const rows = orders.data?.rows || [];
    const settled = rows.filter((r) => SETTLED.includes(r.status));
    const revenue = sum(settled, (r) => r.total_amount);
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }));
    settled.forEach((r) => {
      const slot = hours[new Date(r.created_at).getHours()];
      slot.orders += 1;
      slot.revenue += Number(r.total_amount) || 0;
    });
    const activeHours = hours.filter((h) => h.orders > 0);
    const firstHour = activeHours.length ? activeHours[0].hour : 8;
    const lastHour = activeHours.length ? activeHours[activeHours.length - 1].hour : 22;

    return {
      rows,
      settled,
      revenue,
      average: settled.length ? revenue / settled.length : 0,
      cancelled: rows.filter((r) => r.status === 'cancelled').length,
      open: rows.filter((r) => !SETTLED.includes(r.status) && r.status !== 'cancelled').length,
      hours: hours.slice(Math.min(firstHour, 8), Math.max(lastHour, 22) + 1),
      tables: groupBy(
        settled,
        (r) => r.table_number || t('restaurant:orders.takeaway'),
        (key) => ({ key, table: key, orders: 0, revenue: 0 }),
        (acc, r) => { acc.orders += 1; acc.revenue += Number(r.total_amount) || 0; },
      ).sort((a, b) => b.revenue - a.revenue),
      payments: groupBy(
        settled,
        (r) => r.payment_method || 'other',
        (key) => ({ key, method: key, orders: 0, revenue: 0 }),
        (acc, r) => { acc.orders += 1; acc.revenue += Number(r.total_amount) || 0; },
      ).sort((a, b) => b.revenue - a.revenue),
    };
  }, [orders.data, t]);

  // Item & category breakdown — fetches each settled order's lines.
  const loadItems = async () => {
    const sample = report.settled.slice(0, ITEM_DETAIL_CAP);
    setItems({ status: 'loading', rows: [], categories: [], sampled: sample.length, total: report.settled.length, rangeKey });
    try {
      const [menu, details] = await Promise.all([
        menuItemService.listActiveMenuItems().catch(() => []),
        Promise.all(sample.map((order) => restaurantOrderService.getOrder(order.id))),
      ]);
      const categoryOf = new Map((menu || []).map((m) => [m.id, m.category_name || t('reports:business.uncategorised')]));
      const lines = details.flatMap((order) => order.items || []);
      const rows = groupBy(
        lines,
        (line) => line.menu_item_name || `#${line.menu_item_id}`,
        (key) => ({ key, item: key, category: '', quantity: 0, revenue: 0 }),
        (acc, line) => {
          acc.category = categoryOf.get(line.menu_item_id) || t('reports:business.uncategorised');
          acc.quantity += Number(line.quantity) || 0;
          acc.revenue += Number(line.line_total) || 0;
        },
      ).sort((a, b) => b.revenue - a.revenue);
      const categories = groupBy(
        rows,
        (r) => r.category,
        (key) => ({ key, label: key, value: 0, quantity: 0 }),
        (acc, r) => { acc.value += r.revenue; acc.quantity += r.quantity; },
      ).sort((a, b) => b.value - a.value);
      setItems({ status: 'ready', rows, categories, sampled: sample.length, total: report.settled.length, rangeKey });
    } catch {
      setItems((prev) => ({ ...prev, status: 'error' }));
    }
  };

  const itemsCurrent = items.rangeKey === rangeKey ? items : { status: 'idle', rows: [], categories: [] };
  const formatWhen = (iso) => new Date(iso).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const exportCsv = () => downloadCsv(`restaurant-${range.from}-${range.to}`, report.rows.map((r) => ({
    order: r.order_number,
    date: r.created_at,
    table: r.table_number || '',
    status: r.status,
    payment: r.payment_method || '',
    total: r.total_amount,
  })));

  return (
    <ReportShell
      title={t('reports:business.restaurant.title')}
      subtitle={t('reports:business.restaurant.subtitle')}
      icon={FiCoffee}
      range={range}
      onRangeChange={setRange}
      onRefresh={orders.reload}
      onExport={exportCsv}
      loading={orders.loading}
      error={orders.error}
      notice={orders.data?.truncated ? t('reports:business.truncated') : null}
      stats={[
        { label: t('reports:business.restaurant.settledOrders'), value: formatNumber(report.settled.length) },
        { label: t('reports:business.stats.revenue'), value: formatCurrency(report.revenue), tone: 'positive' },
        { label: t('reports:business.stats.averageTicket'), value: formatCurrency(report.average) },
        { label: t('reports:business.restaurant.openOrders'), value: formatNumber(report.open), tone: report.open ? 'warning' : undefined },
        { label: t('reports:business.restaurant.cancelled'), value: formatNumber(report.cancelled), tone: report.cancelled ? 'negative' : undefined },
      ]}
    >
      <ReportGrid>
        <ReportSection title={t('reports:business.restaurant.byHour')} wide>
          <div className={styles.chartPad}>
            <BarChart
              labels={report.hours.map((h) => `${String(h.hour).padStart(2, '0')}:00`)}
              values={report.hours.map((h) => h.revenue)}
              label={t('reports:business.stats.revenue')}
              valueFormatter={formatCurrency}
              height={220}
            />
          </div>
        </ReportSection>

        <ReportSection
          title={t('reports:business.restaurant.fnb')}
          wide
          actions={itemsCurrent.status !== 'loading' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadItems} disabled={orders.loading || report.settled.length === 0}>
              <FiLayers aria-hidden="true" /> {itemsCurrent.status === 'ready' ? t('reports:business.restaurant.reloadItems') : t('reports:business.restaurant.loadItems')}
            </button>
          )}
        >
          {itemsCurrent.status === 'idle' && <p className={`${styles.chartPad} ${styles.muted}`}>{t('reports:business.restaurant.itemsHint', { cap: ITEM_DETAIL_CAP })}</p>}
          {itemsCurrent.status === 'error' && <p className={styles.chartPad}>{t('reports:business.loadError')}</p>}
          {(itemsCurrent.status === 'loading' || itemsCurrent.status === 'ready') && (
            <ReportGrid>
              <div>
                {itemsCurrent.status === 'ready' && itemsCurrent.sampled < itemsCurrent.total && (
                  <p className={`${styles.chartPad} ${styles.muted}`}>{t('reports:business.restaurant.sampled', { sampled: itemsCurrent.sampled, total: itemsCurrent.total })}</p>
                )}
                <BarList items={itemsCurrent.categories} formatValue={formatCurrency} />
              </div>
              <ReportTable
                loading={itemsCurrent.status === 'loading'}
                rows={itemsCurrent.rows}
                maxRows={15}
                columns={[
                  { key: 'item', label: t('reports:business.restaurant.item') },
                  { key: 'category', label: t('reports:business.category') },
                  { key: 'quantity', label: t('reports:business.restaurant.qty'), numeric: true, render: (r) => formatNumber(r.quantity) },
                  { key: 'revenue', label: t('reports:business.stats.revenue'), numeric: true, render: (r) => formatCurrency(r.revenue) },
                ]}
              />
            </ReportGrid>
          )}
        </ReportSection>

        <ReportSection title={t('reports:business.restaurant.byTable')}>
          <ReportTable
            loading={orders.loading}
            rows={report.tables}
            maxRows={15}
            columns={[
              { key: 'table', label: t('reports:business.restaurant.table') },
              { key: 'orders', label: t('reports:business.restaurant.orders'), numeric: true, render: (r) => formatNumber(r.orders) },
              { key: 'revenue', label: t('reports:business.stats.revenue'), numeric: true, render: (r) => formatCurrency(r.revenue) },
            ]}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.restaurant.byPayment')}>
          <ReportTable
            loading={orders.loading}
            rows={report.payments}
            columns={[
              { key: 'method', label: t('reports:business.paymentMethod'), render: (r) => t(`reports:business.payment.${r.method}`, { defaultValue: r.method }) },
              { key: 'orders', label: t('reports:business.restaurant.orders'), numeric: true, render: (r) => formatNumber(r.orders) },
              { key: 'share', label: t('reports:business.share'), numeric: true, render: (r) => `${percent(r.revenue, report.revenue).toFixed(1)}%` },
              { key: 'revenue', label: t('reports:business.stats.revenue'), numeric: true, render: (r) => formatCurrency(r.revenue) },
            ]}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.restaurant.register')} wide>
          <ReportTable
            loading={orders.loading}
            rows={report.rows.map((r) => ({ ...r, key: r.id }))}
            maxRows={100}
            columns={[
              { key: 'order_number', label: t('reports:business.restaurant.order'), render: (r) => <button type="button" className={styles.linkCell} onClick={() => navigate(`/restaurant/orders/${r.id}`)}>{r.order_number}</button> },
              { key: 'created_at', label: t('reports:business.date'), render: (r) => <span className={styles.mono}>{formatWhen(r.created_at)}</span> },
              { key: 'table', label: t('reports:business.restaurant.table'), render: (r) => r.table_number || t('restaurant:orders.takeaway') },
              { key: 'total_amount', label: t('reports:business.total'), numeric: true, render: (r) => formatCurrency(r.total_amount) },
              { key: 'status', label: t('reports:business.status'), render: (r) => <span className={`badge ${STATUS_BADGE[r.status] || 'badge-neutral'}`}>{t(`restaurant:orders.status.${r.status}`, { defaultValue: r.status })}</span> },
            ]}
          />
        </ReportSection>
      </ReportGrid>
    </ReportShell>
  );
}

export default RestaurantReport;
