import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user === "admin" && pass === "nimda") {
        sessionStorage.setItem("admin_auth", "true");
        toast.success("Autenticado");
        navigate("/admin");
      } else {
        toast.error("Credenciais inválidas");
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