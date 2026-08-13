import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';

// Part 10 — "what the selected business can manage," 3-5 items, driven by
// the same landing:businessHero.<slug>.capabilities array Hero.jsx's copy
// already comes from. Deliberately a plain chip row, not a duplicate of
// Features.jsx's generic platform-wide feature grid below it on the page
// — this is business-specific, that one is universal (POS/Inventory/
// Purchases/Reports/Multi-Branch/Bilingual, true for all six templates).
function BusinessCapabilities({ activeSlug }) {
  const { t } = useTranslation('landing');
  const capabilities = t(`businessHero.${activeSlug}.capabilities`, { returnObjects: true });

  return (
    <ul className="landing-capabilities-list" aria-label={t(`businessSelector.${activeSlug}`)}>
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
