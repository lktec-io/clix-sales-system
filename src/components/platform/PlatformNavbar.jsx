import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiBell, FiInfo, FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiCheck, FiCheckCircle as FiMarkAll } from 'react-icons/fi';
import { usePlatformAuth } from '../../hooks/usePlatformAuth';
import * as platformNotificationService from '../../services/platformNotificationService';
import { PLATFORM_ROUTES } from '../../constants/routes';

const DROPDOWN_MOTION = {
  initial: { opacity: 0, scale: 0.96, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: -6 },
  transition: { duration: 0.15 },
};

const UNREAD_POLL_MS = 30_000;

const TYPE_ICON = { info: FiInfo, success: FiCheckCircle, warning: FiAlertTriangle, danger: FiAlertCircle };

// Same interaction pattern as the tenant Navbar's notification bell
// (src/components/layout/Navbar.jsx's useNotifications()) — 30s unread-
// count polling, lazy fetch-on-open — backed by an entirely separate
// platform_notifications table/endpoint, no delete action (not built on
// the backend for this phase; mark-read/mark-all-read only).
function usePlatformNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshUnreadCount = () => {
    platformNotificationService.getUnreadCount().then(setUnreadCount).catch(() => {});
  };

  useEffect(() => {
    refreshUnreadCount();
    const timer = setInterval(refreshUnreadCount, UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setLoading(true);
        platformNotificationService
          .listNotifications({ limit: 8 })
          .then((result) => setRecent(result.items))
          .finally(() => setLoading(false));
      }
      return next;
    });
  };

  const markRead = async (id) => {
    await platformNotificationService.markNotificationRead(id);
    setRecent((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    refreshUnreadCount();
  };

  const markAllRead = async () => {
    await platformNotificationService.markAllNotificationsRead();
    setRecent((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  };

  return { unreadCount, recent, open, setOpen, toggleOpen, loading, markRead, markAllRead };
}

function PlatformNavbar() {
  const { admin } = usePlatformAuth();
  const navigate = useNavigate();
  const notifications = usePlatformNotifications();

  return (
    <div className="platform-navbar-inner">
      <span className="platform-navbar-title">Platform Administration</span>

      <div className="platform-navbar-actions">
        <div className="platform-navbar-bell-wrap">
          <button
            type="button"
            className="platform-navbar-bell"
            onClick={notifications.toggleOpen}
            aria-label="Notifications"
          >
            <FiBell />
            {notifications.unreadCount > 0 && (
              <span className="platform-navbar-bell-badge">{notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}</span>
            )}
          </button>

          <AnimatePresence>
            {notifications.open && (
              <motion.div className="platform-navbar-dropdown" {...DROPDOWN_MOTION}>
                <div className="platform-navbar-dropdown-header">
                  <span>Notifications</span>
                  {notifications.recent.some((n) => !n.read_at) && (
                    <button type="button" onClick={notifications.markAllRead} aria-label="Mark all as read">
                      <FiMarkAll />
                    </button>
                  )}
                </div>
                <div className="platform-navbar-dropdown-list">
                  {notifications.loading ? (
                    <div className="platform-navbar-dropdown-empty">Loading…</div>
                  ) : notifications.recent.length === 0 ? (
                    <div className="platform-navbar-dropdown-empty">No notifications</div>
                  ) : (
                    notifications.recent.map((n) => {
                      const Icon = TYPE_ICON[n.type] || FiInfo;
                      return (
                        <div key={n.id} className={`platform-navbar-notification ${!n.read_at ? 'is-unread' : ''}`}>
                          <span className={`platform-navbar-notification-icon type-${n.type}`}><Icon /></span>
                          <div className="platform-navbar-notification-body">
                            <span className="platform-navbar-notification-title">{n.title}</span>
                            {n.message && <span className="platform-navbar-notification-message">{n.message}</span>}
                          </div>
                          {!n.read_at && (
                            <button type="button" onClick={() => notifications.markRead(n.id)} aria-label="Mark as read">
                              <FiCheck />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  className="platform-navbar-dropdown-viewall"
                  onClick={() => { notifications.setOpen(false); navigate(PLATFORM_ROUTES.NOTIFICATIONS); }}
                >
                  View all
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span className="platform-navbar-admin">{admin?.first_name} {admin?.last_name}</span>
      </div>
    </div>
  );
}

export default PlatformNavbar;
