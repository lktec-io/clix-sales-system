import { useState } from 'react';
import LandingNav from './LandingNav';
import Hero from './Hero';
import BusinessTypes from './BusinessTypes';
import ProductPreview from './ProductPreview';
import Benefits from './Benefits';
import Pricing from './Pricing';
import HowItWorks from './HowItWorks';
import FinalCta from './FinalCta';
import FAQ from './FAQ';
import LandingFooter from './LandingFooter';
import '../../styles/pages/Landing.css';

function Landing() {
  // Lifted here (not local to BusinessTypes) so the Product Preview section
  // below can show the same business's simulated workflow the visitor just
  // picked in the business-type grid, without a shared context for what is,
  // on this one public page, a single parent/two-children relationship.
  const [activeSlug, setActiveSlug] = useState('retail-store');

  return (
    <div className="landing-page" id="top">
      <LandingNav />
      <Hero />
      <BusinessTypes activeSlug={activeSlug} onSelectSlug={setActiveSlug} />
      <ProductPreview activeSlug={activeSlug} />
      <Benefits />
      <Pricing />
      <HowItWorks />
      <FinalCta />
      <FAQ />
      <LandingFooter />
    </div>
  );
}

export default Landing;
