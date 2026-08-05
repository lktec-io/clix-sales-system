import { useTranslation } from 'react-i18next';
import { FiUser } from 'react-icons/fi';

const PLACEHOLDER_KEYS = ['placeholder1', 'placeholder2', 'placeholder3'];

// Real customer testimonials will replace these once the first cohort of
// tenants has been live long enough to ask — the layout/markup below is
// production-ready, only the copy is a placeholder (explicitly requested
// as "Testimonials placeholder" in the Phase 2 spec).
function Testimonials() {
  const { t } = useTranslation('landing');

  return (
    <section className="landing-section">
      <div className="landing-section-header">
        <h2>{t('testimonials.title')}</h2>
        <p>{t('testimonials.subtitle')}</p>
      </div>

      <div className="landing-testimonials-grid">
        {PLACEHOLDER_KEYS.map((key) => (
          <figure key={key} className="landing-testimonial-card">
            <blockquote>&ldquo;{t(`testimonials.${key}.quote`)}&rdquo;</blockquote>
            <figcaption>
              <span className="landing-testimonial-avatar"><FiUser aria-hidden="true" /></span>
              <span>
                <strong>{t(`testimonials.${key}.name`)}</strong>
                <span className="landing-testimonial-role">{t(`testimonials.${key}.role`)}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default Testimonials;
