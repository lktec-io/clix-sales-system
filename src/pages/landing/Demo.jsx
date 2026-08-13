import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import BusinessCapabilities from '../../components/landing/BusinessCapabilities';

// html2canvas-style heavy visual components have no place on a public
// marketing page's critical path — DemoPreview (framer-motion-driven
// scene cycling, per-business SVG-free CSS "browser frame") is genuinely
// small, but it's landing-only, so it's still split into its own chunk
// rather than folded into the eagerly-loaded Hero bundle (Part 15 —
// "lazy-loaded demos").
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

function Demo({ activeSlug }) {
  const { t } = useTranslation('landing');

  return (
    <section id="demo" className="landing-section landing-section-alt">
      <div className="landing-section-header">
        <h2>{t('demoSection.title')}</h2>
        <p>{t('demoSection.subtitle')}</p>
      </div>

      <div className="landing-demo-layout">
        <Suspense fallback={<DemoFallback />}>
          <DemoPreview activeSlug={activeSlug} />
        </Suspense>
        <BusinessCapabilities activeSlug={activeSlug} />
      </div>
    </section>
  );
}

export default Demo;
