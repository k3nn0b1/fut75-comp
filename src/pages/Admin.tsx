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
      toast.success("Produto cadastrado", { description: `${product.name} - R$ ${product.price.toFixed(2)}` });
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
      <Header cartItemCount={0} onCartClick={() => {}} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Painel Administrativo</h1>
          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={handleLogout}>Sair</Button>
        </div>

        <Tabs defaultValue="products">
          <TabsList>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="stock">Estoque</TabsTrigger>
              <TabsTrigger value="sizes">Tamanhos</TabsTrigger>
              <TabsTrigger value="images">Imagens</TabsTrigger>
              <TabsTrigger value="categories">Categorias</TabsTrigger>
            </TabsList>

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
                              <div className="space-y-4">
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
                            <Button variant="destructive" onClick={() => handleRemoveProductImage(p.id)}>Remover imagem</Button>
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
        <DialogContent className="bg-black text-green-400 border border-green-600">
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

      <Footer />
    </div>
  );
};

export default Admin;

const sizeOrder = ["PP", "P", "M", "G", "GG", "XG"];
const rankSize = (s: string) => {
  const idx = sizeOrder.indexOf(s.toUpperCase());
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
};
const sortSizes = (arr: string[]) => [...(arr || [])].sort((a, b) => {
  const ra = rankSize(a);
  const rb = rankSize(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
});
