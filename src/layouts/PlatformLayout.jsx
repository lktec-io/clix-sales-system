import PlatformSidebar from '../components/platform/PlatformSidebar';
import PlatformNavbar from '../components/platform/PlatformNavbar';
import PageTransition from '../components/common/PageTransition';
import '../styles/pages/PlatformLayout.css';

// Structural mirror of MainLayout.jsx, forked with distinct class names
// (platform-shell, not app-shell) so the portal reads as a visually
// separate "internal admin tool" rather than a reskinned tenant app — no
// mobile-drawer complexity here since this is a desk-bound internal tool,
// not a customer-facing app that needs to work well one-handed on a phone.
function PlatformLayout() {
  return (
    <div className="platform-shell">
      <div className="platform-sidebar">
        <PlatformSidebar />
      </div>

      <div className="platform-navbar">
        <PlatformNavbar />
      </div>

      <main className="platform-main">
        <PageTransition />
      </main>
    </div>
  );
}

export default PlatformLayout;
