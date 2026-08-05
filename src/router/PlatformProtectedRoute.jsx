import { Navigate, Outlet } from 'react-router-dom';
import { usePlatformAuth } from '../hooks/usePlatformAuth';
import { PLATFORM_ROUTES } from '../constants/routes';

function PlatformProtectedRoute() {
  const { isAuthenticated, initializing, sessionExpired } = usePlatformAuth();

  if (initializing) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (sessionExpired || !isAuthenticated) {
    return <Navigate to={PLATFORM_ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
}

export default PlatformProtectedRoute;
