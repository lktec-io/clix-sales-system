import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';

// "What the selected business can manage" — 3-5 items, driven by the same
// landing:businessTypes.<slug>.capabilities array BusinessTypes.jsx's cards
// already show a slice of. Deliberately a plain chip row, not a duplicate
// of Benefits.jsx's generic platform-wide benefit grid below it on the page
// — this is business-specific, that one is universal and true for all six
// templates.
function BusinessCapabilities({ activeSlug }) {
  const { t } = useTranslation('landing');
  const capabilities = t(`businessTypes.${activeSlug}.capabilities`, { returnObjects: true });

  return (
    <ul className="landing-capabilities-list" aria-label={t(`businessTypes.${activeSlug}.name`)}>
      {capabilities.map((capability) => (
        <li key={capability} className="landing-capability-chip">
          <FiCheck aria-hidden="true" />
          {capability}
        </li>
      ))}
    </ul>
  );
}

export default BusinessCapabilities;
