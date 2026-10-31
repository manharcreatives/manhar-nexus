import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { HOME_META } from './site';
import About from './sections/About';
import BuiltFor from './sections/BuiltFor';
import Compare from './sections/Compare';
import CtaBanner from './sections/CtaBanner';
import Faq from './sections/Faq';
import Hero from './sections/Hero';
import HowItWorks from './sections/HowItWorks';
import Insights from './sections/Insights';
import Intro from './sections/Intro';
import NexusMenu from './sections/NexusMenu';
import Platform from './sections/Platform';
import Preloader from './sections/Preloader';
import Pricing from './sections/Pricing';
import Register from './sections/Register';
import Trust from './sections/Trust';

/**
 * The single-page marketing site. Composition order is fixed by the plan:
 * Hero, Intro, Platform, NexusMenu, Compare(#why), About, HowItWorks, BuiltFor, Trust, Pricing, Register, Faq, Insights, CtaBanner.
 * (Pricing sits before Register so the chosen plan can pre-fill the form via useRegistrationIntent.)
 */
export default function LandingPage() {
  useDocumentMeta({ ...HOME_META, path: '/' });
  return (
    <>
      <Preloader />
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Intro />
        <Platform />
        <NexusMenu />
        <Compare />
        <About />
        <HowItWorks />
        <BuiltFor />
        <Trust />
        <Pricing />
        <Register />
        <Faq />
        <Insights />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
