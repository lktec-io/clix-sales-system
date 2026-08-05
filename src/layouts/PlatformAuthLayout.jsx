import PageTransition from '../components/common/PageTransition';
import '../styles/pages/PlatformAuthLayout.css';

// Mirrors AuthLayout.jsx's centered-card shell, but hardcodes the platform
// owner's own brand rather than reading useCompany() (a tenant's company
// profile) — this portal doesn't belong to any tenant.
function PlatformAuthLayout() {
  return (
    <div className="platform-auth-shell">
      <div className="platform-auth-card fade-in">
        <div className="platform-auth-brand">
          <span className="platform-auth-brand-mark">Clix</span>
          <span className="platform-auth-brand-sub">Owner Portal · Clix Digital Works</span>
        </div>
        <PageTransition />
      </div>
    </div>
  );
}

export default PlatformAuthLayout;
