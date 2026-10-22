import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiTool } from 'react-icons/fi';
import { ReportShell, ReportSection, ReportGrid, ReportTable, BarList } from './ReportShell';
import ProgressBar from '../common/ProgressBar';
import * as repairService from '../../services/repairService';
import { useReportLoader } from '../../hooks/useReportLoader';
import { fetchAllPages, presetRange, sum, groupBy, percent, formatDuration } from '../../utils/reportData';
import { downloadCsv } from '../../utils/exportCsv';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';
import styles from './ModuleReports.module.css';

// Same 5-stage journey the job card stepper shows.
const STAGES = [
  { key: 'received', statuses: ['received'] },
  { key: 'diagnosis', statuses: ['diagnosis', 'waiting_approval', 'approved'] },
  { key: 'repair', statuses: ['in_repair'] },
  { key: 'ready', statuses: ['ready_for_collection'] },
  { key: 'collected', statuses: ['completed'] },
];
const ENDED = ['cancelled', 'rejected', 'unrepairable'];

const STATUS_BADGE = {
  received: 'badge-neutral', diagnosis: 'badge-info', waiting_approval: 'badge-warning',
  approved: 'badge-info', in_repair: 'badge-info', ready_for_collection: 'badge-warning',
  completed: 'badge-success', cancelled: 'badge-danger', rejected: 'badge-danger', unrepairable: 'badge-danger',
};

const hoursBetween = (start, end) => (new Date(end) - new Date(start)) / 3_600_000;

// Technician performance & job-card analytics for jobs received in the
// selected range (GET /repairs filters by received date server-side).
function RepairReport() {
  const { t, i18n } = useTranslation(['reports', 'electronics']);
  const navigate = useNavigate();
  const [range, setRange] = useState(() => presetRange('30d'));
  const dateLocale = i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ';

  const jobs = useReportLoader(
    () => fetchAllPages(({ page, limit }) => repairService.listRepairs({ page, limit, dateFrom: range.from, dateTo: range.to })),
    [range.from, range.to],
  );

  const report = useMemo(() => {
    const rows = jobs.data?.items || [];
    const completed = rows.filter((r) => r.status === 'completed' && r.completed_at);
    const turnaround = completed.map((r) => hoursBetween(r.received_at, r.completed_at)).filter((h) => h > 0);
    const balanceOf = (r) => Math.max(0, (Number(r.repair_total) || 0) - (Number(r.amount_paid) || 0));

    const technicians = groupBy(
      rows,
      (r) => (r.technician_id ? `${r.technician_first_name || ''} ${r.technician_last_name || ''}`.trim() : t('reports:business.repair.unassigned')),
      (key) => ({ key, technician: key, jobs: 0, completed: 0, active: 0, ended: 0, hours: [], revenue: 0, collected: 0 }),
      (acc, r) => {
        acc.jobs += 1;
        if (r.status === 'completed') acc.completed += 1;
        else if (ENDED.includes(r.status)) acc.ended += 1;
        else acc.active += 1;
        if (r.status === 'completed' && r.completed_at) acc.hours.push(hoursBetween(r.received_at, r.completed_at));
        acc.revenue += Number(r.repair_total) || 0;
        acc.collected += Number(r.amount_paid) || 0;
      },
    ).map((tech) => ({
      ...tech,
      rate: percent(tech.completed, tech.jobs - tech.ended || tech.jobs),
      avgHours: tech.hours.length ? tech.hours.reduce((a, b) => a + b, 0) / tech.hours.length : NaN,
    })).sort((a, b) => b.completed - a.completed);

    const stageCounts = STAGES.map((stage) => ({
      label: t(`electronics:repairs.stepper.${stage.key}`),
      value: rows.filter((r) => stage.statuses.includes(r.status)).length,
      tone: stage.key === 'collected' ? 'positive' : undefined,
    }));
    stageCounts.push({ label: t('reports:business.repair.ended'), value: rows.filter((r) => ENDED.includes(r.status)).length, tone: 'negative' });

    const closable = rows.filter((r) => !ENDED.includes(r.status)).length;
    return {
      rows,
      jobsCount: rows.length,
      completedCount: rows.filter((r) => r.status === 'completed').length,
      completionRate: percent(rows.filter((r) => r.status === 'completed').length, closable),
      avgHours: turnaround.length ? turnaround.reduce((a, b) => a + b, 0) / turnaround.length : NaN,
      revenue: sum(rows, (r) => r.repair_total),
      outstanding: sum(rows, balanceOf),
      technicians,
      stageCounts,
      balanceOf,
    };
  }, [jobs.data, t]);

  const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' }) : '—');

  const exportCsv = () => downloadCsv(`repairs-${range.from}-${range.to}`, report.rows.map((r) => ({
    job: r.repair_number,
    received: r.received_at,
    completed: r.completed_at || '',
    device: `${r.brand || ''} ${r.model || ''}`.trim(),
    customer: `${r.customer_first_name || ''} ${r.customer_last_name || ''}`.trim(),
    technician: r.technician_id ? `${r.technician_first_name || ''} ${r.technician_last_name || ''}`.trim() : '',
    status: r.status,
    total: r.repair_total,
    paid: r.amount_paid,
  })));

  return (
    <ReportShell
      title={t('reports:business.repair.title')}
      subtitle={t('reports:business.repair.subtitle')}
      icon={FiTool}
      range={range}
      onRangeChange={setRange}
      onRefresh={jobs.reload}
      onExport={exportCsv}
      loading={jobs.loading}
      error={jobs.error}
      notice={jobs.data?.truncated ? t('reports:business.truncated') : null}
      stats={[
        { label: t('reports:business.repair.jobs'), value: formatNumber(report.jobsCount) },
        { label: t('reports:business.repair.completed'), value: formatNumber(report.completedCount), tone: 'positive' },
        { label: t('reports:business.repair.completionRate'), value: `${report.completionRate.toFixed(1)}%` },
        { label: t('reports:business.repair.avgTurnaround'), value: formatDuration(report.avgHours, t) },
        { label: t('reports:business.repair.billed'), value: formatCurrency(report.revenue) },
        { label: t('reports:business.repair.outstanding'), value: formatCurrency(report.outstanding), tone: report.outstanding ? 'warning' : undefined },
      ]}
    >
      <ReportGrid>
        <ReportSection title={t('reports:business.repair.technicians')} wide>
          <ReportTable
            loading={jobs.loading}
            rows={report.technicians}
            columns={[
              { key: 'technician', label: t('reports:business.repair.technician') },
              { key: 'jobs', label: t('reports:business.repair.jobs'), numeric: true, render: (r) => formatNumber(r.jobs) },
              { key: 'active', label: t('reports:business.repair.inProgress'), numeric: true, render: (r) => formatNumber(r.active) },
              { key: 'completed', label: t('reports:business.repair.completed'), numeric: true, render: (r) => formatNumber(r.completed) },
              { key: 'rate', label: t('reports:business.repair.completionRate'), render: (r) => <ProgressBar size="sm" value={r.rate / 100} label={t('reports:business.repair.completionRate')} /> },
              { key: 'avgHours', label: t('reports:business.repair.avgTurnaround'), numeric: true, render: (r) => formatDuration(r.avgHours, t) },
              { key: 'revenue', label: t('reports:business.repair.billed'), numeric: true, render: (r) => formatCurrency(r.revenue) },
              { key: 'collected', label: t('reports:business.repair.collected'), numeric: true, render: (r) => formatCurrency(r.collected) },
            ]}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.repair.pipeline')}>
          <BarList items={report.stageCounts} formatValue={formatNumber} />
        </ReportSection>

        <ReportSection title={t('reports:business.repair.unpaid')}>
          <ReportTable
            loading={jobs.loading}
            rows={report.rows.filter((r) => report.balanceOf(r) > 0 && !ENDED.includes(r.status)).map((r) => ({ ...r, key: r.id }))}
            maxRows={12}
            emptyMessage={t('reports:business.repair.noUnpaid')}
            columns={[
              { key: 'repair_number', label: t('reports:business.repair.job'), render: (r) => <button type="button" className={styles.linkCell} onClick={() => navigate(`/repairs/${r.id}`)}>{r.repair_number}</button> },
              { key: 'customer', label: t('reports:business.customer'), render: (r) => `${r.customer_first_name || ''} ${r.customer_last_name || ''}` },
              { key: 'balance', label: t('reports:business.repair.balance'), numeric: true, render: (r) => formatCurrency(report.balanceOf(r)) },
            ]}
          />
        </ReportSection>

        <ReportSection title={t('reports:business.repair.register')} wide>
          <ReportTable
            loading={jobs.loading}
            rows={report.rows.map((r) => ({ ...r, key: r.id }))}
            maxRows={100}
            columns={[
              { key: 'repair_number', label: t('reports:business.repair.job'), render: (r) => <button type="button" className={styles.linkCell} onClick={() => navigate(`/repairs/${r.id}`)}>{r.repair_number}</button> },
              { key: 'device', label: t('reports:business.repair.device'), render: (r) => `${r.brand || ''} ${r.model || ''}` },
              { key: 'technician', label: t('reports:business.repair.technician'), render: (r) => (r.technician_id ? `${r.technician_first_name || ''} ${r.technician_last_name || ''}` : <span className={styles.muted}>{t('reports:business.repair.unassigned')}</span>) },
              { key: 'received_at', label: t('reports:business.repair.receivedOn'), render: (r) => <span className={styles.mono}>{formatDate(r.received_at)}</span> },
              { key: 'completed_at', label: t('reports:business.repair.completedOn'), render: (r) => <span className={styles.mono}>{formatDate(r.completed_at)}</span> },
              { key: 'repair_total', label: t('reports:business.repair.billed'), numeric: true, render: (r) => formatCurrency(r.repair_total) },
              { key: 'status', label: t('reports:business.status'), render: (r) => <span className={`badge ${STATUS_BADGE[r.status] || 'badge-neutral'}`}>{t(`electronics:repairs.status.${r.status}`)}</span> },
            ]}
          />
        </ReportSection>
      </ReportGrid>
    </ReportShell>
  );
}

export default RepairReport;
