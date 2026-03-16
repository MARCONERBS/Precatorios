import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function Configuracoes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["api-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_configurations")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [escavadorKey, setEscavadorKey] = useState("");
  const [escavadorEndpoint, setEscavadorEndpoint] = useState("https://api.escavador.com/api/v2");
  const [alertakiUser, setAlertakiUser] = useState("");
  const [alertakiPassword, setAlertakiPassword] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  useEffect(() => {
    if (config) {
      setEscavadorKey(config.escavador_api_key ?? "");
      setEscavadorEndpoint(config.escavador_endpoint ?? "https://api.escavador.com/api/v2");
      setAlertakiUser(config.alertaki_usuario ?? "");
      setAlertakiPassword(config.alertaki_senha ?? "");
      setOpenaiKey(config.openai_api_key ?? "");
      setGeminiKey(config.gemini_api_key ?? "");
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        user_id: user.id,
        escavador_api_key: escavadorKey || null,
        escavador_endpoint: escavadorEndpoint || null,
        alertaki_usuario: alertakiUser || null,
        alertaki_senha: alertakiPassword || null,
        openai_api_key: openaiKey || null,
        gemini_api_key: geminiKey || null,
      };

      const { error } = await supabase
        .from("api_configurations")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-config"] });
      toast({ title: "Configurações salvas", description: "As credenciais foram atualizadas com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie as credenciais das APIs externas</p>
      </div>

      <div className="bg-card rounded-lg shadow-card p-6 space-y-6">
        <h2 className="text-lg font-bold text-foreground">Escavador</h2>
        <p className="text-base text-muted-foreground">Configure a API Key do Escavador para busca de CPFs.</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="escavador-key" className="text-base font-semibold">API Key</Label>
            <Input id="escavador-key" type="password" value={escavadorKey} onChange={(e) => setEscavadorKey(e.target.value)} placeholder="Insira sua API Key" className="h-11 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="escavador-endpoint" className="text-base font-semibold">Endpoint</Label>
            <Input id="escavador-endpoint" value={escavadorEndpoint} onChange={(e) => setEscavadorEndpoint(e.target.value)} className="h-11 text-base font-mono" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-card p-6 space-y-6">
        <h2 className="text-lg font-bold text-foreground">Alertaki</h2>
        <p className="text-base text-muted-foreground">Configure as credenciais do Alertaki para busca de contatos.</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alertaki-user" className="text-base font-semibold">Usuário</Label>
            <Input id="alertaki-user" value={alertakiUser} onChange={(e) => setAlertakiUser(e.target.value)} placeholder="Insira seu usuário" className="h-11 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alertaki-pass" className="text-base font-semibold">Senha</Label>
            <Input id="alertaki-pass" type="password" value={alertakiPassword} onChange={(e) => setAlertakiPassword(e.target.value)} placeholder="Insira sua senha" className="h-11 text-base" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-card p-6 space-y-6">
        <h2 className="text-lg font-bold text-foreground">Inteligência Artificial</h2>
        <p className="text-base text-muted-foreground">Configure as chaves de API para geração de scripts e automações.</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-key" className="text-base font-semibold">OpenAI API Key</Label>
            <Input id="openai-key" type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." className="h-11 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gemini-key" className="text-base font-semibold">Google Gemini API Key</Label>
            <Input id="gemini-key" type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza..." className="h-11 text-base" />
          </div>
        </div>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="px-8 h-12 text-base font-bold">
        {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}
