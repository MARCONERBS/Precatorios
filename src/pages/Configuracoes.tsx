import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Configuracoes() {
  const { toast } = useToast();
  const [escavadorKey, setEscavadorKey] = useState("");
  const [escavadorEndpoint, setEscavadorEndpoint] = useState("https://api.escavador.com/api/v2");
  const [alertakiUser, setAlertakiUser] = useState("");
  const [alertakiPassword, setAlertakiPassword] = useState("");

  const handleSave = () => {
    toast({
      title: "Configurações salvas",
      description: "As credenciais foram atualizadas com sucesso.",
    });
  };

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as credenciais das APIs externas
        </p>
      </div>

      {/* Escavador */}
      <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
        <h2 className="text-base font-medium text-foreground">Escavador</h2>
        <p className="text-sm text-muted-foreground">
          Configure a API Key do Escavador para busca de CPFs.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="escavador-key" className="text-sm">API Key</Label>
            <Input
              id="escavador-key"
              type="password"
              value={escavadorKey}
              onChange={(e) => setEscavadorKey(e.target.value)}
              placeholder="Insira sua API Key"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="escavador-endpoint" className="text-sm">Endpoint</Label>
            <Input
              id="escavador-endpoint"
              value={escavadorEndpoint}
              onChange={(e) => setEscavadorEndpoint(e.target.value)}
              className="h-9 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Alertaki */}
      <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
        <h2 className="text-base font-medium text-foreground">Alertaki</h2>
        <p className="text-sm text-muted-foreground">
          Configure as credenciais do Alertaki para busca de contatos.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="alertaki-user" className="text-sm">Usuário</Label>
            <Input
              id="alertaki-user"
              value={alertakiUser}
              onChange={(e) => setAlertakiUser(e.target.value)}
              placeholder="Insira seu usuário"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alertaki-pass" className="text-sm">Senha</Label>
            <Input
              id="alertaki-pass"
              type="password"
              value={alertakiPassword}
              onChange={(e) => setAlertakiPassword(e.target.value)}
              placeholder="Insira sua senha"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} className="px-6">
        Salvar Configurações
      </Button>
    </div>
  );
}
