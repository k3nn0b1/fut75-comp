import { MapPin, Instagram, Phone, Clock } from "lucide-react";
import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-card/50 backdrop-blur-sm mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="FUT75 Store" className="h-14 sm:h-16 md:h-20 w-auto object-contain" />
            </div>
            <p className="text-muted-foreground">
              As melhores camisas de time originais do mundo. Qualidade garantida.
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="font-display text-xl text-foreground">INFORMAÇÕES</h4>
            <div className="space-y-3 text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Adenil Falcão Nº1887</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <span>(XX) XXXXX-XXXX</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p>Segunda a Sexta: 9h às 18h</p>
                  <p>Sábado: 9h às 14h</p>
                </div>
              </div>
            </div>
          </div>

          {/* Social */}
          <div className="space-y-4">
            <h4 className="font-display text-xl text-foreground">REDES SOCIAIS</h4>
            <a
              href="https://instagram.com/fut75store"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-smooth group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 group-hover:glow-soft transition-smooth">
                <Instagram className="w-5 h-5" />
              </div>
              <span className="font-medium">@fut75store</span>
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 text-center text-muted-foreground text-sm">
          <p>© 2025 FUT75 Store. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
