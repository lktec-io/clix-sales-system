import LandingNav from './LandingNav';
import Hero from './Hero';
import BusinessTypes from './BusinessTypes';
import Pricing from './Pricing';
import HowItWorks from './HowItWorks';
import FinalCta from './FinalCta';
import FAQ from './FAQ';
import LandingFooter from './LandingFooter';
import '../../styles/pages/Landing.css';

function Landing() {
  return (
    <div className="landing-page" id="top">
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
