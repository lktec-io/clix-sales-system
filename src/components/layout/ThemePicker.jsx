import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiOutlineSparkles } from 'react-icons/hi';
import { FiCheck } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import '../../styles/components/ThemePicker.css';

const POPUP_MOTION = {
  initial: { opacity: 0, scale: 0.92, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.92, y: 8 },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
};

// A single theme option's live mini-preview — a tiny replica of the app
// shell (sidebar / navbar / cards / chart swatches) rendered with that
// theme's real colors, so a user sees the actual look before switching
// rather than picking a name off a radio list.
function ThemeSwatchPreview({ preview }) {
  return (
    <div className="theme-option-preview" style={{ backgroundColor: preview.pageBg }}>
      <div
        className="theme-option-preview-sidebar"
        style={{ backgroundImage: `linear-gradient(180deg, ${preview.sidebarFrom}, ${preview.sidebarTo})` }}
      >
        <span className="theme-option-preview-dot" style={{ backgroundColor: preview.accent }} />
        <span className="theme-option-preview-line" style={{ backgroundColor: preview.textOnSidebar }} />
        <span className="theme-option-preview-line" style={{ backgroundColor: preview.textOnSidebar, width: '60%' }} />
      </div>
      <div className="theme-option-preview-main">
        <div className="theme-option-preview-navbar" style={{ backgroundColor: preview.navbarBg }} />
        <div className="theme-option-preview-cards">
          <span className="theme-option-preview-card" style={{ backgroundColor: preview.cardBg }} />
          <span className="theme-option-preview-card" style={{ backgroundColor: preview.cardBg }} />
        </div>
        <div className="theme-option-preview-chart">
          {preview.chart.map((c) => (
            <span key={c} className="theme-option-preview-bar" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemePicker() {
  const { t } = useTranslation('navbar');
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="navbar-theme-picker" ref={wrapperRef}>
      <button
        type="button"
        className="navbar-icon-btn"
        aria-label={t('themePicker.changeTheme')}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <HiOutlineSparkles />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="theme-picker-panel glass-panel" role="menu" aria-label={t('themePicker.changeTheme')} {...POPUP_MOTION}>
            <div className="theme-picker-header">
              <span className="theme-picker-title">{t('themePicker.appearance')}</span>
              <span className="theme-picker-subtitle">{t('themePicker.chooseTheme')}</span>
            </div>
            <div className="theme-picker-options">
              {themes.map((t) => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    className={`theme-option ${isActive ? 'theme-option-active' : ''}`}
                    style={isActive ? { '--theme-option-glow': t.preview.primary } : undefined}
                    onClick={() => { setTheme(t.id); setOpen(false); }}
                  >
                    <ThemeSwatchPreview preview={t.preview} />
                    <div className="theme-option-meta">
                      <span className="theme-option-name">{t.name}</span>
                      <span className="theme-option-tagline">{t.tagline}</span>
                    </div>
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          className="theme-option-check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          style={{ backgroundColor: t.preview.primary }}
                        >
                          <FiCheck aria-hidden="true" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ThemePicker;
