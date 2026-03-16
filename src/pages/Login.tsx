import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, ArrowRight, Loader2, UserPlus, LogIn } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: "Conta criada! 🎉",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left panel — branding ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1A2340 0%, #0F1629 60%, #1a1040 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full opacity-10"
          style={{ background: "#FF6B35" }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-10"
          style={{ background: "#FF6B35" }} />
        <div className="absolute top-1/3 left-[-40px] w-32 h-32 rounded-full opacity-5"
          style={{ background: "#ffffff" }} />

        {/* Logo + tagline */}
        <div className="relative z-10 text-center px-12">
          {/* CSS wordmark logo */}
          <div className="mb-8 flex items-center justify-center">
            <span
              className="text-6xl font-black tracking-tighter select-none"
              style={{ color: "#FF6B35", fontFamily: "'Arial Black', Impact, sans-serif", letterSpacing: "-2px" }}
            >
              mogui
            </span>
            <span
              className="w-3 h-3 rounded-full ml-1 mb-1 self-end"
              style={{ background: "#FF6B35", opacity: 0.6 }}
            />
          </div>
          <h2 className="text-white text-3xl font-black uppercase tracking-tight mb-3">
            Bem-vindo de Volta!
          </h2>
          <p className="text-white/60 text-base leading-relaxed max-w-xs mx-auto">
            Gerencie seus precatórios, leads e comunicações em um só lugar.
          </p>

          {/* Feature pills */}
          <div className="flex flex-col gap-3 mt-10">
            {[
              { icon: "📋", text: "Gestão de Precatórios" },
              { icon: "💬", text: "Chat WhatsApp Integrado" },
              { icon: "📊", text: "Kanban de Leads" },
            ].map((f) => (
              <div
                key={f.text}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-white text-sm font-medium"
              >
                <span className="text-xl">{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile — CSS wordmark */}
        <div className="lg:hidden mb-10 text-center">
          <div className="flex items-center justify-center">
            <span
              className="text-5xl font-black tracking-tighter select-none"
              style={{ color: "#FF6B35", fontFamily: "'Arial Black', Impact, sans-serif", letterSpacing: "-2px" }}
            >
              mogui
            </span>
            <span className="w-2.5 h-2.5 rounded-full ml-1 mb-0.5 self-end" style={{ background: "#FF6B35", opacity: 0.6 }} />
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
              {isSignUp ? <UserPlus className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
              {isSignUp ? "Novo Usuário" : "Acesso ao Sistema"}
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">
              {isSignUp ? "Criar Conta" : "Entrar"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isSignUp
                ? "Preencha os dados para criar seu acesso."
                : "Digite suas credenciais para acessar."}
            </p>
          </div>

          {/* Form card */}
          <div className="bg-card border-4 border-border shadow-[6px_6px_0_0_rgba(17,17,17,0.8)] p-6 rounded-none">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="pl-10 h-12 rounded-none border-2 focus-visible:ring-0 focus-visible:border-orange-500 font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="pl-10 h-12 rounded-none border-2 focus-visible:ring-0 focus-visible:border-orange-500 font-medium"
                  />
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-none border-2 border-orange-600 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest shadow-[4px_4px_0_0_rgba(194,65,12,0.7)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</>
                ) : isSignUp ? (
                  <><UserPlus className="w-4 h-4" /> Criar Conta</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Entrar</>
                )}
              </Button>
            </form>
          </div>

          {/* Toggle sign in / sign up */}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-5 transition-colors font-medium"
          >
            {isSignUp
              ? "Já tem uma conta? "
              : "Ainda não tem conta? "}
            <span className="font-black text-orange-500 underline underline-offset-2">
              {isSignUp ? "Entrar" : "Criar agora"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
