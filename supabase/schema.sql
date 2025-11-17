-- Supabase schema inicial para FUT75
-- Execute este script no SQL Editor do seu projeto Supabase

-- Tabela de categorias (simples, usa nome como string)
CREATE TABLE IF NOT EXISTS public.categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- opcionalmente pode referenciar categories(name)
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image TEXT,
  publicId TEXT,
  sizes TEXT[] NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stockBySize JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir colunas existentes (idempotente)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS publicId TEXT,
  ADD COLUMN IF NOT EXISTS sizes TEXT[],
  ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stockBySize JSONB DEFAULT '{}'::jsonb;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- Associação de categoria por ID (FK)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES public.categories(id);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- Função para calcular o total de estoque a partir do stockBySize
CREATE OR REPLACE FUNCTION public.compute_stock_from_stock_by_size()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stockBySize IS NOT NULL THEN
    NEW.stock := (
      SELECT COALESCE(SUM((value)::text::integer), 0)
      FROM jsonb_each(NEW.stockBySize)
    );
  ELSE
    NEW.stock := COALESCE(NEW.stock, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para manter consistência de estoque
DROP TRIGGER IF EXISTS trg_products_compute_stock ON public.products;
CREATE TRIGGER trg_products_compute_stock
BEFORE INSERT OR UPDATE OF stockBySize ON public.products
FOR EACH ROW EXECUTE FUNCTION public.compute_stock_from_stock_by_size();

-- Observação sobre segurança:
-- Por enquanto, mantenha RLS desativado para permitir escrita via anon key.
-- Depois que implementarmos autenticação para admin, ativaremos RLS e políticas seguras.

-- Tabela de administradores (vincula ao usuário do Supabase Auth)
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Políticas para products: leitura pública, escrita apenas por admins
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products"
  ON public.products
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins insert products" ON public.products;
CREATE POLICY "Admins insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins update products" ON public.products;
CREATE POLICY "Admins update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins delete products" ON public.products;
CREATE POLICY "Admins delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- Políticas para categories: leitura pública, escrita apenas por admins
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories"
  ON public.categories
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins insert categories" ON public.categories;
CREATE POLICY "Admins insert categories"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins update categories" ON public.categories;
CREATE POLICY "Admins update categories"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins delete categories" ON public.categories;
CREATE POLICY "Admins delete categories"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- Políticas para admins: leitura apenas pelo próprio admin; nenhuma política de INSERT para evitar auto-adesão.
-- A inclusão do primeiro admin deve ser feita manualmente via SQL (copie o UUID do usuário logado e insira aqui).
DROP POLICY IF EXISTS "Admins read self" ON public.admins;
CREATE POLICY "Admins read self"
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Tabela de tamanhos globais
CREATE TABLE IF NOT EXISTS public.sizes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- Habilitar RLS para sizes
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;

-- Políticas para sizes: leitura pública, escrita apenas por admins
DROP POLICY IF EXISTS "Public read sizes" ON public.sizes;
CREATE POLICY "Public read sizes"
  ON public.sizes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins insert sizes" ON public.sizes;
CREATE POLICY "Admins insert sizes"
  ON public.sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins update sizes" ON public.sizes;
CREATE POLICY "Admins update sizes"
  ON public.sizes
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins delete sizes" ON public.sizes;
CREATE POLICY "Admins delete sizes"
  ON public.sizes
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- Exemplo de bootstrap (execute manualmente após criar o usuário):
-- INSERT INTO public.admins (user_id) VALUES ('00000000-0000-0000-0000-000000000000'); -- substitua pelo UUID real

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  itens JSONB NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL CHECK (valor_total >= 0),
  status TEXT NOT NULL CHECK (status IN ('pendente','concluido','cancelado','devolvido')),
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS para pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Políticas para pedidos
DROP POLICY IF EXISTS "Public insert pedidos" ON public.pedidos;
CREATE POLICY "Public insert pedidos"
  ON public.pedidos
  FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins select pedidos" ON public.pedidos;
CREATE POLICY "Admins select pedidos"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins update pedidos" ON public.pedidos;
CREATE POLICY "Admins update pedidos"
  ON public.pedidos
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- Permitir DELETE apenas para admins autenticados
DROP POLICY IF EXISTS "Admins delete pedidos" ON public.pedidos;
CREATE POLICY "Admins delete pedidos"
  ON public.pedidos
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

-- Índices úteis para pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON public.pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_criacao ON public.pedidos(data_criacao DESC);

-- Audit logs para ações em pedidos
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('concluir','cancelar')),
  actor_id uuid,
  actor_email text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins insert audit_logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

CREATE POLICY "Admins select audit_logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_audit_logs_pedido_id ON public.audit_logs(pedido_id);

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_telefone UNIQUE (telefone)
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Políticas: leitura por admins; insert público (para registrar durante pedido), update/delete por admins
DROP POLICY IF EXISTS "Public insert clientes" ON public.clientes;
CREATE POLICY "Public insert clientes"
  ON public.clientes
  FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins select clientes" ON public.clientes;
CREATE POLICY "Admins select clientes"
  ON public.clientes
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins update clientes" ON public.clientes;
CREATE POLICY "Admins update clientes"
  ON public.clientes
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins delete clientes" ON public.clientes;
CREATE POLICY "Admins delete clientes"
  ON public.clientes
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));