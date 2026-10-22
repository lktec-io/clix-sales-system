import { useRef } from 'react';
import LandingNav from './LandingNav';
import Hero from './Hero';
import BusinessTypes from './BusinessTypes';
import Pricing from './Pricing';
import HowItWorks from './HowItWorks';
import FinalCta from './FinalCta';
import FAQ from './FAQ';
import LandingFooter from './LandingFooter';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import '../../styles/pages/Landing.css';

// Everything below the hero fades up as it scrolls into view.
const REVEAL_SELECTOR = [
  '#business-types li',
  '#pricing .landing-section-header',
  '.landing-pricing-card',
  '.landing-step',
  '.landing-final-cta-inner',
  '.landing-faq-list > *',
].join(', ');

function Landing() {
  const rootRef = useRef(null);
  useRevealOnScroll(rootRef, REVEAL_SELECTOR);

  return (
    <div className="landing-page" id="top" ref={rootRef}>
      <LandingNav />
      <Hero />
      <BusinessTypes />
      <Pricing />
      <HowItWorks />
      <FinalCta />
      <FAQ />
      <LandingFooter />
    </div>
  );
}

export default Landing;
