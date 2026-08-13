import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FiPackage, FiPlusSquare, FiCoffee, FiUser, FiSmartphone, FiDroplet, FiCheck, FiLoader,
} from 'react-icons/fi';
import { BUSINESS_DEMO_SCENES } from '../../constants/businessDemoScenes';
import { BUSINESS_EXPERIENCES } from '../../constants/businessExperiences';
import '../../styles/components/DemoPreview.css';

const SCENE_ICONS = { FiPackage, FiPlusSquare, FiCoffee, FiUser, FiSmartphone, FiDroplet };
const SCENE_INTERVAL_MS = 2400;

// One shared scene renderer for all six businesses, driven entirely by
// businessDemoScenes.js's data — never six bespoke demo components. Every
// value rendered here is clearly synthetic (round numbers, "Sample
// Product"/"Demo Borrower"-style names from the config) and the visible
// caption + sampleDataNote make that explicit — this simulates the actual
// SaaS UI's visual language (cards, badges, stat tiles), it is never
// presented as a recording of real tenant data.
function DemoScene({ scene }) {
  if (scene.shape === 'dashboard') {
    return (
      <div className="demo-scene demo-scene-dashboard">
        {scene.stats.map((stat) => (
          <div key={stat.label} className="demo-stat-tile">
            <span className="demo-stat-value">{stat.value}</span>
            <span className="demo-stat-label">{stat.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (scene.shape === 'catalog') {
    const Icon = SCENE_ICONS[scene.icon] || FiPackage;
    return (
      <div className="demo-scene demo-scene-catalog">
        <span className="demo-catalog-icon"><Icon aria-hidden="true" /></span>
        <span className="demo-catalog-title">{scene.title}</span>
        <span className="demo-catalog-meta">{scene.meta}</span>
      </div>
    );
  }

  if (scene.shape === 'detail') {
    return (
      <div className="demo-scene demo-scene-detail">
        {scene.rows.map((row, index) => (
          <div key={row.label} className="demo-detail-row" style={{ animationDelay: `${index * 0.15}s` }}>
            <span className="demo-detail-label">{row.label}</span>
            <span className="demo-detail-value">{row.value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (scene.shape === 'transaction') {
    return (
      <div className="demo-scene demo-scene-transaction">
        <span className="demo-transaction-badge">
          <FiLoader className="demo-transaction-spinner" aria-hidden="true" />
          <FiCheck className="demo-transaction-check" aria-hidden="true" />
          {scene.label}
        </span>
      </div>
    );
  }

  // 'result'
  return (
    <div className="demo-scene demo-scene-result">
      <span className="demo-result-check"><FiCheck aria-hidden="true" /></span>
      <span className="demo-result-amount">{scene.amount}{scene.unit ? <span className="demo-result-unit"> {scene.unit}</span> : null}</span>
      <span className="demo-result-label">{scene.label}</span>
    </div>
  );
}

function DemoPreview({ activeSlug }) {
  const { t } = useTranslation('landing');
  const shouldReduceMotion = useReducedMotion();
  const [sceneIndex, setSceneIndex] = useState(0);
  const scenes = BUSINESS_DEMO_SCENES[activeSlug];
  const experience = BUSINESS_EXPERIENCES[activeSlug];

  // Reset to the first scene whenever the visitor picks a different
  // business, rather than leaving it mid-sequence on unrelated content.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSceneIndex(0);
  }, [activeSlug]);

  // Auto-advance keeps working under prefers-reduced-motion — the scene
  // change is informational content, not gratuitous motion — only the
  // transition's own visual style (slide vs. instant fade) responds to
  // that preference below. The dot controls give a fully manual,
  // keyboard-reachable alternative regardless.
  useEffect(() => {
    const timer = setInterval(() => {
      setSceneIndex((current) => (current + 1) % scenes.length);
    }, SCENE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [scenes, activeSlug]);

  const scene = scenes[sceneIndex];
  const captionKey = `demoPreview.${activeSlug}.scenes.${sceneIndex}.caption`;

  return (
    <div className={`demo-preview-frame ${experience.motifClass}-tint`}>
      <div className="demo-preview-titlebar">
        <span className="demo-preview-titlebar-dots" aria-hidden="true"><span /><span /><span /></span>
        <span className="demo-preview-titlebar-text">{t('demoPreview.browserTitle')}</span>
      </div>

      <div className="demo-preview-body">
        <span className="demo-preview-live-badge">{t('demoPreview.liveLabel')}</span>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeSlug}-${sceneIndex}`}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
            transition={{ duration: shouldReduceMotion ? 0.15 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <DemoScene scene={scene} />
          </motion.div>
        </AnimatePresence>

        <p className="demo-preview-caption">{t(captionKey)}</p>
      </div>

      <div className="demo-preview-indicators" role="tablist" aria-label={t('demoPreview.liveLabel')}>
        {scenes.map((_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === sceneIndex}
            aria-label={t(`demoPreview.${activeSlug}.scenes.${index}.caption`)}
            className={`demo-preview-indicator ${index === sceneIndex ? 'is-active' : ''}`}
            onClick={() => setSceneIndex(index)}
          />
        ))}
      </div>

      <p className="demo-preview-note">{t('demoPreview.sampleDataNote')}</p>
    </div>
  );
}

export default DemoPreview;
