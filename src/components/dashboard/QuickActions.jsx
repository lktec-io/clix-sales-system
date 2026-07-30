import { useNavigate } from 'react-router-dom';
import { FiDollarSign, FiUserPlus, FiCreditCard, FiBarChart2 } from 'react-icons/fi';
import '../../styles/components/QuickActions.css';

const ACTIONS = [
  { label: 'New Sale', icon: FiDollarSign, to: '/pos', accent: '#2F6BFF' },
  { label: 'New Customer', icon: FiUserPlus, to: '/customers', accent: '#14B8A6' },
  { label: 'New Expense', icon: FiCreditCard, to: '/expenses', accent: '#F59E0B' },
  { label: 'Reports', icon: FiBarChart2, to: '/reports', accent: '#8B5CF6' },
];

// Same hex->rgb-triple trick KPICard.jsx uses, so the icon wash can be a
// low-opacity rgba() derived from one accent prop instead of a second color.
function hexToRgbTriple(hex) {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="card quick-actions">
      {ACTIONS.map(({ label, icon: Icon, to, accent }) => (
        <button
          key={label}
          type="button"
          className="quick-actions-item"
          onClick={() => navigate(to)}
          style={{ '--quick-action-accent': accent, '--quick-action-accent-rgb': hexToRgbTriple(accent) }}
        >
          <span className="quick-actions-icon"><Icon aria-hidden="true" /></span>
          <span className="quick-actions-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default QuickActions;
