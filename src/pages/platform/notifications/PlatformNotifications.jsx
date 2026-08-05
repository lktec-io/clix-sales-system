import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiInfo, FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiCheck } from 'react-icons/fi';
import Pagination from '../../../components/common/Pagination';
import { useTable } from '../../../hooks/useTable';
import * as platformNotificationService from '../../../services/platformNotificationService';
import { PLATFORM_ROUTES } from '../../../constants/routes';
import '../../../styles/pages/PlatformNotifications.css';

const TYPE_ICON = { info: FiInfo, success: FiCheckCircle, warning: FiAlertTriangle, danger: FiAlertCircle };

// A full page, not just the Navbar bell — the portal logs more distinct
// event categories (new registrations, trial lifecycle, suspensions,
// system warnings) worth browsing in full than the tenant app's bell-only
// pattern was ever designed for.
function PlatformNotifications() {
  const fetchNotifications = useCallback((params) => platformNotificationService.listNotifications(params), []);
  const { items, meta, loading, page, setPage, refetch } = useTable(fetchNotifications);

  const handleMarkRead = async (id) => {
    await platformNotificationService.markNotificationRead(id);
    refetch();
  };

  const handleMarkAllRead = async () => {
    await platformNotificationService.markAllNotificationsRead();
    refetch();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">New registrations, trial lifecycle events, and system warnings.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={handleMarkAllRead}>Mark all as read</button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="card-body"><p className="text-sm text-secondary">Loading…</p></div>
        ) : items.length === 0 ? (
          <div className="card-body"><p className="text-sm text-secondary">No notifications.</p></div>
        ) : (
          <ul className="platform-notifications-list">
            {items.map((notification) => {
              const Icon = TYPE_ICON[notification.type] || FiInfo;
              return (
                <li key={notification.id} className={!notification.read_at ? 'is-unread' : ''}>
                  <span className={`platform-notifications-icon type-${notification.type}`}><Icon /></span>
                  <div className="platform-notifications-body">
                    <span className="platform-notifications-title">{notification.title}</span>
                    {notification.message && <span className="platform-notifications-message">{notification.message}</span>}
                    <span className="platform-notifications-meta">
                      {new Date(notification.created_at).toLocaleString()}
                      {notification.tenant_id && (
                        <> · <Link to={`${PLATFORM_ROUTES.TENANTS}/${notification.tenant_id}`}>{notification.tenant_name}</Link></>
                      )}
                    </span>
                  </div>
                  {!notification.read_at && (
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => handleMarkRead(notification.id)} aria-label="Mark as read">
                      <FiCheck />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default PlatformNotifications;
