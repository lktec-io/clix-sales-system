import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiChevronDown } from 'react-icons/fi';

const QUESTION_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'];

function FAQ() {
  const { t } = useTranslation('landing');
  const [openKey, setOpenKey] = useState(QUESTION_KEYS[0]);

  return (
    <section id="faq" className="landing-section landing-section-narrow">
      <div className="landing-section-eyebrow">06</div>
      <div className="landing-section-header">
        <h2>{t('faq.title')}</h2>
      </div>

      <div className="landing-faq-list">
        {QUESTION_KEYS.map((key) => {
          const isOpen = openKey === key;
          return (
            <div key={key} className={`landing-faq-item ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="landing-faq-question"
                aria-expanded={isOpen}
                onClick={() => setOpenKey(isOpen ? null : key)}
              >
                <span>{t(`faq.${key}.question`)}</span>
                <FiChevronDown aria-hidden="true" className="landing-faq-chevron" />
              </button>
              {isOpen && <p className="landing-faq-answer">{t(`faq.${key}.answer`)}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default FAQ;
