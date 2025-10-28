import { useState, useEffect } from "react";
import FootballBackground from "@/components/FootballBackground";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ProductGrid from "@/components/ProductGrid";
import Cart, { CartItem } from "@/components/Cart";
import Footer from "@/components/Footer";
import { Product } from "@/components/ProductCard";
import AOS from "aos";
import "aos/dist/aos.css";

// Mock products data
const mockProducts: Product[] = [
  {
    id: 1,
    name: "Brasil - Seleção Brasileira Home 2024",
    category: "Seleções",
    price: 149.90,
    image: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=500&h=500&fit=crop",
    sizes: ["P", "M", "G", "GG"],
  },
  {
    id: 2,
    name: "Real Madrid Home 2024",
    category: "Clubes Europeus",
    price: 179.90,
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&h=500&fit=crop",
    sizes: ["P", "M", "G", "GG"],
  },
  {
    id: 3,
    name: "Flamengo Home 2024",
    category: "Clubes Brasileiros",
    price: 139.90,
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&h=500&fit=crop",
    sizes: ["P", "M", "G", "GG"],
  },
  {
    id: 4,
    name: "Argentina Away 2024",
    category: "Seleções",
    price: 149.90,
    image: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=500&h=500&fit=crop",
    sizes: ["P", "M", "G", "GG"],
  },
  {
    id: 5,
    name: "Manchester United Retrô 1999",
    category: "Retrô",
    price: 199.90,
    image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=500&h=500&fit=crop",
    sizes: ["P", "M", "G", "GG"],
  },
  {
    id: 6,
    name: "Barcelona Home 2024",
    category: "Clubes Europeus",
    price: 179.90,
    image: "https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=500&h=500&fit=crop",
    sizes: ["P", "M", "G", "GG"],
  },
  {
    id: 7,
    name: "Palmeiras Home 2024",
    category: "Clubes Brasileiros",
    price: 139.90,
    image: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500&h=500&fit=crop",
    sizes: ["P", "M", "G", "GG"],
  },
  {
    id: 8,
    name: "PSG Away 2024",
    category: "Clubes Europeus",
    price: 179.90,
    image: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=500&h=500&fit=crop",
    sizes: ["P", "M", "G", "GG"],
  },
];

const Index = () => {
  useEffect(() => {
    AOS.init({ duration: 800, once: true, offset: 40, easing: "ease-out-cubic" });
    AOS.refresh();
  }, []);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleAddToCart = (product: Product, size: string) => {
    setCartItems((prev) => {
      const existingItem = prev.find(
        (item) => item.id === product.id && item.size === size
      );

      if (existingItem) {
        return prev.map((item) =>
          item.id === product.id && item.size === size
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          size,
          image: product.image,
          quantity: 1,
        },
      ];
    });
  };

  const handleUpdateQuantity = (id: number, size: string, quantity: number) => {
    if (quantity === 0) {
      handleRemoveItem(id, size);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id && item.size === size ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (id: number, size: string) => {
    setCartItems((prev) =>
      prev.filter((item) => !(item.id === id && item.size === size))
    );
  };

  const handleCheckout = () => {
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    const message = `🛍️ *Novo Pedido - FUT75 Store*\n\n${cartItems
      .map(
        (item) =>
          `• ${item.name}\n  Tamanho: ${item.size}\n  Qtd: ${item.quantity}\n  Subtotal: R$ ${(item.price * item.quantity).toFixed(2)}`
      )
      .join("\n\n")}\n\n💰 *TOTAL: R$ ${total.toFixed(2)}*`;

    const whatsappUrl = `https://wa.me/5575981284738?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen relative">
      <FootballBackground />
      
      <div className="relative z-10">
        <Header cartItemCount={cartItemCount} onCartClick={() => setIsCartOpen(true)} />
        <Hero />
        <ProductGrid products={mockProducts} onAddToCart={handleAddToCart} />
        <Footer />
      </div>

      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
    </div>
  );
};

export default Index;
