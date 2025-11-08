import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

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
  // Auth: auto-logout em refresh (usa sessionStorage)
  useEffect(() => {
    const isAuth = sessionStorage.getItem("admin_auth") === "true";
    if (!isAuth) {
      // se atualizar e não tiver sessão, força voltar para login
      window.location.href = "/login";
    }
  }, []);

  const [product, setProduct] = useState<AdminProduct>({
    name: "",
    category: "",
    price: 0,
    sizes: ["P", "M", "G", "GG"],
    stock: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [storedProducts, setStoredProducts] = useState<any[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  // Distribuição de estoque por tamanho (para cadastro de produto)
  const [distribution, setDistribution] = useState<Record<string, number>>({});

  // Categorias
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    try {
      const rawProds = localStorage.getItem("admin_products");
      setStoredProducts(rawProds ? JSON.parse(rawProds) : []);
      const rawCats = localStorage.getItem("admin_categories");
      setCategories(rawCats ? JSON.parse(rawCats) : []);
    } catch {}
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

  // Ajusta tamanhos automaticamente conforme categoria
  useEffect(() => {
    const cat = normalizeCategory(product.category || "");
    if (!cat) return;
    if (["bone", "meia", "relogio"].includes(cat)) {
      if (product.sizes.join(",") !== "U") {
        setProduct((prev) => ({ ...prev, sizes: ["U"] }));
        setDistribution({});
      }
    } else if (["camisa", "casaco", "regata"].includes(cat)) {
      const defaultSizes = ["PP", "P", "M", "G", "GG", "XG"];
      const same = product.sizes.length === defaultSizes.length && defaultSizes.every((x, i) => product.sizes[i] === x);
      if (!same) {
        setProduct((prev) => ({ ...prev, sizes: defaultSizes }));
      }
    }
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

  const saveCategories = (next: string[]) => {
    setCategories(next);
    localStorage.setItem("admin_categories", JSON.stringify(next));
  };

  const updateProductInLocalStorage = (id: number, updater: (p: any) => any) => {
    const raw = localStorage.getItem("admin_products");
    const arr = raw ? JSON.parse(raw) : [];
    const next = arr.map((p: any) => (p.id === id ? updater(p) : p));
    localStorage.setItem("admin_products", JSON.stringify(next));
    setStoredProducts(next);
  };

  const handleStockBySizeChange = (id: number, size: string, newStock: number) => {
    updateProductInLocalStorage(id, (p) => {
      const nextStockBySize = { ...(p.stockBySize || {}) };
      nextStockBySize[size] = newStock;
      const total = Object.values(nextStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);
      return { ...p, stockBySize: nextStockBySize, stock: total };
    });
    toast.success(`Estoque atualizado para tamanho ${size}`);
  };

  const handleDeleteProduct = (id: number) => {
    const raw = localStorage.getItem("admin_products");
    const arr = raw ? JSON.parse(raw) : [];
    const next = arr.filter((p: any) => p.id !== id);
    localStorage.setItem("admin_products", JSON.stringify(next));
    setStoredProducts(next);
    toast.success("Produto removido");
  };

  const handleChange = (field: keyof AdminProduct, value: any) => {
    setProduct((prev) => ({ ...prev, [field]: value }));
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

  const handleSubmit = async () => {
    try {
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
      if (allocatedTotal !== totalStock) {
        toast.error("Distribuição de estoque não confere", {
          description: `Total: ${totalStock}, Alocado: ${allocatedTotal}, Restante: ${totalStock - allocatedTotal}`,
        });
        return;
      }

      const newProduct = {
        id: Date.now(),
        name: product.name,
        category: product.category,
        price: product.price,
        sizes: product.sizes,
        stock: allocatedTotal,
        image: imageUrl || "",
        publicId,
        stockBySize: Object.fromEntries((product.sizes || []).map((s) => [s, Number(distribution[s] || 0)])),
      };

      const existingRaw = localStorage.getItem("admin_products");
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      existing.push(newProduct);
      localStorage.setItem("admin_products", JSON.stringify(existing));
      setStoredProducts(existing);

      toast.success("Produto cadastrado", { description: `${product.name} - R$ ${product.price.toFixed(2)}` });
      setProduct({ name: "", category: "", price: 0, sizes: ["P", "M", "G", "GG"], stock: 0, imageUrl });
      setImageFile(null);
      setImagePreview(null);
      setDistribution({});
    } catch (e) {
      toast.error("Falha ao cadastrar produto");
    }
  };

  const handleAddSizeToModel = (id: number, newSize: string) => {
    if (!newSize) return;
    updateProductInLocalStorage(id, (p) => {
      const sizes = Array.isArray(p.sizes) ? p.sizes : [];
      if (sizes.includes(newSize)) return p;
      const nextSizes = [...sizes, newSize];
      const nextStockBySize = { ...(p.stockBySize || {}) };
      nextStockBySize[newSize] = 0;
      const total = Object.values(nextStockBySize).reduce((acc, n) => acc + (Number(n) || 0), 0);
      return { ...p, sizes: nextSizes, stockBySize: nextStockBySize, stock: total };
    });
    toast.success(`Tamanho ${newSize} adicionado`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
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
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="images">Imagens</TabsTrigger>
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
                        disabled={["bone", "meia", "relogio"].includes(normalizeCategory(product.category || ""))}
                        onClick={() => {
                          if (["bone", "meia", "relogio"].includes(normalizeCategory(product.category || ""))) return;
                          setProduct((prev) => {
                            const includes = prev.sizes.includes(s);
                            return {
                              ...prev,
                              sizes: includes ? prev.sizes.filter((x) => x !== s) : [...prev.sizes, s],
                            };
                          });
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[
                      "bone",
                      "meia",
                      "relogio",
                    ].includes(normalizeCategory(product.category || ""))
                      ? "Categoria de tamanho único: aplicando U automaticamente."
                      : "Selecione os tamanhos aplicáveis ao produto."}
                  </p>
                </div>

                {/* Distribuição do estoque por tamanho */}
                <div>
                  <Label>Distribuir estoque por tamanho</Label>
                  <p className="text-xs text-muted-foreground mt-1">Total: {product.stock ?? 0} &nbsp;•&nbsp; Restante: {distributionRemaining}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {(product.sizes || []).map((s) => (
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
                      setProduct({ name: "", category: "", price: 0, sizes: ["P", "M", "G", "GG"], stock: 0 });
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
                            <Badge className="bg-primary/90 text-primary-foreground">{p.stock ?? 0} un.</Badge>
                          </button>
                          {isExpanded && (
                            <div className="p-3 border-t border-border/50 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <Label>Tamanho</Label>
                                  <select
                                    className="w-full rounded-md border px-2 py-2 bg-background text-foreground"
                                    value={selected}
                                    onChange={(e) => setSelectedSizes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  >
                                    {sizes.map((s: string) => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <Label>Estoque</Label>
                                  <Input
                                    type="number"
                                    value={Number(currentStockBySize[selected] ?? 0)}
                                    onChange={(e) => handleStockBySizeChange(p.id, selected, parseInt(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <Label>Adicionar tamanho</Label>
                                  <div className="flex gap-2">
                                    <Input placeholder="Ex: XG" id={`new-size-${p.id}`} />
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        const el = document.getElementById(`new-size-${p.id}`) as HTMLInputElement | null;
                                        const val = el?.value.trim().toUpperCase() || "";
                                        if (!val) return;
                                        handleAddSizeToModel(p.id, val);
                                        if (el) el.value = "";
                                      }}
                                    >
                                      Adicionar
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <Label>Estoque por tamanho</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                  {sizes.map((s) => {
                                    const qty = Number(currentStockBySize[s] ?? 0);
                                    const isZero = qty <= 0;
                                    return (
                                      <div key={s} className="flex items-center justify-between rounded-md border px-3 py-2 bg-background">
                                        <span className="font-medium">{s}</span>
                                        <span className={`text-sm ${isZero ? "text-destructive" : "text-foreground"}`}>{qty}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex justify-between">
                                <Button variant="destructive" onClick={() => handleDeleteProduct(p.id)}>Remover</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
                      <span>{c}</span>
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
                <p className="text-muted-foreground">Em breve: biblioteca de imagens com integração ao Google Drive.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
};

export default Admin;
