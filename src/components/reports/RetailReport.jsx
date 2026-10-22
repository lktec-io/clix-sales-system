import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiShoppingBag, FiDroplet } from 'react-icons/fi';
import { ReportShell, ReportSection, ReportGrid, ReportTable, BarList } from './ReportShell';
import BarChart from '../charts/BarChart';
import * as saleService from '../../services/saleService';
import * as productService from '../../services/productService';
import * as inventoryService from '../../services/inventoryService';
import { useReportLoader } from '../../hooks/useReportLoader';
import { fetchAllPages, inRange, eachDay, toDayKey, presetRange, sum, groupBy, percent } from '../../utils/reportData';
import { downloadCsv } from '../../utils/exportCsv';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import styles from './ModuleReports.module.css';

const SALE_BADGE = { completed: 'badge-success', voided: 'badge-danger' };

// Retail & Cosmetics: daily sales, receipts register and cashier summary
// from GET /sales. Cosmetics adds a stock-health view by category and brand
// (GET /products joined with GET /inventory) with brand filter pills.
function RetailReport({ cosmetics = false }) {
  const { t, i18n } = useTranslation(['reports', 'sales']);
  const navigate = useNavigate();
  const [range, setRange] = useState(() => presetRange('7d'));
  const [brand, setBrand] = useState('');
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';

  const sales = useReportLoader(async () => {
    const { items, truncated } = await fetchAllPages(
      ({ page, limit }) => saleService.listSales({ page, limit }),
      { isBeforeRange: (row) => toDayKey(row.created_at) < range.from },
    );
    return { rows: items.filter((row) => inRange(row.created_at, range.from, range.to)), truncated };
  }, [range.from, range.to]);

  const stock = useReportLoader(async () => {
    if (!cosmetics) return null;
    const [products, inventory] = await Promise.all([
      fetchAllPages(({ page, limit }) => productService.listProducts({ page, limit, status: 'active' }), { maxPages: 30 }),
      fetchAllPages(({ page, limit }) => inventoryService.listInventory({ page, limit }), { maxPages: 30 }),
    ]);
    const byProduct = new Map(products.items.map((p) => [p.id, p]));
    const rows = inventory.items.map((row) => {
      const product = byProduct.get(row.product_id) || {};
      const available = Number(row.available_quantity) || 0;
      const min = Number(row.min_stock) || 0;
      let health = 'ok';
      if (available <= 0) health = 'out';
      else if (available <= min) health = 'low';
      return {
        key: row.id,
        name: row.product_name,
        code: row.product_code,
        category: product.category_name || t('reports:business.uncategorised'),
        brand: product.brand_name || t('reports:business.noBrand'),
        branch: row.branch_name,
        available,
        min,
        value: Number(row.stock_value) || 0,
        health,
      };
    });
    return { rows, truncated: products.truncated || inventory.truncated };
  }, [cosmetics]);

  const report = useMemo(() => {
    const rows = sales.data?.rows || [];
    const completed = rows.filter((r) => r.status === 'completed');
    const voided = rows.filter((r) => r.status === 'voided');
    const revenue = sum(completed, (r) => r.total_amount);

    const daily = eachDay(range.from, range.to).map((day) => {
      const dayRows = completed.filter((r) => toDayKey(r.created_at) === day);
      const dayRevenue = sum(dayRows, (r) => r.total_amount);
      return {
        key: day,
        day,
        receipts: dayRows.length,
        revenue: dayRevenue,
        discounts: sum(dayRows, (r) => r.discount_amount),
        average: dayRows.length ? dayRevenue / dayRows.length : 0,
      };
    });

    const cashiers = groupBy(
      completed,
      (r) => `${r.cashier_first_name || ''} ${r.cashier_last_name || ''}`.trim() || '—',
      (key) => ({ key, cashier: key, receipts: 0, revenue: 0 }),
      (acc, r) => { acc.receipts += 1; acc.revenue += Number(r.total_amount) || 0; },
    ).sort((a, b) => b.revenue - a.revenue);

    return {
      rows,
      completed,
      revenue,
      receipts: completed.length,
      average: completed.length ? revenue / completed.length : 0,
      discounts: sum(completed, (r) => r.discount_amount),
      voidedCount: voided.length,
      voidedAmount: sum(voided, (r) => r.total_amount),
      daily,
      cashiers,
    };
  }, [sales.data, range.from, range.to]);

  const stockView = useMemo(() => {
    const all = stock.data?.rows || [];
    const brands = Array.from(new Set(all.map((r) => r.brand))).sort();
    const rows = brand ? all.filter((r) => r.brand === brand) : all;
    const categories = groupBy(
      rows,
      (r) => r.category,
      (key) => ({ key, category: key, products: 0, units: 0, value: 0, low: 0, out: 0 }),
      (acc, r) => {
        acc.products += 1;
        acc.units += r.available;
        acc.value += r.value;
        if (r.health === 'low') acc.low += 1;
        if (r.health === 'out') acc.out += 1;
      },
    ).sort((a, b) => b.value - a.value);
    return { brands, rows, categories, attention: rows.filter((r) => r.health !== 'ok') };
  }, [stock.data, brand]);

  const formatDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' });
  const formatWhen = (iso) => new Date(iso).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const exportCsv = () => downloadCsv(`sales-${range.from}-${range.to}`, report.rows.map((r) => ({
    receipt: r.sale_number,
    date: r.created_at,
    customer: r.customer_first_name ? `${r.customer_first_name} ${r.customer_last_name || ''}`.trim() : '',
    cashier: `${r.cashier_first_name || ''} ${r.cashier_last_name || ''}`.trim(),
    branch: r.branch_name,
    discount: r.discount_amount,
    total: r.total_amount,
    status: r.status,
  })));

  return (
    <ReportShell
      title={cosmetics ? t('reports:business.cosmetics.title') : t('reports:business.retail.title')}
      subtitle={cosmetics ? t('reports:business.cosmetics.subtitle') : t('reports:business.retail.subtitle')}
      icon={cosmetics ? FiDroplet : FiShoppingBag}
      range={range}
      onRangeChange={setRange}
      onRefresh={() => { sales.reload(); stock.reload(); }}
      onExport={exportCsv}
      loading={sales.loading}
      error={sales.error}
      notice={sales.data?.truncated ? t('reports:business.truncated') : null}
      stats={[
        { label: t('reports:business.stats.revenue'), value: formatCurrency(report.revenue), tone: 'positive' },
        { label: t('reports:business.stats.receipts'), value: formatNumber(report.receipts) },
        { label: t('reports:business.stats.averageTicket'), value: formatCurrency(report.average) },
        { label: t('reports:business.stats.discounts'), value: formatCurrency(report.discounts) },
        { label: t('reports:business.stats.voided'), value: formatNumber(report.voidedCount), hint: formatCurrency(report.voidedAmount), tone: report.voidedCount ? 'negative' : undefined },
      ]}
    >
      <ReportGrid>
        <ReportSection title={t('reports:business.retail.dailyChart')}>
          <div className={styles.chartPad}>
            <BarChart
              labels={report.daily.map((d) => formatDay(d.day))}
              values={report.daily.map((d) => d.revenue)}
              label={t('reports:business.stats.revenue')}
              valueFormatter={formatCurrency}
              height={240}
            />
          </div>
        </ReportSection>

        <ReportSection title={t('reports:business.retail.cashiers')}>
          <ReportTable
            loading={sales.loading}
            rows={report.cashiers}
            columns={[
              { key: 'cashier', label: t('sales:columns.cashier') },
              { key: 'receipts', label: t('reports:business.stats.receipts'), numeric: true, render: (r) => formatNumber(r.receipts) },
              { key: 'revenue', label: t('reports:business.stats.revenue'), numeric: true, render: (r) => formatCurrency(r.revenue) },
              { key: 'share', label: t('reports:business.share'), numeric: true, render: (r) => `${percent(r.revenue, report.revenue).toFixed(1)}%` },
            ]}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.retail.daily')} wide>
          <ReportTable
            loading={sales.loading}
            rows={report.daily}
            columns={[
              { key: 'day', label: t('sales:columns.date'), render: (r) => formatDay(r.day) },
              { key: 'receipts', label: t('reports:business.stats.receipts'), numeric: true, render: (r) => formatNumber(r.receipts) },
              { key: 'discounts', label: t('reports:business.stats.discounts'), numeric: true, render: (r) => formatCurrency(r.discounts) },
              { key: 'average', label: t('reports:business.stats.averageTicket'), numeric: true, render: (r) => formatCurrency(r.average) },
              { key: 'revenue', label: t('reports:business.stats.revenue'), numeric: true, render: (r) => formatCurrency(r.revenue) },
            ]}
            footer={{
              day: t('reports:business.total'),
              receipts: formatNumber(report.receipts),
              discounts: formatCurrency(report.discounts),
              average: formatCurrency(report.average),
              revenue: formatCurrency(report.revenue),
            }}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.retail.receipts')} wide>
          <ReportTable
            loading={sales.loading}
            rows={report.rows.map((r) => ({ ...r, key: r.id }))}
            maxRows={100}
            columns={[
              { key: 'sale_number', label: t('sales:columns.saleNumber'), render: (r) => <button type="button" className={styles.linkCell} onClick={() => navigate(`/pos/sales/${r.id}`)}>{r.sale_number}</button> },
              { key: 'created_at', label: t('sales:columns.date'), render: (r) => <span className={styles.mono}>{formatWhen(r.created_at)}</span> },
              { key: 'customer', label: t('sales:columns.customer'), render: (r) => (r.customer_first_name ? `${r.customer_first_name} ${r.customer_last_name || ''}` : t('reports:business.walkIn')) },
              { key: 'cashier', label: t('sales:columns.cashier'), render: (r) => `${r.cashier_first_name || ''} ${r.cashier_last_name || ''}` },
              { key: 'total_amount', label: t('sales:columns.amount'), numeric: true, render: (r) => formatCurrency(r.total_amount) },
              { key: 'status', label: t('sales:columns.status'), render: (r) => <span className={`badge ${SALE_BADGE[r.status] || 'badge-neutral'}`}>{t(`sales:status.${r.status}`, { defaultValue: r.status })}</span> },
            ]}
          />
        </ReportSection>
      </ReportGrid>

      {cosmetics && (
        <>
          <div className={styles.filterBar}>
            <span className={styles.filterLabel}>{t('reports:business.cosmetics.brandFilter')}</span>
            <div className={styles.pills} role="group" aria-label={t('reports:business.cosmetics.brandFilter')}>
              <button type="button" className={styles.pill} aria-pressed={brand === ''} onClick={() => setBrand('')}>{t('reports:business.all')}</button>
              {stockView.brands.map((name) => (
                <button key={name} type="button" className={styles.pill} aria-pressed={brand === name} onClick={() => setBrand(name)}>{name}</button>
              ))}
            </div>
          </div>

          <ReportGrid>
            <ReportSection title={t('reports:business.cosmetics.byCategory')}>
              <ReportTable
                loading={stock.loading}
                rows={stockView.categories}
                columns={[
                  { key: 'category', label: t('reports:business.category') },
                  { key: 'products', label: t('reports:business.products'), numeric: true, render: (r) => formatNumber(r.products) },
                  { key: 'units', label: t('reports:business.units'), numeric: true, render: (r) => formatNumber(r.units) },
                  { key: 'value', label: t('reports:business.stockValue'), numeric: true, render: (r) => formatCurrency(r.value) },
                  { key: 'low', label: t('reports:business.low'), numeric: true, render: (r) => (r.low || r.out ? <span className="badge badge-warning">{r.low + r.out}</span> : '0') },
                ]}
              />
            </ReportSection>

            <ReportSection title={t('reports:business.cosmetics.stockHealth')}>
              <BarList
                items={[
                  { label: t('reports:business.health.ok'), value: stockView.rows.filter((r) => r.health === 'ok').length, tone: 'positive' },
                  { label: t('reports:business.health.low'), value: stockView.rows.filter((r) => r.health === 'low').length, tone: 'warning' },
                  { label: t('reports:business.health.out'), value: stockView.rows.filter((r) => r.health === 'out').length, tone: 'negative' },
                ]}
                formatValue={formatNumber}
              />
            </ReportSection>

            <ReportSection title={t('reports:business.cosmetics.attention')} wide>
              <ReportTable
                loading={stock.loading}
                rows={stockView.attention}
                maxRows={60}
                emptyMessage={t('reports:business.cosmetics.allHealthy')}
                columns={[
                  { key: 'name', label: t('reports:business.product') },
                  { key: 'code', label: t('reports:business.code'), render: (r) => <span className={styles.mono}>{r.code}</span> },
                  { key: 'brand', label: t('reports:business.brand') },
                  { key: 'branch', label: t('reports:business.branch') },
                  { key: 'available', label: t('reports:business.available'), numeric: true, render: (r) => formatNumber(r.available) },
                  { key: 'min', label: t('reports:business.minStock'), numeric: true, render: (r) => formatNumber(r.min) },
                  { key: 'health', label: t('sales:columns.status'), render: (r) => <span className={`badge ${r.health === 'out' ? 'badge-danger' : 'badge-warning'}`}>{t(`reports:business.health.${r.health}`)}</span> },
                ]}
              />
            </ReportSection>
          </ReportGrid>
        </>
      )}
    </ReportShell>
  );
}

export default RetailReport;
