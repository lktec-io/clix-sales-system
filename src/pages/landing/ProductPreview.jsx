import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowRight } from 'react-icons/fi';
import { ROUTES } from '../../constants/routes';
import BusinessCapabilities from '../../components/landing/BusinessCapabilities';

// html2canvas-style heavy visual components have no place on a public
// marketing page's critical path — DemoPreview (framer-motion-driven scene
// cycling, per-business SVG-free CSS "browser frame") is genuinely small,
// but it's landing-only, so it's still split into its own chunk rather than
// folded into the eagerly-loaded Hero bundle.
const DemoPreview = lazy(() => import('../../components/landing/DemoPreview'));

function DemoFallback() {
  // Matches DemoPreview's own frame dimensions so the lazy chunk arriving
  // doesn't shift layout — a plain static skeleton, no animation of its
  // own to avoid double motion once the real component mounts.
  return (
    <div className="demo-preview-frame demo-preview-skeleton" aria-hidden="true">
      <div className="demo-preview-titlebar">
        <span className="demo-preview-titlebar-dots"><span /><span /><span /></span>
      </div>
      <div className="demo-preview-body" />
    </div>
  );
}

// Fed by BusinessTypes' lifted activeSlug — selecting a card there updates
// the simulation here without re-rendering the hero above it.
function ProductPreview({ activeSlug }) {
  const { t } = useTranslation('landing');
  const businessName = t(`businessTypes.${activeSlug}.name`);

  return (
    <section id="product-preview" className="landing-section landing-section-alt">
      <div className="landing-section-eyebrow">02</div>
      <div className="landing-section-header">
        <h2>{t('productPreview.title')}</h2>
        <p>{t('productPreview.subtitle')}</p>
      </div>

      <div className="landing-demo-layout">
        <Suspense fallback={<DemoFallback />}>
          <DemoPreview activeSlug={activeSlug} />
        </Suspense>
        <BusinessCapabilities activeSlug={activeSlug} />
        <Link to={`${ROUTES.REGISTER}?template=${activeSlug}`} className="btn btn-primary">
          {t('productPreview.ctaPrefix')} {businessName} <FiArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export default ProductPreview;
