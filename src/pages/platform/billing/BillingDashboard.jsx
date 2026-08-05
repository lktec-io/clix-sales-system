import { useEffect, useState } from 'react';
import { FiDollarSign, FiCheckCircle, FiClock, FiXCircle, FiTrendingUp, FiUserPlus, FiBarChart2, FiAward } from 'react-icons/fi';
import KPICard from '../../../components/dashboard/KPICard';
import * as platformDashboardService from '../../../services/platformDashboardService';
import { formatCurrency, formatNumber } from '../../../utils/formatCurrency';

function BillingDashboard() {
  const [kpis, setKpis] = useState(null);
  const [billingKpis, setBillingKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // "Monthly Signups" is already computed by the existing dashboard KPI
    // endpoint (thisMonthRegistrations) — reused here instead of a
    // duplicate query, per Step 13's "avoid duplicate calculations".
    Promise.all([
      platformDashboardService.getKpis(),
      platformDashboardService.getBillingKpis(),
    ]).then(([kpiResult, billingResult]) => {
      if (cancelled) return;
      setKpis(kpiResult);
      setBillingKpis(billingResult);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const mostPopularPlanLabel = billingKpis?.mostPopularPlan
    ? `${billingKpis.mostPopularPlan.planName} (${billingKpis.mostPopularPlan.subscriberCount})`
    : 'N/A';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing Dashboard</h1>
          <p className="page-subtitle">Projected revenue and subscription health across every tenant.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          icon={FiDollarSign} label="Monthly Revenue (Projected)"
          value={loading || !billingKpis ? 0 : billingKpis.monthlyRevenueProjected}
          formatter={(v) => formatCurrency(v)} accent="#10B981"
        />
        <KPICard
          icon={FiTrendingUp} label="Annual Revenue (Projected)"
          value={loading || !billingKpis ? 0 : billingKpis.annualRevenueProjected}
          formatter={(v) => formatCurrency(v)} accent="#2F6BFF"
        />
        <KPICard
          icon={FiCheckCircle} label="Active Subscriptions"
          value={loading || !billingKpis ? 0 : billingKpis.activeSubscriptions}
          formatter={formatNumber} accent="#10B981"
        />
        <KPICard
          icon={FiClock} label="Expiring Soon"
          value={loading || !billingKpis ? 0 : billingKpis.expiringSoon}
          formatter={formatNumber} accent="#F59E0B"
        />
        <KPICard
          icon={FiXCircle} label="Expired"
          value={loading || !billingKpis ? 0 : billingKpis.expired}
          formatter={formatNumber} accent="#EF4444"
        />
        <KPICard
          icon={FiUserPlus} label="Trial Conversions (30 Days)"
          value={loading || !billingKpis ? 0 : billingKpis.trialConversions}
          formatter={formatNumber} accent="#8B5CF6"
        />
        <KPICard
          icon={FiBarChart2} label="Monthly Signups"
          value={loading || !kpis ? 0 : kpis.thisMonthRegistrations}
          formatter={formatNumber} accent="#22D3EE"
        />
        <KPICard
          icon={FiAward} label="Most Popular Plan"
          value={loading || !billingKpis ? 0 : billingKpis.mostPopularPlan?.subscriberCount || 0}
          formatter={() => mostPopularPlanLabel} accent="#2F6BFF"
        />
      </div>
    </div>
  );
}

export default BillingDashboard;
