import LandingNav from './LandingNav';
import Hero from './Hero';
import Features from './Features';
import Pricing from './Pricing';
import Testimonials from './Testimonials';
import FAQ from './FAQ';
import LandingFooter from './LandingFooter';
import '../../styles/pages/Landing.css';

function Landing() {
  return (
    <div className="landing-page">
      <LandingNav />
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />
      <FAQ />
      <LandingFooter />
    </div>
  );
}

export default Landing;
