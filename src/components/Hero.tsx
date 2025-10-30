import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { useEffect, useRef, useState } from "react";

const Hero = () => {
  const scrollToProducts = () => {
    const element = document.getElementById("products");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const sectionRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [imgHeight, setImgHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const update = () => {
      if (!sectionRef.current || !contentRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const styles = window.getComputedStyle(sectionRef.current);
      const padTop = parseFloat(styles.paddingTop || "0");
      const padBottom = parseFloat(styles.paddingBottom || "0");
      const sectionH = rect.height;
      const contentH = contentRef.current.offsetHeight;
      const gap = 8;
      const available = Math.max(0, sectionH - contentH - padTop - padBottom - gap);
      setImgHeight(available);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <section ref={sectionRef} className="relative h-svh pt-4 md:pt-8 pb-12 md:pb-16 overflow-hidden flex items-start justify-center">
      <div className="absolute inset-0 gradient-hero opacity-50" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="relative mx-auto mb-3 md:mb-5" data-aos="zoom-in" style={{ width: "min(420px, 68vw)", height: imgHeight ? `${imgHeight}px` : undefined, maxHeight: '24vh' }}>
          <img src={logo} alt="FUT75 Store" className="w-full h-full object-contain" />
        </div>
        <div ref={contentRef} className="max-w-3xl mx-auto text-center space-y-3 animate-fade-in" data-aos="fade-up">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-display text-foreground leading-tight">
            CAMISAS DE TIME
            <span className="block text-primary glow-neon">TAILANDESAS E PRIMEIRA LINHA</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Seleções, clubes europeus e brasileiros, edições retrô e muito mais.
            A melhor coleção de camisas de futebol, bermudas e caisas de basquete em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <Button
              onClick={scrollToProducts}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg px-6 py-4 glow-soft transition-smooth"
            >
              VER COLEÇÃO
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-primary/30 hover:border-primary hover:bg-primary/10 font-bold text-lg px-6 py-4 transition-smooth"
            >
              SOBRE NÓS
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/4 left-10 w-20 h-20 rounded-full bg-primary/10 blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute inset-x-0 bottom-3 flex justify-center" data-aos="fade-up" data-aos-delay="600">
    <button
      type="button"
      aria-label="Scroll para produtos"
      onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
      className="group"
    >
      <div className="hidden md:flex items-center justify-center">
        <div className="h-9 w-6 rounded-full border border-primary/60 bg-secondary/40 shadow-[var(--glow-neon)] flex items-start justify-center p-1 animate-bounce">
          <span className="h-2 w-1 rounded bg-primary mt-1" />
        </div>
      </div>
      <div className="md:hidden flex items-center justify-center text-primary glow-neon animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </div>
    </button>
  </div>
</section>
  );
};

export default Hero;
