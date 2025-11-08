import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
// Cloudinary
import { AdvancedImage } from "@cloudinary/react";
import { Cloudinary } from "@cloudinary/url-gen";
import { fill } from "@cloudinary/url-gen/actions/resize";
import { format } from "@cloudinary/url-gen/actions/delivery";
import { quality } from "@cloudinary/url-gen/actions/delivery";

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  sizes: string[];
  stock?: number; // quantidade em estoque opcional
  publicId?: string;
  stockBySize?: Record<string, number>; // estoque por tamanho
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, size: string) => void;
}

const cld = new Cloudinary({ cloud: { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlmkynuni" } });

const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [showStockDetails, setShowStockDetails] = useState(false);

  const handleAddToCart = () => {
    onAddToCart(product, selectedSize);
    toast.success("Adicionado ao carrinho!", {
      description: `${product.name} - Tamanho ${selectedSize}`,
    });
  };

  // Build Cloudinary image if publicId exists
  const cldImage = product.publicId ? cld.image(product.publicId).resize(fill().width(800).height(800)).delivery(format("auto")).delivery(quality("auto")) : null;

  return (
    <Card className="group overflow-hidden border-border/50 bg-card hover:border-primary/50 transition-smooth hover:glow-soft">
      <div
        className="relative aspect-square overflow-hidden bg-muted cursor-pointer"
        onClick={() => setShowStockDetails((prev) => !prev)}
      >
        {cldImage ? (
          <AdvancedImage
            cldImg={cldImage}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        )}
        {product.stock !== undefined && product.stock <= 0 && (
          <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground">Esgotado</Badge>
        )}
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
            {product.sizes.map((size) => {
              const qty = product.stockBySize ? Number(product.stockBySize[size] ?? 0) : undefined;
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2 rounded-md border transition-smooth font-medium ${
                    selectedSize === size
                      ? "bg-primary/90 text-primary-foreground border-primary glow-soft"
                      : "border-border hover:border-primary/50 bg-background text-foreground"
                  }`}
                >
                  {qty !== undefined ? `${size} (${qty})` : size}
                </button>
              );
            })}
          </div>
        </div>

        {showStockDetails && (
          <div className="mt-3 p-3 rounded-md border border-border/50 bg-muted/50">
            <p className="text-sm text-muted-foreground mb-2">Estoque por tamanho</p>
            <ul className="grid grid-cols-2 gap-2">
              {product.sizes.map((size) => {
                const qty = product.stockBySize ? Number(product.stockBySize[size] ?? 0) : undefined;
                const isZero = qty !== undefined && qty <= 0;
                return (
                  <li
                    key={size}
                    className="flex items-center justify-between rounded-md bg-background/60 px-3 py-2 border border-border/50"
                  >
                    <span className="font-medium">{size}</span>
                    <span className={`text-sm ${isZero ? "text-destructive" : "text-foreground"}`}>
                      {qty !== undefined ? qty : "N/D"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleAddToCart}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-smooth"
          size="lg"
          disabled={
            (product.stockBySize && Number(product.stockBySize[selectedSize] ?? 0) <= 0) ||
            (product.stock !== undefined && product.stock <= 0)
          }
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          ADICIONAR AO CARRINHO
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
