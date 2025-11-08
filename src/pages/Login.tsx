import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const IS_SUPABASE_READY = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

const Login = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (IS_SUPABASE_READY) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: user, password: pass });
        if (error || !data?.user) {
          toast.error("Credenciais inválidas");
        } else {
          const uid = data.user.id;
          const email = (data.user.email || "").toLowerCase();
          const { data: admins, error: adminErr } = await supabase
            .from("admins")
            .select("user_id")
            .eq("user_id", uid);
          const isAdmin = !adminErr && Array.isArray(admins) && admins.length > 0;
          const canBypass = email === "john.fcostaa@gmail.com"; // bypass temporário
          if (!isAdmin && !canBypass) {
            toast.error("Acesso restrito a administradores");
            await supabase.auth.signOut();
          } else {
            sessionStorage.setItem("admin_auth", "true");
            toast.success("Autenticado");
            navigate("/admin");
          }
        }
      } else {
        if (user === "admin" && pass === "nimda") {
          sessionStorage.setItem("admin_auth", "true");
          toast.success("Autenticado");
          navigate("/admin");
        } else {
          toast.error("Credenciais inválidas");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <Header cartItemCount={0} onCartClick={() => {}} />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Login do Admin</CardTitle>
          </CardHeader>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Usuário</Label>
                <Input value={user} onChange={(e) => setUser(e.target.value)} />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Sessão expira ao fechar/atualizar a página</p>
                <Button type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Login;