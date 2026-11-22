import useScrollReveal from "./hooks/useScrollReveal";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";

import Hero from "./components/sections/Hero";
import Stats from "./components/sections/Stats";
import Services from "./components/sections/Services";
import Projects from "./components/sections/Projects";
import AboutUs from "./components/sections/AboutUs";
import ContactForm from "./components/sections/ContactForm";

function App() {
  const revealRef = useScrollReveal();
  return (
    <>
      <Navbar />

      <main ref={revealRef} className="site-content">
        <Hero />

        <Stats />

        <Services />

        <Projects />

        <AboutUs />

        <ContactForm />
      </main>

      <Footer />
    </>
  );
}

export default App;