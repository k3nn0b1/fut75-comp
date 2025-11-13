import React from "react";
import { X, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";

export interface CartItem {
  id: number;
  name: string;
  price: number;
  size: string;
  image: string;
  quantity: number;
}

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: number, size: string, quantity: number) => void;
  onRemoveItem: (id: number, size: string) => void;
  onCheckout: (clienteNome: string, clienteTelefone: string) => void;
}

const Cart = ({ isOpen, onClose, items, onUpdateQuantity, onRemoveItem, onCheckout }: CartProps) => {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const [clienteNome, setClienteNome] = React.useState("");
  const [clienteTelefone, setClienteTelefone] = React.useState("");

  const formatPhoneMask = (value: string) => {
    const digits = value.replace(/\D+/g, "").slice(0, 11);
    const part1 = digits.slice(0, 2);
    const part2 = digits.slice(2, 7);
    const part3 = digits.slice(7, 11);
    if (digits.length <= 2) return part1 ? `(${part1}` : "";
    if (digits.length <= 7) return `(${part1}) ${part2}`;
    return `(${part1}) ${part2}-${part3}`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border/50">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            SEU CARRINHO
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Seu carrinho está vazio</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.id}-${item.size}`}
                className="flex gap-4 p-4 rounded-lg border border-border/50 bg-background/50"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-md"
                />
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold line-clamp-1">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">Tamanho: {item.size}</p>
                  <p className="text-primary font-bold">{formatBRL(item.price)}</p>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateQuantity(item.id, item.size, Math.max(1, item.quantity - 1))}
                      className="h-8 w-8 p-0"
                    >
                      -
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateQuantity(item.id, item.size, item.quantity + 1)}
                      className="h-8 w-8 p-0"
                    >
                      +
                    </Button>
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveItem(item.id, item.size)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="space-y-2 w-full">
            <Input
              placeholder="Nome completo"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              autoComplete="name"
            />
            <Input
              placeholder="Telefone (WhatsApp) — Ex.: (75) 98128-4738"
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(formatPhoneMask(e.target.value))}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
            />
          </div>
          <Separator />
          <div className="flex justify-between items-center text-lg font-bold">
            <span>TOTAL:</span>
            <span className="text-primary text-2xl">{formatBRL(total)}</span>
          </div>
          <Button
            onClick={() => {
              const nome = clienteNome.trim();
              const tel = clienteTelefone.trim();
              if (!nome || !tel) {
                toast.error("Preencha nome e telefone para finalizar");
                return;
              }
              onCheckout(nome, tel);
            }}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg glow-soft"
          >
            FINALIZAR NO WHATSAPP
          </Button>
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default Cart;
