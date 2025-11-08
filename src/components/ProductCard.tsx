import { useState, useMemo, useEffect } from "react";
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
  const sizeOrder = ["PP", "P", "M", "G", "GG", "XG"];
  const normalize = (s: string) => s.trim().toUpperCase();

  const sortedSizes = useMemo(() => {
    const rank = (s: string) => {
      const idx = sizeOrder.indexOf(normalize(s));
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    const unique = Array.from(new Set((product.sizes || []).map((s) => s.trim())));
    return unique.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
  }, [product.sizes]);

  const defaultSelectedSize = useMemo(() => {
    if (sortedSizes.length === 0) return (product.sizes?.[0] ?? "").trim();
    if (product.stockBySize && Object.keys(product.stockBySize).length > 0) {
      const available = sortedSizes.find((s) => {
        const t = s.trim();
        const qty = Number(product.stockBySize?.[t] ?? product.stockBySize?.[s] ?? 0);
        return qty > 0;
      });
      return (available ?? sortedSizes[0]).trim();
    }
    return sortedSizes[0].trim();
  }, [sortedSizes, product.stockBySize]);

  const [selectedSize, setSelectedSize] = useState(defaultSelectedSize);
  const [showStockDetails, setShowStockDetails] = useState(false);

  useEffect(() => {
    setSelectedSize(defaultSelectedSize);
  }, [defaultSelectedSize]);

  const handleAddToCart = () => {
    onAddToCart(product, selectedSize);
    toast.success("Adicionado ao carrinho!", {
      description: `${product.name} - Tamanho ${selectedSize}`,
    });
  };

  // Build Cloudinary image if publicId exists
  const cldImage = product.publicId ? cld.image(product.publicId).resize(fill().width(800).height(800)).delivery(format("auto")).delivery(quality("auto")) : null;

  // Calcula o total a partir do estoque por tamanho (se existir)
  const hasStockBySize = !!(product.stockBySize && Object.keys(product.stockBySize).length > 0);
  const totalBySize = hasStockBySize
    ? Object.values(product.stockBySize!).reduce((sum, v) => sum + Number(v ?? 0), 0)
    : undefined;

  const isSoldOut = hasStockBySize
    ? (totalBySize ?? 0) <= 0
    : (product.stock !== undefined && product.stock <= 0);

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
        {isSoldOut && (
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
            {sortedSizes.map((size) => {
              const key = size.trim();
              const qty = product.stockBySize ? Number(product.stockBySize[key] ?? product.stockBySize[size] ?? 0) : undefined;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSize(key)}
                  className={`px-4 py-2 rounded-md border transition-smooth font-medium ${
                    selectedSize === key
                      ? "bg-primary/90 text-primary-foreground border-primary glow-soft"
                      : "border-border hover:border-primary/50 bg-background text-foreground"
                  }`}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>

        {showStockDetails && (
          <div className="mt-3 p-3 rounded-md border border-border/50 bg-muted/50">
            <p className="text-sm text-muted-foreground mb-2">Estoque por tamanho</p>
            <ul className="grid grid-cols-2 gap-2">
              {sortedSizes.map((size) => {
                const key = size.trim();
                const qty = product.stockBySize ? Number(product.stockBySize[key] ?? product.stockBySize[size] ?? 0) : undefined;
                const isZero = qty !== undefined && qty <= 0;
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between rounded-md bg-background/60 px-3 py-2 border border-border/50"
                  >
                    <span className="font-medium">{key}</span>
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
            hasStockBySize
              ? Number(product.stockBySize?.[selectedSize] ?? product.stockBySize?.[selectedSize?.toString()] ?? 0) <= 0
              : (product.stock !== undefined && product.stock <= 0)
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
