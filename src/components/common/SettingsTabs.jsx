import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiBriefcase, FiMapPin, FiUsers, FiShield, FiTag, FiPercent } from 'react-icons/fi';

function useTabs(t) {
  return [
    { to: '/settings/company', label: t('tabs.company'), icon: FiBriefcase },
    { to: '/settings/branches', label: t('tabs.branches'), icon: FiMapPin },
    { to: '/settings/users', label: t('tabs.users'), icon: FiUsers },
    { to: '/settings/permissions', label: t('tabs.roles'), icon: FiShield },
    { to: '/settings/expense-categories', label: t('tabs.expenseCategories'), icon: FiTag },
    { to: '/settings/system', label: t('tabs.taxAndEmail'), icon: FiPercent },
  ];
}

function SettingsTabs() {
  const { t } = useTranslation('settings');
  const TABS = useTabs(t);
  return (
    <div className="notifications-tabs mb-5">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `notifications-tab ${isActive ? 'notifications-tab-active' : ''}`}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default SettingsTabs;
