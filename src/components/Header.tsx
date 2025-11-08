import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";

interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
}

const Header = ({ cartItemCount, onCartClick }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={logo}
            alt="FUT75 Store"
            className="h-10 md:h-14 w-auto object-contain cursor-pointer"
            onClick={() =>
              document
                .getElementById("hero")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          />
        </div>

        <Button
          onClick={onCartClick}
          variant="outline"
          size="lg"
          className="relative border-primary/30 hover:border-primary hover:bg-primary/10 transition-smooth"
        >
          <ShoppingCart className="w-5 h-5" />
          {cartItemCount > 0 && (
            <Badge
              className="absolute -top-2 -right-2 bg-primary text-primary-foreground glow-soft"
              variant="default"
            >
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>
    </header>
  );
};

export default Header;
