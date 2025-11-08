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
import { toast } from "sonner";

// Mock products data
const mockProducts: Product[] = [
  {
    id: 1,
    name: "Brasil - Seleção Brasileira Home 2024",
    category: "Seleções",
    price: 149.9,
    image: "https://i.postimg.cc/4dSLpb95/selecao-home.jpg",
    sizes: ["P", "M", "G", "GG"],
    stock: 5,
  },
  {
    id: 2,
    name: "Real Madrid Home 2024",
    category: "Clubes Europeus",
    price: 179.9,
    image: "https://i.postimg.cc/W3HW06kf/real-home.jpg",
    sizes: ["P", "M", "G", "GG"],
    stock: 0,
  },
  {
    id: 3,
    name: "Flamengo Home 2024",
    category: "Clubes Brasileiros",
    price: 139.9,
    image: "https://i.postimg.cc/j5FgyQ7W/flamengo-home.jpg",
    sizes: ["P", "M", "G"],
    stock: 12,
  },
  {
    id: 4,
    name: "Argentina Away 2024",
    category: "Seleções",
    price: 149.9,
    image: "https://i.postimg.cc/9MMg4Nry/argentina-away.jpg",
    sizes: ["P", "M", "G", "GG"],
    stock: 8,
  },
  {
    id: 5,
    name: "Manchester United Retrô 1999",
    category: "Retrô",
    price: 199.9,
    image: "https://i.postimg.cc/MTFP1bQR/man-retro.jpg",
    sizes: ["P", "M", "G", "GG"],
    stock: 2,
  },
  {
    id: 6,
    name: "Barcelona Home 2024",
    category: "Clubes Europeus",
    price: 179.9,
    image: "https://i.postimg.cc/HxhZb4y8/barca-home.jpg",
    sizes: ["GG"],
    stock: 1,
  },
  {
    id: 7,
    name: "Palmeiras Home 2024",
    category: "Clubes Brasileiros",
    price: 139.9,
    image: "https://i.postimg.cc/vBNq5LVV/palmeiras-home.jpg",
    sizes: ["P", "G", "GG"],
    stock: 0,
  },
  {
    id: 8,
    name: "PSG Away 2024",
    category: "Clubes Europeus",
    price: 179.9,
    image: "https://i.postimg.cc/Qty4ckTg/psg-away.jpg",
    sizes: ["P", "M", "G"],
    stock: 6,
  },
];

const Index = () => {
  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      offset: 40,
      easing: "ease-out-cubic",
    });
    AOS.refresh();
  }, []);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(mockProducts);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("admin_products");
      if (raw) {
        const fromAdmin = JSON.parse(raw) as Product[];
        setProducts((prev) => [...prev, ...fromAdmin]);
      }
    } catch {}
  }, []);

  const getMaxStockFor = (product: Product, size: string) => {
    const bySize = product.stockBySize?.[size];
    if (typeof bySize === "number") return bySize;
    if (typeof product.stock === "number") return product.stock;
    return Number.POSITIVE_INFINITY;
  };

  const handleAddToCart = (product: Product, size: string) => {
    setCartItems((prev) => {
      const existingItem = prev.find((item) => item.id === product.id && item.size === size);
      const currentQty = existingItem?.quantity ?? 0;
      const maxStock = getMaxStockFor(product, size);

      if (currentQty >= maxStock) {
        toast.error("Limite de estoque atingido", {
          description: `Máximo disponível para ${product.name} (tamanho ${size}): ${maxStock}`,
        });
        return prev; // não adiciona
      }

      if (existingItem) {
        return prev.map((item) =>
          item.id === product.id && item.size === size
            ? { ...item, quantity: Math.min(item.quantity + 1, maxStock) }
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

    const product = products.find((p) => p.id === id);
    const maxStock = product ? getMaxStockFor(product, size) : Number.POSITIVE_INFINITY;
    const nextQty = Math.min(quantity, maxStock);
    if (nextQty < quantity) {
      toast.error("Limite de estoque atingido", {
        description: `Máximo disponível: ${maxStock}`,
      });
    }

    setCartItems((prev) =>
      prev.map((item) => (item.id === id && item.size === size ? { ...item, quantity: nextQty } : item))
    );
  };

  const handleRemoveItem = (id: number, size: string) => {
    setCartItems((prev) => prev.filter((item) => !(item.id === id && item.size === size)));
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
        <ProductGrid products={products} onAddToCart={handleAddToCart} />

        {/* Sobre Nós */}
        <section
          id="about"
          className="container mx-auto px-4 py-12 md:py-16 scroll-mt-24 md:scroll-mt-32"
          data-aos="fade-up"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Sobre nós</h2>
          <div className="max-w-3xl mx-auto text-muted-foreground text-center leading-relaxed space-y-4">
            <p>
              Somos uma loja especializada na venda de camisas de times tailandesas e de primeira linha, perfeitas para quem ama futebol e
              quer vestir sua paixão com estilo. Trabalhamos com produtos de alta qualidade, confortáveis e fiéis aos modelos originais —
              tudo com ótimo custo-benefício.
            </p>
            <p>
              Aqui, você encontra camisas dos maiores clubes do mundo, com atendimento rápido, envio seguro e aquele cuidado especial em
              cada detalhe. Nosso objetivo é que cada cliente vista o manto do seu time com orgulho e confiança!
            </p>
          </div>
        </section>

        {/* Localização / Mapa */}
        <section className="container mx-auto px-4 py-8 md:py-12" data-aos="fade-up">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Localização</h2>
          <div className="relative w-full h-[420px] md:h-[700px] rounded-xl shadow-lg overflow-hidden ring-1 ring-white/10" style={{ filter: "invert(100%) hue-rotate(180deg)" }}>
            <iframe
              title="Mapa - Loja Fut75"
              src="https://maps.google.com/maps?width=100%25&height=600&hl=pt-BR&q=Adenil%20Falc%C3%A3o,1887%20Feira%20de%20santana(Loja%20Fut75)&t=&z=19&ie=UTF8&iwloc=B&output=embed"
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>
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
