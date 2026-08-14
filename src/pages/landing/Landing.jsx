import { useState } from 'react';
import LandingNav from './LandingNav';
import Hero from './Hero';
import Demo from './Demo';
import Features from './Features';
import Pricing from './Pricing';
import Testimonials from './Testimonials';
import FAQ from './FAQ';
import LandingFooter from './LandingFooter';
import '../../styles/pages/Landing.css';

function Landing() {
  // Lifted here (not local to Hero) so the Demo section can show the same
  // business's workflow the visitor just picked in the hero's selector,
  // without a shared context for what is a single parent/two-children
  // relationship on this one page.
  const [activeSlug, setActiveSlug] = useState('retail-store');

  return (
    <div className="landing-page" id="top">
      <LandingNav />
      <Hero activeSlug={activeSlug} onSelectSlug={setActiveSlug} />
      <Demo activeSlug={activeSlug} />
      <Features />
      <Pricing />
      <Testimonials />
      <FAQ />
      <LandingFooter />
    </div>
  );
}

export default Landing;
