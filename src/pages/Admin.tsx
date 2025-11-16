import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Pencil, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBRL } from "@/lib/utils";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";

// Modelo de produto
interface AdminProduct {
  id?: number;
  name: string;
  category: string;
  price: number;
  sizes: string[];
  stock?: number;
  stockBySize?: Record<string, number>;
  imageUrl?: string;
  publicId?: string;
}

// Cloudinary envs e upload helpers permanecem iguais
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlmkynuni";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";
const DEFAULT_FOLDER = "fut75/products";
const MAX_FILE_SIZE_MB = 8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IS_SUPABASE_READY = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

async function uploadToCloudinary(file: File): Promise<{ secure_url: string; public_id: string }> {
  if (!UPLOAD_PRESET) throw new Error("Upload preset não configurado. Defina VITE_CLOUDINARY_UPLOAD_PRESET no .env");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", DEFAULT_FOLDER);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Falha no upload Cloudinary: ${await res.text()}`);
  const data = await res.json();
  return { secure_url: data.secure_url as string, public_id: data.public_id as string };
}

const normalizeCategory = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^\x00-\x7F]/g, '').replace(/[\u0300-\u036f]/g, '');

// Helpers de ordenação de tamanhos
const sizeOrder = ["PP", "P", "M", "G", "GG", "XG"];
const rankSize = (s: string) => {
  const idx = sizeOrder.indexOf((s || "").toUpperCase());
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
};
const sortSizes = (arr: string[]) => [...(arr || [])].sort((a, b) => {
  const ra = rankSize(a);
  const rb = rankSize(b);
  if (ra !== rb) return ra - rb;
  return (a || "").localeCompare(b || "");
});

const Admin = () => {
  // Auth: verificação de acesso é feita pelo AdminGuard em App.tsx
  // Removido checkAuth local para evitar redirecionamentos duplicados.

  const [product, setProduct] = useState<AdminProduct>({
    name: "",
    category: "",
    price: 0,
    sizes: [], // default: nenhum tamanho selecionado
    stock: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [storedProducts, setStoredProducts] = useState<any[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Record<number, { name: string; category: string; price: number; stock?: number }>>({});
  // Distribuição de estoque por tamanho (para cadastro de produto)
  const [distribution, setDistribution] = useState<Record<string, number>>({});

  // Categorias
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  // Lista global de tamanhos (independente de produtos)
  const [globalSizes, setGlobalSizes] = useState<string[]>([]);
  const [newGlobalSize, setNewGlobalSize] = useState("");
  const [newSizeInput, setNewSizeInput] = useState("");
  const [replaceFiles, setReplaceFiles] = useState<Record<number, File | null>>({});
  const [confirmReplaceForId, setConfirmReplaceForId] = useState<number | null>(null);
  const [confirmReplacePreview, setConfirmReplacePreview] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  // Edição inline (tamanhos e categorias)
  const [editingSize, setEditingSize] = useState<string | null>(null);
  const [sizeEditValue, setSizeEditValue] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
const [categoryEditValue, setCategoryEditValue] = useState("");

// Pedidos: estados
const [pedidos, setPedidos] = useState<any[]>([]);
const [pedidoStatusFilter, setPedidoStatusFilter] = useState<string>("todos");
const [pedidoSearch, setPedidoSearch] = useState<string>("");
const [pedidoPage, setPedidoPage] = useState(1);
const [pageSize, setPageSize] = useState(15);
const [confirmAction, setConfirmAction] = useState<{ id: string; action: "concluir" | "cancelar" } | null>(null);
const [pedidoDetalhesId, setPedidoDetalhesId] = useState<string | number | null>(null);
const [pedidoSeq, setPedidoSeq] = useState<Record<string, number>>({});
const [devolucaoPedidoId, setDevolucaoPedidoId] = useState<string | null>(null);
const [devolucaoParcial, setDevolucaoParcial] = useState(false);
const [devolucaoQuantidades, setDevolucaoQuantidades] = useState<number[]>([]);
const [confirmTotalOpen, setConfirmTotalOpen] = useState(false);

// Defaultar devolução para parcial e zerar quantidades ao abrir modal
useEffect(() => {
  if (devolucaoPedidoId) {
    setDevolucaoParcial(true);
    const pedido = pedidos.find((p) => String(p.id) === String(devolucaoPedidoId));
    const itens = pedido?.itens || [];
    setDevolucaoQuantidades(itens.map(() => 0));
  }
}, [devolucaoPedidoId, pedidos]);

// Tabs controlada para alternar após criar pedido
const [activeTab, setActiveTab] = useState("pedidos");

// Modal de novo pedido (admin)
const [newPedidoOpen, setNewPedidoOpen] = useState(false);
const [confirmDebitarOpen, setConfirmDebitarOpen] = useState(false);

// Carrinho do admin
type AdminCartItem = { id: number; name: string; size: string; quantity: number; price: number };
const [adminCart, setAdminCart] = useState<AdminCartItem[]>([]);

// Seleção do produto/tamanho
const [productQuery, setProductQuery] = useState("");
const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
const [selectedSize, setSelectedSize] = useState<string | null>(null);
const [quantity, setQuantity] = useState<string>('1');

// Cliente (opcional)
const [informarCliente, setInformarCliente] = useState(true);
const [clienteNome, setClienteNome] = useState("");
const [clienteTelefone, setClienteTelefone] = useState("");

const addToAdminCart = () => {
  const qty = Math.max(1, parseInt(quantity || '1') || 1);
  if (!selectedProductId || !selectedSize || qty <= 0) return;
  const prod = storedProducts.find(p => p.id === selectedProductId);
  if (!prod) return;
  const estoque = Math.max(0, Number((prod.stockBySize || {})[selectedSize] || 0));
  if (estoque === 0) {
    toast.error("Tamanho sem estoque");
    return;
  }
  const existingItem = adminCart.find(it => it.id === selectedProductId && it.size === selectedSize);
  const combined = (existingItem?.quantity || 0) + qty;
  if (combined > estoque) {
    toast.error(`Quantidade total (${combined}) excede estoque disponível (${estoque})`);
    return;
  }
  setAdminCart(prev => {
    const idx = prev.findIndex(it => it.id === selectedProductId && it.size === selectedSize);
    const next = [...prev];
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
    } else {
      next.push({ id: selectedProductId, name: prod.name, size: selectedSize, quantity: qty, price: Number(prod.price || 0) });
    }
    return next;
  });
  setQuantity('1');
};

const removeFromAdminCart = (i: number) => {
  setAdminCart(prev => prev.filter((_, idx) => idx !== i));
};

const updateAdminCartQuantity = (i: number, newQty: number) => {
  if (newQty < 1) return;
  const item = adminCart[i];
  const prod = storedProducts.find(p => p.id === item.id);
  const estoque = Math.max(0, Number((prod?.stockBySize || {})[item.size] || 0));
  if (newQty > estoque) {
    if (estoque >= 1) {
      toast.info(`Estoque disponível: ${estoque}.`);
      setAdminCart(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: estoque } : it));
    } else {
      toast.error("Sem estoque para este tamanho. Removi o item do carrinho.");
      removeFromAdminCart(i);
    }
    return;
  }
  setAdminCart(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: newQty } : it));
};

const adminCartTotal = adminCart.reduce((sum, it) => sum + it.price * it.quantity, 0);

const generateUUID = () => {
  let dt = new Date().getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
};

const handleCreateAdminOrder = async (debitarEstoque: boolean) => {
  if (adminCart.length === 0) {
    toast.error("Adicione itens ao pedido");
  return;
  }
  const nome = informarCliente && clienteNome.trim() ? clienteNome.trim() : "LOJA";
  const telefone = informarCliente && clienteTelefone.trim() ? clienteTelefone.trim() : "(XX) XXXXXX-XXXX";

  const itens = adminCart.map(it => ({
    produto: it.name,
    tamanho: it.size,
    quantidade: it.quantity,
    product_id: it.id,
    preco_unitario: it.price,
  }));

  const hasSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    // debitarEstoque é definido pelo modal de confirmação
    if (hasSupabase) {
      if (debitarEstoque) {
        // Valida estoque com base no banco
        const previousStates: Array<{ id: number; prev: Record<string, number>; prevTotal: number }> = [];
        for (const it of adminCart) {
          const { data: prodData, error: fetchErr } = await supabase.from('products').select('*').eq('id', it.id).single();
          if (fetchErr) throw fetchErr;
          if (!prodData) throw new Error('Produto não encontrado');
          const stockBySize: Record<string, number> = prodData.stockBySize || {};
          const current = Math.max(0, Number(stockBySize[it.size] || 0));
          if (it.quantity > current) {
            throw new Error(`Estoque insuficiente para ${it.name} (${it.size}). Disponível: ${current}`);
          }
          previousStates.push({ id: it.id, prev: { ...stockBySize }, prevTotal: Number(prodData.stock || 0) });
        }
        // Aplica baixa de estoque imediatamente
        for (const it of adminCart) {
          const { data: prodData } = await supabase.from('products').select('*').eq('id', it.id).single();
          const stockBySize: Record<string, number> = (prodData?.stockBySize || {});
          const current = Math.max(0, Number(stockBySize[it.size] || 0));
          const next = Math.max(0, current - it.quantity);
          const nextStockBySize = { ...stockBySize, [it.size]: next };
          const nextTotal = Object.values(nextStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);
          const { error: updErr } = await supabase.from('products').update({ stockBySize: nextStockBySize, stock: nextTotal }).eq('id', it.id);
          if (updErr) {
            // Reverter atualizações de estoque se houver falha
            for (const prev of previousStates) {
              await supabase.from('products').update({ stockBySize: prev.prev, stock: prev.prevTotal }).eq('id', prev.id);
            }
            throw updErr;
          }
        }

        // Inserir pedido após baixa bem-sucedida
        const uuid = typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
          ? (crypto as any).randomUUID()
          : generateUUID();
        const { error } = await supabase
          .from("pedidos")
          .insert({
            id: uuid,
            cliente_nome: nome,
            cliente_telefone: telefone,
            itens,
            valor_total: adminCartTotal,
            status: "concluido",
          });
        if (error) throw error;

        // Atualiza lista de pedidos imediatamente
        const { data: pedidosData } = await supabase
          .from("pedidos")
          .select("*")
          .order("data_criacao", { ascending: false });
        if (pedidosData) setPedidos(sortPedidos(pedidosData as any[]));

        // Atualiza UI local dos produtos
        setStoredProducts((prev) => {
          let next = [...prev];
          for (const it of adminCart) {
            next = next.map(p => {
              if (p.id === it.id) {
                const base = { ...(p.stockBySize || {}) } as Record<string, number>;
                const cur = Math.max(0, Number(base[it.size] || 0));
                const novo = Math.max(0, cur - it.quantity);
                const nextStockBySize = { ...base, [it.size]: novo };
                const nextTotal = Object.values(nextStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);
                return { ...p, stockBySize: nextStockBySize, stock: nextTotal } as any;
              }
              return p;
            });
          }
          return next;
        });
      } else {
        // Inserir pedido como pendente (sem baixa de estoque)
        const uuid = typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
          ? (crypto as any).randomUUID()
          : generateUUID();
        const { error } = await supabase
          .from("pedidos")
          .insert({
            id: uuid,
            cliente_nome: nome,
            cliente_telefone: telefone,
            itens,
            valor_total: adminCartTotal,
            status: "pendente",
          });
        if (error) throw error;

        // Atualiza lista de pedidos imediatamente
        const { data: pedidosData } = await supabase
          .from("pedidos")
          .select("*")
          .order("data_criacao", { ascending: false });
        if (pedidosData) setPedidos(sortPedidos(pedidosData as any[]));
      }
    }
    toast.success(debitarEstoque ? "Pedido concluído e baixa de estoque aplicada" : "Pedido criado como pendente (sem baixa de estoque)");
    setAdminCart([]);
    setNewPedidoOpen(false);
    setActiveTab("pedidos");
  } catch (e: any) {
    toast.error("Falha ao criar pedido", { description: e?.message });
  }
};


// Função de ordenação: pendentes primeiro; depois concluídos/cancelados; dentro do grupo, mais recentes primeiro
const sortPedidos = (list: any[]) => {
  return [...list].sort((a, b) => {
    const order = (s: string) => (s === 'pendente' ? 0 : 1);
    const diff = order(a.status) - order(b.status);
    if (diff !== 0) return diff;
    return new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime();
  });
};

// Carregamento inicial e realtime
useEffect(() => {
  if (!IS_SUPABASE_READY) return;
  const fetchPedidos = async () => {
    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .order("data_criacao", { ascending: false });
    if (!error && data) setPedidos(sortPedidos(data as any[]));
  };
  void fetchPedidos();

  const channel = supabase
    .channel("pedidos-realtime")
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, (payload: any) => {
      const newRow = payload.new;
      if (!newRow) return;
      setPedidos((prev) => sortPedidos([newRow, ...prev]));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, (payload: any) => {
      const newRow = payload.new;
      if (!newRow) return;
      setPedidos((prev) => {
        const idx = prev.findIndex((p) => p.id === newRow.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = newRow;
          return sortPedidos(next);
        }
        return sortPedidos([newRow, ...prev]);
      });
    })
    .subscribe();

  return () => {
    try { supabase.removeChannel(channel); } catch {}
  };
}, []);

// Filtro
const filteredPedidos = pedidos.filter((p) => {


  const matchStatus = pedidoStatusFilter === 'todos' || p.status === pedidoStatusFilter;
  const term = pedidoSearch.toLowerCase().trim();
  const matchSearch = term === ''
    || (p.cliente_nome?.toLowerCase().includes(term))
    || (String(p.id).toLowerCase().includes(term));
  return matchStatus && matchSearch;
});

// Ordenar por mais recentes primeiro (últimos pedidos)

const orderedPedidosByDate = [...filteredPedidos].sort((a, b) => {
  const ta = new Date(a.data_criacao).getTime();
  const tb = new Date(b.data_criacao).getTime();
  return tb - ta; // mais novo primeiro
});
const totalPages = Math.max(1, Math.ceil(orderedPedidosByDate.length / pageSize));


useEffect(() => { setPedidoPage(prev => Math.min(prev, totalPages)); }, [totalPages]);

const startIndex = (pedidoPage - 1) * pageSize;
const pageSlice = orderedPedidosByDate.slice(startIndex, startIndex + pageSize);
// Priorizar pendentes dentro da própria página, preservando ordem por data
const visiblePedidos = [
  ...pageSlice.filter(p => p.status === 'pendente'),
  ...pageSlice.filter(p => p.status !== 'pendente'),
];


// Sequencial estável por ordem de criação (mais antigo = 1)
useEffect(() => {
  const ordered = [...pedidos].sort((a, b) => new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime());
  const map: Record<string, number> = {};
  ordered.forEach((p, i) => { map[String(p.id)] = i + 1; });
  setPedidoSeq(map);
}, [pedidos]);

// Baixa de estoque por tamanho ao concluir
const applyBaixaDeEstoque = async (pedido: any) => {
  for (const item of pedido.itens || []) {
    const productId = item.product_id;
    const tamanho = item.tamanho;
    const qty = Number(item.quantidade || 0);
    if (!productId || !tamanho || qty <= 0) continue;
    const { data: prodData } = await supabase.from('products').select('*').eq('id', productId).single();
    if (!prodData) continue;
    const stockBySize = prodData.stockBySize || {};
    const current = Number(stockBySize[tamanho] || 0);
    const next = Math.max(0, current - qty);
    const nextStockBySize = { ...stockBySize, [tamanho]: next };
    await supabase.from('products').update({ stockBySize: nextStockBySize }).eq('id', productId);
  }
};

// Devolução de estoque (total ou parcial).
// quantidades: array do mesmo tamanho de pedido.itens com a quantidade a devolver por item.
const applyDevolucaoEstoqueParcial = async (pedido: any, quantidades: number[]) => {
  try {
    // Atualiza estoque somando as quantidades devolvidas
    for (let i = 0; i < (pedido.itens || []).length; i++) {
      const it = pedido.itens[i];
      const already = Number(it.devolvido || 0);
      const maxReturn = Math.max(0, Number(it.quantidade || 0) - already);
      const qty = Math.max(0, Math.min(maxReturn, Number(quantidades[i] || 0)));
      if (qty <= 0) continue;
      const productId = it.product_id;
      const tamanho = it.tamanho;
      const { data: prodData } = await supabase.from('products').select('*').eq('id', productId).single();
      if (!prodData) continue;
      const stockBySize = prodData.stockBySize || {};
      const current = Number(stockBySize[tamanho] || 0);
      const next = Math.max(0, current + qty);
      const nextStockBySize = { ...stockBySize, [tamanho]: next };
      const nextTotal = Object.values(nextStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);
      await supabase.from('products').update({ stockBySize: nextStockBySize, stock: nextTotal }).eq('id', productId);
    }

    // Atualiza itens do pedido com flag de devolvido
    const newItens = (pedido.itens || []).map((it: any, idx: number) => {
      const already = Number(it.devolvido || 0);
      const maxReturn = Math.max(0, Number(it.quantidade || 0) - already);
      const qty = Math.max(0, Math.min(maxReturn, Number(quantidades[idx] || 0)));
      if (qty <= 0) return it;
      return { ...it, devolvido: already + qty };
    });

    const totalDevolvido = newItens.reduce((sum: number, it: any, i: number) => sum + Math.max(0, Number(it.devolvido || 0) - Number((pedido.itens?.[i]?.devolvido || 0))), 0);

    // Se devolveu todos itens (somando devolvido == somando quantidade), marcar status 'devolvido'
    const isTotalReturn = newItens.every((it: any) => Number(it.devolvido || 0) >= Number(it.quantidade || 0));

    const { error } = await supabase.from('pedidos').update({ itens: newItens, status: isTotalReturn ? 'devolvido' : 'parcialmente_devolvido' }).eq('id', pedido.id);
    if (error) throw error;

    // Atualiza UI local
    setStoredProducts((prev) => {
      let next = [...prev];
      for (let i = 0; i < (pedido.itens || []).length; i++) {
        const it = pedido.itens[i];
        const already = Number(it.devolvido || 0);
        const maxReturn = Math.max(0, Number(it.quantidade || 0) - already);
        const qty = Math.max(0, Math.min(maxReturn, Number(quantidades[i] || 0)));
        if (qty <= 0) continue;
        next = next.map(p => {
          if (p.id === it.product_id) {
            const base = { ...(p.stockBySize || {}) } as Record<string, number>;
            const cur = Math.max(0, Number(base[it.tamanho] || 0));
            const novo = Math.max(0, cur + qty);
            const nextStockBySize = { ...base, [it.tamanho]: novo };
            const nextTotal = Object.values(nextStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);
            return { ...p, stockBySize: nextStockBySize, stock: nextTotal } as any;
          }
          return p;
        });
      }
      return next;
    });

    setPedidos(prev => {
      const idx = prev.findIndex((pp) => pp.id === pedido.id);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], itens: newItens, status: isTotalReturn ? 'devolvido' : 'parcialmente_devolvido' };
      return sortPedidos(next);
    });

    toast.success('Devolução aplicada e estoque atualizado');
  } catch (e: any) {
    toast.error('Falha ao aplicar devolução', { description: e?.message });
  }
};

// Confirmar ação de concluir/cancelar
const handleConfirmAction = async (id: string, action: "concluir" | "cancelar") => {
  const target = pedidos.find((p) => p.id === id);
  if (!target) return;
  try {
    if (action === 'concluir') {
      await applyBaixaDeEstoque(target);
    }
    const { error } = await supabase.from('pedidos').update({ status: action === 'concluir' ? 'concluido' : 'cancelado' }).eq('id', id);
    if (error) throw error;
    // Atualização otimista de UI
    setPedidos((prev) => {
      const next = prev.map((p) => p.id === id ? { ...p, status: action === 'concluir' ? 'concluido' : 'cancelado' } : p);
      return sortPedidos(next);
    });
    toast.success(action === 'concluir' ? 'Pedido concluído' : 'Pedido cancelado');
  } catch (e: any) {
    toast.error('Falha ao atualizar pedido', { description: e?.message });
  }
};

  useEffect(() => {
    const init = async () => {
      if (IS_SUPABASE_READY) {
        try {
          const { data: catData, error: catErr } = await supabase
            .from("categories")
            .select("name")
            .order("name", { ascending: true });
          if (!catErr && catData) setCategories(catData.map((c: any) => c.name));

          // Carregar produtos primeiro (para possível fallback dos tamanhos)
          const { data: prodData, error: prodErr } = await supabase
            .from("products")
            .select("*")
            .order("id", { ascending: false });
          if (!prodErr && prodData) {
            setStoredProducts(prodData);
          }

          // Carregar lista global de tamanhos
          const { data: sizeData, error: sizeErr } = await supabase
            .from("sizes")
            .select("name")
            .order("name", { ascending: true });

          if (!sizeErr && Array.isArray(sizeData) && sizeData.length > 0) {
            setGlobalSizes(sizeData.map((s: any) => s.name));
          } else if (!prodErr && Array.isArray(prodData)) {
            // Derivar tamanhos únicos dos produtos existentes, normalizados e ordenados
            const derived = sortSizes(
              Array.from(
                new Set(
                  (prodData || []).flatMap((p: any) =>
                    ((p?.sizes || []) as string[])
                      .map((x) => (x || "").toString().trim().toUpperCase())
                      .filter(Boolean)
                  )
                )
              )
            );
            if (derived.length > 0) {
              setGlobalSizes(derived);
              // Persistir na tabela sizes para futura edição
              await saveGlobalSizes(derived);
            }
          }
        } catch (e: any) {
          toast.error("Falha ao carregar dados do Supabase", { description: e?.message });
        }
      } else {
        toast.error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      }
    };
    void init();
  }, []);

  // Sincroniza distribuição com tamanhos selecionados
  useEffect(() => {
    setDistribution((prev) => {
      const next: Record<string, number> = {};
      for (const s of product.sizes) {
        next[s] = Number(prev[s] ?? 0);
      }
      return next;
    });
  }, [product.sizes]);

  // Ajuste: não auto-selecionar tamanhos conforme categoria
  useEffect(() => {
    // Mantemos intencionalmente sem auto-ajuste para permitir o usuário escolher manualmente os tamanhos
  }, [product.category]);

  const distributionTotal = (product.sizes || []).reduce((acc, s) => acc + (Number(distribution[s] || 0)), 0);
  const distributionRemaining = Math.max(0, (product.stock || 0) - distributionTotal);
  const setDistributionForSize = (size: string, value: number) => {
    const safeVal = Math.max(0, Number.isFinite(value) ? value : 0);
    const current = Number(distribution[size] || 0);
    const delta = safeVal - current;
    // Não permitir ultrapassar o total
    if (delta > distributionRemaining) {
      const clamped = current + distributionRemaining;
      setDistribution((prev) => ({ ...prev, [size]: clamped }));
    } else {
      setDistribution((prev) => ({ ...prev, [size]: safeVal }));
    }
  };

  // Salva categorias
  const saveCategories = async (next: string[]) => {
    const removed = categories.filter((c) => !next.includes(c));
    setCategories(next);
    if (IS_SUPABASE_READY) {
      try {
        // Inserir/atualizar categorias por nome (UNIQUE)
        const rows = next.map((name) => ({ name }));
        const { error: upsertErr } = await supabase.from("categories").upsert(rows, { onConflict: "name" });
        if (upsertErr) throw upsertErr;

        // Remover categorias que não existem mais
        if (removed.length > 0) {
          const { error: delErr } = await supabase.from("categories").delete().in("name", removed);
          if (delErr) throw delErr;
        }

        toast.success("Categorias atualizadas");
      } catch (e: any) {
        toast.error("Falha ao salvar categorias no Supabase", { description: e?.message });
      }
    } else {
      toast.error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }
  };

  // Salva tamanhos globais
  const saveGlobalSizes = async (next: string[]) => {
    const removed = globalSizes.filter((s) => !next.includes(s));
    const normalized = sortSizes(next);
    setGlobalSizes(normalized);
    if (IS_SUPABASE_READY) {
      try {
        const rows = normalized.map((name) => ({ name }));
        const { error: upsertErr } = await supabase.from("sizes").upsert(rows, { onConflict: "name" });
        if (upsertErr) throw upsertErr;

        if (removed.length > 0) {
          const { error: delErr } = await supabase.from("sizes").delete().in("name", removed);
          if (delErr) throw delErr;
        }

        toast.success("Tamanhos atualizados");
      } catch (e: any) {
        toast.error("Falha ao salvar tamanhos no Supabase", { description: e?.message });
      }
    } else {
      toast.error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }
  };


  const handleStockBySizeChange = async (id: number, size: string, newStock: number) => {
    const target = storedProducts.find((p) => p.id === id);
    const base = target?.stockBySize || {};
    const nextStockBySize = { ...base, [size]: newStock };
    const total = Object.values(nextStockBySize).reduce((acc, n) => acc + (Number(n as any) || 0), 0);
    if (IS_SUPABASE_READY) {
      try {
        const { error } = await supabase.from("products").update({ stockBySize: nextStockBySize, stock: total }).eq("id", id);
        if (error) throw error;
        setStoredProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stockBySize: nextStockBySize, stock: total } : p)));
        toast.success(`Estoque atualizado para tamanho ${size}`);
      } catch (e: any) {
        toast.error("Falha ao atualizar estoque no Supabase", { description: e?.message });
      }
    } else {
      toast.error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (IS_SUPABASE_READY) {
      try {
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) throw error;
        setStoredProducts((prev) => prev.filter((p) => p.id !== id));
        toast.success("Produto removido");
        return;
      } catch (e: any) {
        toast.error("Falha ao remover no Supabase", { description: e?.message });
      }
    } else {
      toast.error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }

  };

  const handleChange = (field: keyof AdminProduct, value: any) => {
    setProduct((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectReplaceFile = (id: number, file?: File) => {
    if (!file) {
      setReplaceFiles((prev) => ({ ...prev, [id]: null }));
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (>${MAX_FILE_SIZE_MB}MB)`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato não permitido. Use JPG, PNG ou WEBP.");
      return;
    }
    setReplaceFiles((prev) => ({ ...prev, [id]: file }));
    setConfirmReplaceForId(id);
    setConfirmReplacePreview(URL.createObjectURL(file));
  };
  
  const triggerFilePickerForProduct = (id: number) => {
    const input = fileInputRefs.current[id];
    if (input) input.click();
  };
  
  const handleCancelReplace = (id: number) => {
    setReplaceFiles((prev) => ({ ...prev, [id]: null }));
    const input = fileInputRefs.current[id];
    if (input) input.value = "";
  };
  const handleImage = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (>${MAX_FILE_SIZE_MB}MB)`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato não permitido. Use JPG, PNG ou WEBP.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Substituir imagem do produto
  const handleReplaceProductImage = async (id: number) => {
    const file = replaceFiles[id];
    if (!file) {
      toast.error("Selecione um arquivo para substituir");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadToCloudinary(file);
      const payload = { image: uploaded.secure_url, publicId: uploaded.public_id };

      if (IS_SUPABASE_READY) {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
      }

      setStoredProducts((prev) => prev.map((p) => (p.id === id ? { ...p, image: payload.image, publicId: payload.publicId } : p)));
      setReplaceFiles((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast.success("Imagem atualizada");
    } catch (e: any) {
      toast.error("Falha ao atualizar imagem", { description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  // Remover imagem do produto (somente referência)
  const handleRemoveProductImage = async (id: number) => {
    setUploading(true);
    try {
      const payload: any = { image: null, publicId: null };

      if (IS_SUPABASE_READY) {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
      }

      setStoredProducts((prev) => prev.map((p) => (p.id === id ? { ...p, image: null, publicId: null } : p)));
      toast.success("Imagem removida do produto");
    } catch (e: any) {
      toast.error("Falha ao remover imagem", { description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    let imageUrl = product.imageUrl;
    let publicId: string | undefined;

    if (imageFile) {
      setUploading(true);
      try {
        const uploaded = await uploadToCloudinary(imageFile);
        imageUrl = uploaded.secure_url;
        publicId = uploaded.public_id;
      } catch (err: any) {
        toast.error("Falha no upload para Cloudinary", {
          description: err?.message ?? "Verifique o upload preset e o cloud name",
        });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const allocatedTotal = (product.sizes || []).reduce((acc, s) => acc + (Number(distribution[s] || 0)), 0);
    const totalStock = Number(product.stock || 0);

    const baseProductForSupabase = {
      name: product.name,
      category: product.category,
      price: product.price,
      sizes: product.sizes,
      stock: allocatedTotal > 0 ? allocatedTotal : totalStock,
      image: imageUrl || "",
      publicId,
      stockBySize: Object.fromEntries((product.sizes || []).map((s) => [s, Number(distribution[s] || 0)])),
    } as const;

    if (!IS_SUPABASE_READY) {
      toast.error("Supabase não configurado. Salvamento indisponível.");
      return;
    }

    try {
      const { data, error } = await supabase.from("products").insert([baseProductForSupabase]).select("*").single();
      if (error) throw error;
      setStoredProducts((prev) => [...prev, data]);
      toast.success("Produto cadastrado", { description: `${product.name} - ${formatBRL(product.price)}` });
      setProduct({ name: "", category: "", price: 0, sizes: [], stock: 0, imageUrl });
      setImageFile(null);
      setImagePreview(null);
      setDistribution({});
    } catch (e: any) {
      toast.error("Falha ao salvar no Supabase", { description: e?.message });
    }
  };

  const handleAddSizeToModel = async (id: number, newSize: string) => {
    if (!newSize) return;
    const target = storedProducts.find((p) => p.id === id);
    const sizes = Array.isArray(target?.sizes) ? target!.sizes : [];
    if (sizes.includes(newSize)) {
      toast.success(`Tamanho ${newSize} já existe`);
      return;
    }
    const nextSizes = [...sizes, newSize];
    const nextStockBySize = { ...(target?.stockBySize || {}) } as Record<string, number>;
    nextStockBySize[newSize] = 0;
    const total = Object.values(nextStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);

    if (IS_SUPABASE_READY) {
      try {
        const { error } = await supabase
          .from("products")
          .update({ sizes: nextSizes, stockBySize: nextStockBySize, stock: total })
          .eq("id", id);
        if (error) throw error;
        setStoredProducts((prev) => prev.map((p) => (p.id === id ? { ...p, sizes: nextSizes, stockBySize: nextStockBySize, stock: total } : p)));
        toast.success(`Tamanho ${newSize} adicionado`);
        return;
      } catch (e: any) {
        toast.error("Falha ao atualizar no Supabase", { description: e?.message });
      }
    } else {
      toast.error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }
    // Sem fallback local: se Supabase não estiver pronto, apenas exibe erro.
    
  };

  const handleRemoveSizeFromModel = async (id: number, size: string) => {
    const target = storedProducts.find((p) => p.id === id);
    const sizes = Array.isArray(target?.sizes) ? target!.sizes : [];
    if (!sizes.includes(size)) {
      toast.error(`Tamanho ${size} não existe no produto`);
      return;
    }
    const nextSizes = sizes.filter((s) => s !== size);
    const baseStockBySize = { ...(target?.stockBySize || {}) } as Record<string, number>;
    delete baseStockBySize[size];
    const total = Object.values(baseStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);
    if (IS_SUPABASE_READY) {
      try {
        const { error } = await supabase
          .from("products")
          .update({ sizes: nextSizes, stockBySize: baseStockBySize, stock: total })
          .eq("id", id);
        if (error) throw error;
        setStoredProducts((prev) => prev.map((p) => (p.id === id ? { ...p, sizes: nextSizes, stockBySize: baseStockBySize, stock: total } : p)));
        toast.success(`Tamanho ${size} removido`);
        return;
      } catch (e: any) {
        toast.error("Falha ao atualizar no Supabase", { description: e?.message });
      }
    } else {
      toast.error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }
  };

  const handleUpdateProductFields = async (id: number) => {
    const fields = editFields[id];
    if (!fields) return;
    const { name, category, price, stock } = fields as { name?: string; category?: string; price?: number; stock?: number };

    const payload: any = {};
    if (typeof name !== "undefined") payload.name = name;
    if (typeof category !== "undefined") payload.category = category;
    if (typeof price !== "undefined") payload.price = price;
    if (typeof stock === "number" && Number.isFinite(stock)) payload.stock = stock;

    if (IS_SUPABASE_READY) {
      try {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
        setStoredProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...payload } : p)));
        setEditFields((prev) => { const next = { ...prev }; delete next[id]; return next; });
        toast.success("Produto atualizado");
        return;
      } catch (e: any) {
        toast.error("Falha ao atualizar no Supabase", { description: e?.message });
      }
    } else {
      toast.error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }
  };



  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Saindo...");
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen relative">
      <Header
        showCart={false}
        rightAction={(
          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={handleLogout}>Sair</Button>
        )}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Painel Administrativo</h1>
        </div>


        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
              <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="stock">Estoque</TabsTrigger>
              <TabsTrigger value="sizes">Tamanhos</TabsTrigger>
              <TabsTrigger value="images">Imagens</TabsTrigger>
              <TabsTrigger value="categories">Categorias</TabsTrigger>
            </TabsList>

          {/* Pedidos */}
          <TabsContent value="pedidos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Pedidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-end">
                  <div className="flex-1">
                    <Label>Buscar (nome do cliente ou ID)</Label>
                    <Input placeholder="Ex: João ou 8fbd..." value={pedidoSearch} onChange={(e) => setPedidoSearch(e.target.value)} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                      value={pedidoStatusFilter}
                      onChange={(e) => setPedidoStatusFilter(e.target.value)}
                    >
                      <option value="todos">Todos</option>
                      <option value="pendente">Pendente</option>
                      <option value="concluido">Concluído</option>
                      <option value="devolvido">Devolvido</option>
<option value="parcialmente_devolvido">Parcialmente Devolvido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>

                {orderedPedidosByDate.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-3 py-2 text-left">Data</th>
                          <th className="px-3 py-2 text-left">ID</th>
                          <th className="px-3 py-2 text-left">Cliente</th>
                          <th className="px-3 py-2 text-left">Telefone</th>
                          <th className="px-3 py-2 text-left">Total</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePedidos.map((p) => (
                          <tr key={p.id} onClick={() => setPedidoDetalhesId(p.id)} className="hover:bg-muted/40 cursor-pointer">
                            <td className="px-3 py-2 align-middle whitespace-nowrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>{new Date(p.data_criacao).toLocaleDateString()}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{new Date(p.data_criacao).toLocaleTimeString()}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                            <td className="px-3 py-2 align-middle whitespace-nowrap font-mono text-xs w-10 text-center" title="Sequencial">{pedidoSeq[String(p.id)] ?? '—'}</td>
                            <td className="px-3 py-2 align-middle whitespace-nowrap max-w-[220px] truncate" title={p.cliente_nome}>{p.cliente_nome}</td>
                            <td className="px-3 py-2 align-middle whitespace-nowrap">{p.cliente_telefone}</td>
                            <td className="px-3 py-2 align-middle">{formatBRL(Number(p.valor_total || 0))}</td>
                            <td className="px-3 py-2 align-middle">
                              {p.status === 'pendente' && <Badge className="bg-amber-500 text-black">Pendente</Badge>}
{p.status === 'concluido' && <span className="text-green-500 font-medium">Concluído</span>}
{p.status === 'parcialmente_devolvido' && <span className="text-amber-300 font-medium">Parcialmente Devolvido</span>}
{p.status === 'devolvido' && <span className="text-amber-400 font-medium">Devolvido</span>}
{p.status === 'cancelado' && <span className="text-white font-medium">Cancelado</span>}
                            </td>
                            <td className="px-3 py-2 align-middle">
                              <div className="flex items-center gap-2">
                                {p.status === 'pendente' ? (
                                  <>
                                    <button
                                      className="group relative overflow-hidden px-3 py-1.5 text-sm font-semibold rounded-md text-green-600 bg-black disabled:opacity-50"
                                      onClick={(e) => { e.stopPropagation(); setConfirmAction({ id: p.id, action: 'concluir' }); }}
                                    >
                                      <span className="relative z-10 transition-colors duration-300 group-hover:text-white">Confirmar</span>
                                      <span className="absolute inset-0 z-0 scale-x-0 bg-green-600 transition-transform duration-300 ease-out origin-left group-hover:scale-x-100" />
                                    </button>
                                    <button
                                      className="group relative overflow-hidden px-3 py-1.5 text-sm font-semibold rounded-md text-red-600 bg-black disabled:opacity-50"
                                      onClick={(e) => { e.stopPropagation(); setConfirmAction({ id: p.id, action: 'cancelar' }); }}
                                    >
                                      <span className="relative z-10 transition-colors duration-300 group-hover:text-white">Cancelar</span>
                                      <span className="absolute inset-0 z-0 scale-x-0 bg-red-600 transition-transform duration-300 ease-out origin-left group-hover:scale-x-100" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="group relative overflow-hidden px-3 py-1.5 text-sm font-semibold rounded-md text-[#262626] bg-black disabled:opacity-50"
                                    onClick={(e) => { e.stopPropagation(); setPedidoDetalhesId(p.id); }}
                                  >
                                    <span className="relative z-10 transition-colors duration-300 group-hover:text-white text-neutral-200">Detalhar</span>
                                    <span className="absolute inset-0 z-0 scale-x-0 bg-[#262626] transition-transform duration-300 ease-out origin-left group-hover:scale-x-100" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Mostrando {pageSize} por página</span>
                        <select
                          className="rounded-md border px-2 py-1 text-xs bg-background text-foreground"
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                          <option value={15}>15</option>
                          <option value={30}>30</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" disabled={pedidoPage <= 1} onClick={() => setPedidoPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                        {(() => {
                          const windowSize = 5;
                          const pages: (number | 'ellipsis')[] = [];
                          const start = Math.max(1, pedidoPage - Math.floor(windowSize / 2));
                          const end = Math.min(totalPages, start + windowSize - 1);
                          const adjustedStart = Math.max(1, end - windowSize + 1);
                          if (adjustedStart > 1) {
                            pages.push(1);
                            if (adjustedStart > 2) pages.push('ellipsis');
                          }
                          for (let n = adjustedStart; n <= end; n++) pages.push(n);
                          if (end < totalPages) {
                            if (end < totalPages - 1) pages.push('ellipsis');
                            pages.push(totalPages);
                          }
                          return pages.map((item, idx) => (
                            item === 'ellipsis' ? (
                              <span key={`el-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                            ) : (
                              <Button key={item} variant={item === pedidoPage ? "default" : "outline"} onClick={() => setPedidoPage(item as number)} className="h-8 px-2 text-xs">
                                {item}
                              </Button>
                            )
                          ));
                        })()}
                        <Button variant="outline" disabled={pedidoPage >= totalPages} onClick={() => setPedidoPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Produtos */}
          <TabsContent value="products" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Adicionar Produto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome</Label>
                    <Input value={product.name} onChange={(e) => handleChange("name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    {/* Select de categorias cadastradas */}
                    <select
                      className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                      value={product.category}
                      onChange={(e) => handleChange("category", e.target.value)}
                    >
                      <option value="">Selecione uma categoria</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">Cadastre novas categorias na aba "Categorias"</p>
                  </div>
                  <div>
                    <Label>Preço (R$)</Label>
                    <Input type="number" value={product.price} onChange={(e) => handleChange("price", parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <Label>Estoque (total)</Label>
                    <Input type="number" value={product.stock ?? 0} onChange={(e) => handleChange("stock", parseInt(e.target.value))} />
                  </div>
                </div>

                {/* Tamanhos */}
                <div>
                  <Label>Tamanhos</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(
                      ["bone", "meia", "relogio"].includes(normalizeCategory(product.category || ""))
                        ? ["U"]
                        : ["PP", "P", "M", "G", "GG", "XG"]
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`px-3 py-2 rounded-md border ${
                          product.sizes.includes(s)
                            ? "bg-primary/90 text-primary-foreground border-primary"
                            : "border-border hover:border-primary/50 bg-background text-foreground"
                        }`}
                        onClick={() => {
                          setProduct((prev) => {
                            const includes = prev.sizes.includes(s);
                            return {
                              ...prev,
                              sizes: includes ? prev.sizes.filter((x) => x !== s) : sortSizes([...prev.sizes, s]),
                            };
                          });
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    Selecione os tamanhos aplicáveis ao produto.
                  </p>
                </div>

                {/* Distribuição do estoque por tamanho */}
                <div>
                  <Label>Distribuir estoque por tamanho</Label>
                  <p className="text-xs text-muted-foreground mt-1">Total: {product.stock ?? 0} &nbsp;•&nbsp; Restante: {distributionRemaining}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {sortSizes(product.sizes || []).map((s) => (
                      <div key={s} className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                        <span className="font-medium mr-2">{s}</span>
                        <Input
                          type="number"
                          value={Number(distribution[s] ?? 0)}
                          onChange={(e) => setDistributionForSize(s, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    ))}
                  </div>
                  {distributionRemaining > 0 ? (
                    <p className="text-xs text-destructive mt-1">Ainda faltam {distributionRemaining} unidades para alocar.</p>
                  ) : (
                    <p className="text-xs text-emerald-500 mt-1">Distribuição concluída.</p>
                  )}
                </div>

                {/* Imagem */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div>
                    <Label>Foto do produto</Label>
                    <Input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0] ?? undefined)} />
                    {imagePreview && (
                      <div className="mt-2">
                        <img src={imagePreview} alt="Preview" className="rounded-md border" />
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>URL da imagem (opcional)</Label>
                    <Input value={product.imageUrl ?? ""} onChange={(e) => handleChange("imageUrl", e.target.value)} />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setProduct({ name: "", category: "", price: 0, sizes: [], stock: 0 });
                      setImageFile(null);
                      setImagePreview(null);
                      setDistribution({});
                    }}
                  >
                    Limpar
                  </Button>
                  <Button onClick={handleSubmit} disabled={uploading}>{uploading ? "Enviando imagem..." : "Salvar Produto"}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Estoque - formato lista com expansão */}
          <TabsContent value="stock" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Estoque</CardTitle>
              </CardHeader>
              <CardContent>
                {storedProducts.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum produto cadastrado ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {storedProducts.map((p) => {
                      const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ["U"];  
                      const selected = selectedSizes[p.id] || sizes[0];
                      const currentStockBySize = p.stockBySize || {};
                      const computedTotal = (() => {
                        const sum = Object.values(currentStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);
                        return sum > 0 ? sum : Number(p.stock || 0);
                      })();
                      const isExpanded = expandedProductId === p.id;
                      return (
                        <div key={p.id} className="rounded-md border border-border/50 bg-background">
                          <button
                            className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50"
                            onClick={() => setExpandedProductId((prev) => (prev === p.id ? null : p.id))}
                          >
                            <img src={p.image} alt={p.name} className="w-12 h-12 object-cover rounded" />
                            <div className="flex-1">
                              <div className="font-medium">{p.name}</div>
                              <div className="text-xs text-muted-foreground">{p.category}</div>
                            </div>
                            <Badge className="bg-primary/90 text-primary-foreground">{computedTotal} un.</Badge>
                          </button>
                          {isExpanded && (
                            <div className="p-3 border-t border-border/50 space-y-4">
                              {/* Substituir bloco de edição por opções completas */}
                              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 scrollbar-hide">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <Label>Nome</Label>
                                    <Input
                                      value={editFields[p.id]?.name ?? p.name}
                                      onChange={(e) =>
                                        setEditFields((prev) => ({
                                          ...prev,
                                          [p.id]: {
                                            ...(prev[p.id] || { name: p.name, category: p.category, price: Number(p.price || 0), stock: Number(p.stock || 0) }),
                                            name: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>Categoria</Label>
                                    <select
                                      className="w-full rounded-md border px-2 py-2 bg-background text-foreground"
                                      value={editFields[p.id]?.category ?? p.category}
                                      onChange={(e) =>
                                        setEditFields((prev) => ({
                                          ...prev,
                                          [p.id]: {
                                            ...(prev[p.id] || { name: p.name, category: p.category, price: Number(p.price || 0), stock: Number(p.stock || 0) }),
                                            category: e.target.value,
                                          },
                                        }))
                                      }
                                    >
                                      {categories.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <Label>Preço (R$)</Label>
                                    <Input
                                      type="number"
                                      value={Number(editFields[p.id]?.price ?? p.price)}
                                      onChange={(e) =>
                                        setEditFields((prev) => ({
                                          ...prev,
                                          [p.id]: {
                                            ...(prev[p.id] || { name: p.name, category: p.category, price: Number(p.price || 0), stock: Number(p.stock || 0) }),
                                            price: parseFloat(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                              
                              {/* Chips de tamanhos para adicionar/remover */}
                              <div>
                                <Label>Tamanhos</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {(
                                    ["bone", "meia", "relogio"].includes(normalizeCategory((editFields[p.id]?.category ?? p.category) || ""))
                                      ? ["U"]
                                      : ["PP", "P", "M", "G", "GG", "XG"]
                                  ).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      className={`px-3 py-2 rounded-md border ${
                                        p.sizes.includes(s)
                                          ? "bg-primary/90 text-primary-foreground border-primary"
                                          : "border-border hover:border-primary/50 bg-background text-foreground"
                                      }`}
                                      onClick={() => {
                                        if (p.sizes.includes(s)) {
                                          void handleRemoveSizeFromModel(p.id, s);
                                        } else {
                                          void handleAddSizeToModel(p.id, sortSizes([s])[0]);
                                        }
                                      }}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Distribuição por tamanho */}
                              <div>
                                <Label>Distribuir estoque por tamanho</Label>
                                {(() => {
                                  const currentStockBySize = p.stockBySize || {};
                                  const editedTotal = Number(editFields[p.id]?.stock ?? computedTotal);
                                  const distributionTotal = (p.sizes || []).reduce((acc, s) => acc + Number(currentStockBySize[s] || 0), 0);
                                  const remaining = Math.max(0, editedTotal - distributionTotal);
                                  return (
                                    <>
                                      <p className="text-xs text-muted-foreground mt-1">Total: {editedTotal} &nbsp;•&nbsp; Restante: {remaining}</p>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                        {(p.sizes || []).map((s: string) => (
                                          <div key={s} className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                                            <span className="font-medium mr-2">{s}</span>
                                            <Input
                                              type="number"
                                              value={Number(currentStockBySize[s] ?? 0)}
                                              onChange={(e) => handleStockBySizeChange(p.id, s, parseInt(e.target.value) || 0)}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                              
                              {/* Estoque total */}
                              <div>
                                <Label>Estoque (total)</Label>
                                <Input
                                  type="number"
                                  value={Number(editFields[p.id]?.stock ?? computedTotal)}
                                  onChange={(e) =>
                                    setEditFields((prev) => ({
                                      ...prev,
                                      [p.id]: {
                                        ...(prev[p.id] || { name: p.name, category: p.category, price: Number(p.price || 0), stock: computedTotal }),
                                        stock: parseInt(e.target.value) || 0,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              
                              <div className="flex items-end justify-end">
                                <Button variant="outline" onClick={() => handleUpdateProductFields(p.id)}>Salvar alterações</Button>
                              </div>
                            </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tamanhos */}
          <TabsContent value="sizes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Tamanhos (Global)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Novo tamanho (Ex: PP, P, M, G, GG, XG, U...)"
                    value={newGlobalSize}
                    onChange={(e) => setNewGlobalSize(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      const raw = newGlobalSize.trim().toUpperCase();
                      if (!raw) return;
                      if (globalSizes.includes(raw)) {
                        toast.error("Tamanho já existe");
                        return;
                      }
                      const next = sortSizes([...globalSizes, raw]);
                      saveGlobalSizes(next);
                      setNewGlobalSize("");
                      toast.success("Tamanho adicionado");
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                  {globalSizes.map((s) => (
                    <div key={s} className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                      {editingSize === s ? (
                        <div className="flex items-center gap-2 w-full">
                          <Input
                            value={sizeEditValue}
                            onChange={(e) => setSizeEditValue(e.target.value)}
                            placeholder="Editar tamanho"
                          />
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const raw = sizeEditValue.trim().toUpperCase();
                              if (!raw) return;
                              if (raw === s) {
                                setEditingSize(null);
                                setSizeEditValue("");
                                return;
                              }
                              if (globalSizes.includes(raw)) {
                                toast.error("Tamanho já existe");
                                return;
                              }
                              const next = sortSizes([...globalSizes.filter((x) => x !== s), raw]);
                              saveGlobalSizes(next);
                              setEditingSize(null);
                              setSizeEditValue("");
                              toast.success("Tamanho atualizado");
                            }}
                            title="Salvar"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingSize(null);
                              setSizeEditValue("");
                            }}
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span>{s}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingSize(s);
                                setSizeEditValue(s);
                              }}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                const next = globalSizes.filter((x) => x !== s);
                                saveGlobalSizes(next);
                              }}
                            >
                              Remover
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categorias */}
          <TabsContent value="categories" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Categorias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input placeholder="Nova categoria" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  <Button
                    onClick={() => {
                      const val = newCategory.trim();
                      if (!val) return;
                      if (categories.includes(val)) {
                        toast.error("Categoria já existe");
                        return;
                      }
                      const next = [...categories, val];
                      saveCategories(next);
                      setNewCategory("");
                      toast.success("Categoria adicionada");
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                  {categories.map((c) => (
                    <div key={c} className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                      {editingCategory === c ? (
                        <div className="flex items-center gap-2 w-full">
                          <Input
                            value={categoryEditValue}
                            onChange={(e) => setCategoryEditValue(e.target.value)}
                            placeholder="Editar categoria"
                          />
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const val = categoryEditValue.trim();
                              if (!val) return;
                              if (val === c) {
                                setEditingCategory(null);
                                setCategoryEditValue("");
                                return;
                              }
                              if (categories.includes(val)) {
                                toast.error("Categoria já existe");
                                return;
                              }
                              const next = [...categories.filter((x) => x !== c), val];
                              saveCategories(next);
                              setEditingCategory(null);
                              setCategoryEditValue("");
                              toast.success("Categoria atualizada");
                            }}
                            title="Salvar"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingCategory(null);
                              setCategoryEditValue("");
                            }}
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span>{c}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingCategory(c);
                                setCategoryEditValue(c);
                              }}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                const next = categories.filter((x) => x !== c);
                                saveCategories(next);
                              }}
                            >
                              Remover
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Imagens */}
          <TabsContent value="images" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Imagens</CardTitle>
              </CardHeader>
              <CardContent>
                {storedProducts.filter((p) => p.image || p.publicId).length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma imagem vinculada a itens.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {storedProducts
                      .filter((p) => p.image || p.publicId)
                      .map((p) => (
                        <div key={p.id} className="rounded-md border p-3 flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.publicId ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${p.publicId}` : p.image}
                              alt={p.name}
                              className="w-20 h-20 object-cover rounded"
                            />
                            <div>
                              <div className="font-medium">{p.name}</div>
                              <div className="text-sm text-muted-foreground">ID: {p.id}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* input de arquivo oculto, acionado pelo botão Alterar imagem */}
                            <input
                              ref={(el) => { fileInputRefs.current[p.id] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleSelectReplaceFile(p.id, e.target.files?.[0] ?? undefined)}
                            />
                            <Button variant="outline" onClick={() => triggerFilePickerForProduct(p.id)} disabled={uploading}>Alterar imagem</Button>
                            <Button
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveProductImage(p.id)}
                            >
                              Remover imagem
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!confirmReplaceForId} onOpenChange={(open) => {
        if (!open) {
          if (confirmReplaceForId != null) handleCancelReplace(confirmReplaceForId);
          setConfirmReplaceForId(null);
          setConfirmReplacePreview(null);
        }
      }}>
        <DialogContent className="bg-[#141414] text-green-400 border border-green-600">
          <DialogHeader>
            <DialogTitle className="text-green-500">Confirmar alteração de imagem</DialogTitle>
            <DialogDescription className="text-green-400">
              Esta ação irá substituir a imagem atual do produto. Confirme para continuar.
            </DialogDescription>
          </DialogHeader>
          {confirmReplacePreview && (
            <div className="mt-4">
              <img src={confirmReplacePreview} alt="Prévia da nova imagem" className="w-full max-h-64 object-contain rounded border border-green-700" />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="border-green-600 text-green-400 hover:bg-green-950"
              onClick={() => {
                if (confirmReplaceForId != null) handleCancelReplace(confirmReplaceForId);
                setConfirmReplaceForId(null);
                setConfirmReplacePreview(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-black"
              onClick={() => {
                if (confirmReplaceForId != null) {
                  handleReplaceProductImage(confirmReplaceForId);
                  setConfirmReplaceForId(null);
                  setConfirmReplacePreview(null);
                }
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(open) => setConfirmAction(open ? confirmAction : null)}>
        <DialogContent className="bg-[#141414] text-green-400 border border-green-600">
          <DialogHeader>
            <DialogTitle className="text-green-500">Confirmar {confirmAction?.action === 'concluir' ? 'conclusão' : 'cancelamento'} do pedido</DialogTitle>
            <DialogDescription className="text-green-400">
              Revise os itens e o impacto no estoque antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(pedidos.find(p => p.id === confirmAction?.id)?.itens || []).map((it: any, idx: number) => {
              const prod = storedProducts.find(sp => sp.id === it.product_id);
              const estoqueAtual = Math.max(0, Number((prod?.stockBySize || {})[it.tamanho] || 0));
              const apos = confirmAction?.action === 'concluir' ? Math.max(0, estoqueAtual - Number(it.quantidade || 0)) : estoqueAtual;
              return (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span>• {it.produto}</span>
                  <Badge variant="outline">{it.tamanho}</Badge>
                  <span>x{it.quantidade}</span>
                  <span className="text-xs text-muted-foreground">Estoque atual: {estoqueAtual}</span>
                  <span className="text-xs text-muted-foreground">Após ação: {apos}</span>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { if (confirmAction) handleConfirmAction(confirmAction.id, confirmAction.action); setConfirmAction(null); }}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pedidoDetalhesId != null} onOpenChange={(open) => setPedidoDetalhesId(open ? pedidoDetalhesId : null)}>
        <DialogContent className="bg-black text-green-400 border border-green-600">
          <DialogHeader>
            <DialogTitle className="text-white text-xl sm:text-2xl">Detalhes do pedido</DialogTitle>
            <DialogDescription className="text-white">ID: {pedidoSeq[String(pedidoDetalhesId ?? '')] ?? '—'}</DialogDescription>
          </DialogHeader>
          {(() => {
            const pedido = pedidos.find(p => p.id === pedidoDetalhesId);
            const itens = pedido?.itens || [];
            const groups: Record<string, number> = {};
            for (const it of itens) {
              const t = it.tamanho;
              const q = Number(it.quantidade || 0);
              if (!t || q <= 0) continue;
              groups[t] = (groups[t] || 0) + q;
            }
            const sizes = Object.keys(groups).sort((a,b) => rankSize(a) - rankSize(b));
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-md border border-green-600/40 p-3 bg-black/40">
                    <p className="text-sm"><span className="text-white">Cliente:</span> <span className="text-green-500">{pedido?.cliente_nome || '—'}</span></p>
                    <p className="text-sm"><span className="text-white">Telefone:</span> <span className="text-green-500">{pedido?.cliente_telefone || '—'}</span></p>
                    <p className="text-sm"><span className="text-white">Data/Hora:</span> <span className="text-green-500">{pedido?.data_criacao ? new Date(pedido.data_criacao).toLocaleString() : '—'}</span></p>
                  </div>
                  <div className="rounded-md border border-green-600/40 p-3 bg-black/40">
                    <p className="text-sm"><span className="text-white">Status:</span> <span className={pedido?.status === 'pendente' ? 'text-amber-500' : pedido?.status === 'cancelado' ? 'text-white' : pedido?.status === 'devolvido' ? 'text-amber-400' : pedido?.status === 'parcialmente_devolvido' ? 'text-amber-300' : 'text-green-500'}>{pedido?.status === 'parcialmente_devolvido' ? 'Parcialmente Devolvido' : (pedido?.status || '—')}</span></p>
                    <p className="text-sm"><span className="text-white">Total:</span> <span className="text-green-500">{formatBRL(Number(pedido?.valor_total || 0))}</span></p>
                  </div>
                </div>
                <div>
                   <p className="text-white text-sm mb-2">Itens detalhados</p>
                   <div className="space-y-2">
                     {itens.map((it: any, i: number) => (
                       <div key={i} className="rounded-md border border-green-600 bg-black/40 p-2 grid grid-cols-[auto_2rem_auto_auto] items-center gap-2">
                         <span className="text-white">{it.produto}</span>
                        <Badge variant="outline" className="w-8 justify-center text-xs">{it.tamanho}</Badge>
                        <span className="text-green-500">x{it.quantidade}</span>
                        {Number(it.devolvido || 0) > 0 && (
                          <span className="text-amber-400 text-xs">Devolvido: {it.devolvido}</span>
                        )}
                       </div>
                     ))}
                     {itens.length === 0 && <p className="text-sm text-muted-foreground">Sem itens.</p>}
                   </div>
                   {pedido?.status === 'concluido' && (
                     <div className="mt-3">
                       <Button variant="destructive" onClick={() => {
                         const itensPedido = pedido?.itens || [];
                         if (itensPedido.length <= 1) {
                           const qs = itensPedido.map((it: any) => Math.max(0, Number(it.quantidade || 0) - Number(it.devolvido || 0)));
                           applyDevolucaoEstoqueParcial(pedido, qs);
                         } else {
                           setDevolucaoPedidoId(String(pedido?.id));
                         }
                       }}>Devolver pedido</Button>
                     </div>
                   )}
                 </div>
              </div>
            );
          })()}

        </DialogContent>
      </Dialog>

      {devolucaoPedidoId && (
        <Dialog open={true} onOpenChange={(o) => { if (!o) { setDevolucaoPedidoId(null); setDevolucaoParcial(false); setDevolucaoQuantidades([]); } }}>
          <DialogContent className="bg-black text-green-400 border border-green-600">
            <DialogHeader>
              <DialogTitle className="text-white">Devolução do pedido #{pedidoSeq[String(devolucaoPedidoId)] ?? '—'}</DialogTitle>
              <DialogDescription className="text-white/70">Escolha devolução total ou parcial.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant={devolucaoParcial ? "outline" : "default"} onClick={() => setConfirmTotalOpen(true)}>Devolução total</Button>
                <Button variant={devolucaoParcial ? "default" : "outline"} onClick={() => {
                  setDevolucaoParcial(true);
                  const pedido = pedidos.find(p => String(p.id) === String(devolucaoPedidoId));
                  const itens = pedido?.itens || [];
                  setDevolucaoQuantidades(itens.map(() => 0));
                }}>Devolução parcial</Button>
              </div>
              {devolucaoParcial && (
                <div className="space-y-3">
                  {(pedidos.find(p => String(p.id) === String(devolucaoPedidoId))?.itens || []).map((it: any, idx: number) => {
                    const max = Math.max(0, Number(it.quantidade || 0) - Number(it.devolvido || 0));
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">{it.produto} - Tam {it.tamanho}</div>
                          <div className="text-xs">Máx: {max}</div>
                        </div>
                        <Input type="number" min={0} max={max} value={devolucaoQuantidades[idx] ?? 0} className="w-24"
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(max, Number(e.target.value || 0)));
                            setDevolucaoQuantidades(prev => {
                              const next = [...prev];
                              next[idx] = v;
                              return next;
                            });
                          }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDevolucaoPedidoId(null); setDevolucaoParcial(false); setDevolucaoQuantidades([]); }}>Cancelar</Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
                const pedido = pedidos.find(p => String(p.id) === String(devolucaoPedidoId));
                if (!pedido) { setDevolucaoPedidoId(null); return; }
                if (!devolucaoParcial) {
                  const qs = (pedido.itens || []).map((it: any) => Math.max(0, Number(it.quantidade || 0) - Number(it.devolvido || 0)));
                  applyDevolucaoEstoqueParcial(pedido, qs);
                } else {
                  applyDevolucaoEstoqueParcial(pedido, devolucaoQuantidades);
                }
                setDevolucaoPedidoId(null);
                setDevolucaoParcial(false);
                setDevolucaoQuantidades([]);
              }}>Aplicar devolução</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {devolucaoPedidoId && (
        <AlertDialog open={confirmTotalOpen} onOpenChange={setConfirmTotalOpen}>
          <AlertDialogContent className="bg-black text-green-400 border border-green-600">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Confirmar devolução total</AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">Tem certeza que deseja devolver todos os itens da compra?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmTotalOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
                const pedido = pedidos.find(p => String(p.id) === String(devolucaoPedidoId));
                if (pedido) {
                  const qs = (pedido.itens || []).map((it: any) => Math.max(0, Number(it.quantidade || 0) - Number(it.devolvido || 0)));
                  applyDevolucaoEstoqueParcial(pedido, qs);
                }
                setConfirmTotalOpen(false);
                setDevolucaoPedidoId(null);
                setDevolucaoParcial(false);
                setDevolucaoQuantidades([]);
              }}>Devolver todos</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Botão flutuante NOVO PEDIDO */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          className="group relative overflow-hidden rounded-md px-4 py-3 font-semibold text-white bg-green-600 shadow-lg hover:bg-green-700 transition-colors"
          onClick={() => setNewPedidoOpen(true)}
          title="Criar novo pedido"
        >
          <span className="absolute inset-0 -translate-y-full group-hover:translate-y-0 bg-green-500/30 transition-transform"></span>
          <span className="relative">NOVO PEDIDO</span>
        </button>
      </div>

      {/* Modal de novo pedido */}
      <Dialog open={newPedidoOpen} onOpenChange={setNewPedidoOpen}>
        <DialogContent className="bg-[#141414] text-green-400 border border-green-600 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Novo pedido</DialogTitle>
            <DialogDescription className="text-white/70">Pesquise o produto, selecione tamanho e quantidade, e conclua o pedido.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 scrollbar-hide">
            <div>
              <Label className="text-white">Pesquisar produto</Label>
              <Input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Digite o nome do produto"
                className="mt-1"
              />
              <div className="mt-2 max-h-40 overflow-auto rounded border border-green-700/40 scrollbar-hide">
                {storedProducts
                  .filter(p => (p.name || "").toLowerCase().includes(productQuery.toLowerCase()))
                  .slice(0, 20)
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedProductId(p.id!); setSelectedSize(null); }}
                      className={`w-full text-left px-3 py-2 hover:bg-black/30 ${selectedProductId === p.id ? 'bg-black/40' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <img src={p.image} alt={p.name} className="w-10 h-10 object-cover rounded" />
                        <div>
                          <div className="text-white text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.category}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                {storedProducts.filter(p => (p.name || "").toLowerCase().includes(productQuery.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto encontrado.</div>
                )}
              </div>
            </div>

            {selectedProductId && (
              (() => {
                const prod = storedProducts.find(p => p.id === selectedProductId);
                const sizes = (prod?.sizes && prod.sizes.length ? prod.sizes : ["U"]).sort((a,b) => rankSize(a) - rankSize(b));
                return (
                  <div className="space-y-2">
                    <Label className="text-white">Tamanho</Label>
                    <div className="flex flex-wrap gap-2">
                      {sizes.filter(s => Math.max(0, Number((prod?.stockBySize || {})[s] || 0)) > 0).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSize(s)}
                          className={`px-3 py-2 rounded-md border ${selectedSize === s ? 'bg-primary/90 text-primary-foreground border-primary' : 'border-border bg-background text-foreground hover:border-primary/50'}`}
                        >
                          {s}
                        </button>
                      ))}
                      {sizes.filter(s => Math.max(0, Number((prod?.stockBySize || {})[s] || 0)) > 0).length === 0 && (
                        <span className="text-xs text-muted-foreground">Sem estoque disponível para os tamanhos deste produto.</span>
                      )}
                    </div>

                    {selectedSize && (
                      <p className="text-xs text-muted-foreground">Estoque disponível: {Math.max(0, Number(((storedProducts.find(p => p.id === selectedProductId)?.stockBySize || {})[selectedSize]) || 0))}</p>
                    )}
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                      <div>
                        <Label className="text-white">Quantidade</Label>
                        <Input type="number" min={1} value={quantity} onChange={(e) => {
  const v = e.target.value;
  const onlyDigits = v.replace(/[^0-9]/g, "");
  setQuantity(onlyDigits);
}} onBlur={() => {
  const raw = parseInt(quantity || "");
  const val = Number.isFinite(raw) ? raw : 1;
  const prod = storedProducts.find(p => p.id === selectedProductId);
  const estoqueSel = selectedSize ? Math.max(0, Number(((prod?.stockBySize || {})[selectedSize]) || 0)) : Number.POSITIVE_INFINITY;
  const existingItem = selectedSize ? adminCart.find(it => it.id === selectedProductId && it.size === selectedSize) : undefined;
  const maxAllowed = selectedSize ? Math.max(0, estoqueSel - (existingItem?.quantity || 0)) : val;
  if (Number.isFinite(maxAllowed) && val > maxAllowed) {
    if (maxAllowed === 0) {
      toast.info("Não há estoque disponível para adicionar este tamanho.");
      setQuantity("1");
    } else {
      toast.info(`Estoque disponível: ${maxAllowed}.`);
      setQuantity(String(maxAllowed));
    }
  } else if (val < 1) {
    setQuantity("1");
  } else {
    setQuantity(String(val));
  }
}} />
                      </div>
                      <Button onClick={addToAdminCart} disabled={!selectedSize || ((parseInt(quantity || "") || 0) <= 0)}>Adicionar</Button>
                    </div>
                  </div>
                );
              })()
            )}

            <div>
              <p className="text-white text-sm mb-2">Itens do pedido</p>
              <div className="space-y-2">
                {adminCart.map((it, i) => (
                  <div key={`${it.id}-${it.size}-${i}`} className="rounded-md border border-green-600/40 p-2 bg-black/40 flex items-center gap-3 flex-wrap md:flex-nowrap">
  {/* modelo (nome) */}
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-white min-w-0 max-w-[38%] truncate whitespace-nowrap">{it.name}</span>
      </TooltipTrigger>
      <TooltipContent>{it.name}</TooltipContent>
    </Tooltip>
  </TooltipProvider>

  {/* tamanho */}
  <Badge variant="outline" className="w-8 justify-center text-xs whitespace-nowrap">{it.size}</Badge>

  {/* Estoque */}
  {(() => {
    const prod = storedProducts.find(p => p.id === it.id);
    const estoqueDisp = Math.max(0, Number((prod?.stockBySize || {})[it.size] || 0));
    return <span className="text-xs text-muted-foreground whitespace-nowrap">Estoque: {estoqueDisp}</span>;
  })()}

  {/* preço */}
  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatBRL(it.price)}</span>

  {/* quantidade */}
  <Input type="number" min={1} value={it.quantity} onChange={(e) => updateAdminCartQuantity(i, parseInt(e.target.value) || 1)} className="w-16 h-8" />

  {/* Remover */}
  <Button variant="ghost" className="text-destructive hover:bg-destructive/10 whitespace-nowrap ml-auto" onClick={() => removeFromAdminCart(i)}>Remover</Button>
</div>
                ))}
                {adminCart.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-white">Total</span>
                <span className="text-green-500 font-semibold">{formatBRL(adminCartTotal)}</span>
              </div>
            </div>

            <div className="rounded-md border border-green-600/40 p-3 bg-black/40">
              <label className="flex items-center gap-2 text-white">
                <input type="checkbox" checked={informarCliente} onChange={(e) => setInformarCliente(e.target.checked)} />
                Informar cliente (nome e telefone)
              </label>
              {informarCliente && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label className="text-white">Nome do cliente</Label>
                    <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Ex: João" />
                  </div>
                  <div>
                    <Label className="text-white">Telefone</Label>
                    <Input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} placeholder="Ex: (75) 91234-5678" />
                  </div>
                </div>
              )}
              {!informarCliente && (
                <p className="text-xs text-muted-foreground mt-2">Se não informar, será usado nome "LOJA" e telefone "(XX) XXXXXX-XXXX".</p>
              )}
            </div>

            <div className="flex justify-end gap-2 sticky bottom-0 bg-[#141414] py-2">
              <Button variant="outline" onClick={() => { setNewPedidoOpen(false); }}>Cancelar</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setConfirmDebitarOpen(true)} disabled={adminCart.length === 0}>Concluir pedido</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de baixa de estoque */}
      <Dialog open={confirmDebitarOpen} onOpenChange={setConfirmDebitarOpen}>
        <DialogContent className="bg-[#141414] text-green-400 border border-green-600 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Deseja dar baixa no estoque ao concluir?</DialogTitle>
            <DialogDescription className="text-white/70">Se não, o pedido ficará como pendente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" onClick={() => { setConfirmDebitarOpen(false); void handleCreateAdminOrder(false); }}>Concluir sem baixa</Button>
              <Button onClick={() => { setConfirmDebitarOpen(false); void handleCreateAdminOrder(true); }}>Dar baixa</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Admin;
