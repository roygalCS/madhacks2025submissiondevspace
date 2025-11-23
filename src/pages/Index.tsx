import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Demo from "@/components/Demo";
import Footer from "@/components/Footer";
import { ThreeJSBackground } from "@/components/ThreeJSBackground";

const Index = () => {
  return (
    <div className="min-h-screen relative">
      <ThreeJSBackground />
      <div className="relative z-10">
      <Hero />
      <Features />
      <HowItWorks />
      <Demo />
      <Footer />
      </div>
    </div>
  );
};

export default Index;
