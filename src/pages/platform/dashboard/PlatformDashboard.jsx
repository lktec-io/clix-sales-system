import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase, FiCheckCircle, FiClock, FiXCircle, FiSlash, FiUserPlus, FiCalendar, FiTrendingUp } from 'react-icons/fi';
import KPICard from '../../../components/dashboard/KPICard';
import * as platformDashboardService from '../../../services/platformDashboardService';
import { formatNumber } from '../../../utils/formatCurrency';
import { PLATFORM_ROUTES } from '../../../constants/routes';
import '../../../styles/pages/PlatformDashboard.css';

const KPI_DEFS = [
  { key: 'totalTenants', label: 'Total Tenants', icon: FiBriefcase, accent: '#2F6BFF' },
  { key: 'activeTenants', label: 'Active Tenants', icon: FiCheckCircle, accent: '#10B981' },
  { key: 'trialTenants', label: 'Trial Tenants', icon: FiClock, accent: '#F59E0B' },
  { key: 'expiredTenants', label: 'Expired Tenants', icon: FiXCircle, accent: '#EF4444' },
  { key: 'suspendedTenants', label: 'Suspended Tenants', icon: FiSlash, accent: '#8B5CF6' },
  { key: 'newRegistrations', label: 'New (30 Days)', icon: FiUserPlus, accent: '#22D3EE' },
  { key: 'todaysRegistrations', label: "Today's Registrations", icon: FiCalendar, accent: '#2F6BFF' },
  { key: 'thisMonthRegistrations', label: 'This Month', icon: FiTrendingUp, accent: '#10B981' },
];

function PlatformDashboard() {
  const [kpis, setKpis] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [storage, setStorage] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      platformDashboardService.getKpis(),
      platformDashboardService.getSystemStatus(),
      platformDashboardService.getStorageUsage(),
      platformDashboardService.getRecentActivity(10),
    ]).then(([kpiResult, statusResult, storageResult, activityResult]) => {
      if (cancelled) return;
      setKpis(kpiResult);
      setSystemStatus(statusResult);
      setStorage(storageResult);
      setActivity(activityResult);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Dashboard</h1>
          <p className="page-subtitle">An overview of every tenant on Clix Sales System.</p>
        </div>
      </div>

      <div className="kpi-grid">
        {KPI_DEFS.map(({ key, label, icon, accent }) => (
          <KPICard key={key} icon={icon} label={label} value={loading || !kpis ? 0 : kpis[key]} formatter={formatNumber} accent={accent} />
        ))}
      </div>

      <div className="platform-dashboard-bottom-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">System Health</span></div>
          <div className="card-body platform-dashboard-status-list">
            <div className="platform-dashboard-status-row">
              <span>Database</span>
              <span className={`badge ${systemStatus?.databaseConnected ? 'badge-success' : 'badge-danger'}`}>
                {systemStatus?.databaseConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="platform-dashboard-status-row">
              <span>API</span>
              <span className="badge badge-success">Up</span>
            </div>
            <div className="platform-dashboard-status-row">
              <span>Overall</span>
              <span className={`badge ${systemStatus?.health === 'healthy' ? 'badge-success' : 'badge-warning'}`}>
                {systemStatus?.health === 'healthy' ? 'Healthy' : 'Degraded'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Storage Usage</span></div>
          <div className="card-body platform-dashboard-status-list">
            <div className="platform-dashboard-status-row">
              <span>Local uploads</span>
              <span>{storage ? `${storage.localMb} MB` : '—'}</span>
            </div>
            {storage?.cloudinaryConfigured && (
              <p className="text-xs text-secondary mt-2">
                Media storage is served via Cloudinary — usage is not tracked locally.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="card-header">
          <span className="card-title">Recent Activity</span>
          <Link to={PLATFORM_ROUTES.AUDIT_LOG} className="text-sm">View full audit log</Link>
        </div>
        <div className="card-body">
          {activity.length === 0 ? (
            <p className="text-sm text-secondary">No recent activity.</p>
          ) : (
            <ul className="platform-dashboard-activity-list">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <span className="platform-dashboard-activity-description">{entry.description}</span>
                  <span className="platform-dashboard-activity-meta">
                    {entry.admin_first_name ? `${entry.admin_first_name} ${entry.admin_last_name}` : 'System'} · {new Date(entry.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlatformDashboard;
