import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  sizes: string[];
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, size: string) => void;
}

const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);

  const handleAddToCart = () => {
    onAddToCart(product, selectedSize);
    toast.success("Adicionado ao carrinho!", {
      description: `${product.name} - Tamanho ${selectedSize}`,
    });
  };

  return (
    <Card className="group overflow-hidden border-border/50 bg-card hover:border-primary/50 transition-smooth hover:glow-soft">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <Badge className="absolute top-3 right-3 bg-primary/90 text-primary-foreground">
          {product.category}
        </Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        <h3 className="font-display text-xl text-foreground line-clamp-2">
          {product.name}
        </h3>
        
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary">
            R$ {product.price.toFixed(2)}
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground font-medium">
            Tamanho:
          </label>
          <div className="flex gap-2">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-4 py-2 rounded-md border transition-smooth font-medium ${
                  selectedSize === size
                    ? "bg-primary text-primary-foreground border-primary glow-soft"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleAddToCart}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-smooth"
          size="lg"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          ADICIONAR AO CARRINHO
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
