import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const queryClient = new QueryClient();

const AdminGuard = () => {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  const IS_SUPABASE_READY = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    const verify = async () => {
      try {
        const sessionFlag = sessionStorage.getItem("admin_auth") === "true";

        if (IS_SUPABASE_READY) {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error) {
            console.error("Erro ao obter usuário do Supabase:", error);
            toast.error("Falha ao verificar sessão");
            setIsAuth(false);
            navigate("/login", { replace: true });
            return;
          }
          if (user && sessionFlag) {
            setIsAuth(true);
          } else {
            setIsAuth(false);
            navigate("/login", { replace: true });
          }
        } else {
          // Modo desenvolvimento: sem Supabase, valida apenas pelo flag de sessão
          if (sessionFlag) {
            setIsAuth(true);
          } else {
            setIsAuth(false);
            navigate("/login", { replace: true });
          }
        }
      } catch (e) {
        console.error("Erro inesperado na verificação do AdminGuard:", e);
        toast.error("Erro ao validar acesso ao admin");
        setIsAuth(false);
        navigate("/login", { replace: true });
      } finally {
        setChecked(true);
      }
    };
    void verify();
  }, [navigate, IS_SUPABASE_READY]);

  if (!checked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ opacity: 0.7 }}>Verificando acesso...</span>
      </div>
    );
  }
  return isAuth ? <Admin /> : null;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/:prefix/login" element={<Login />} />
            <Route path="/admin" element={<AdminGuard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
