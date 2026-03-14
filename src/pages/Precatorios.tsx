import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { RefreshCw, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type StatusType = "pendente" | "buscando" | "encontrado" | "erro" | "contato_pronto";

const statusMap: Record<string, StatusType> = {
  pendente: "pendente",
  buscando_cpf: "buscando",
  cpf_encontrado: "encontrado",
  buscando_contato: "buscando",
  contato_pronto: "contato_pronto",
  erro: "erro",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Precatorios() {
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: precatorios, isLoading } = useQuery({
    queryKey: ["precatorios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precatorios")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-trf1", {
        body: { ano: currentYear },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Sincronização concluída",
          description: `${data.inseridos} precatórios importados, ${data.ja_existentes} já existentes. Total encontrado: ${data.total_encontrados}.`,
        });
        queryClient.invalidateQueries({ queryKey: ["precatorios"] });
        queryClient.invalidateQueries({ queryKey: ["precatorios-stats"] });
        queryClient.invalidateQueries({ queryKey: ["precatorios-kanban"] });
      } else {
        toast({
          title: "Erro na sincronização",
          description: data?.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro na sincronização",
        description: err.message || "Falha ao conectar com o TRF1",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Progress bar */}
      {syncing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-primary/20">
          <div className="h-full bg-primary animate-pulse-subtle" style={{ width: "100%" }} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Precatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Precatórios Federais de {currentYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Exportar
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} strokeWidth={1.5} />
            {syncing ? "Sincronizando..." : `Sincronizar ${currentYear}`}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Número do Precatório</th>
                <th className="text-right font-medium text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">CPF</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Contato</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border" style={{ height: 48 }}>
                    <td className="px-4 py-3"><div className="h-4 w-48 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 bg-muted rounded animate-pulse ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 bg-muted rounded animate-pulse" /></td>
                  </tr>
                ))}
              {precatorios?.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-accent/50 transition-default"
                  style={{ height: 48 }}
                >
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{item.numero}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-medium text-foreground">
                    {formatCurrency(Number(item.valor))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={statusMap[item.status] || "pendente"} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                    {item.cpf || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {item.telefones?.length || item.emails?.length ? "📞 📧" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && (!precatorios || precatorios.length === 0) && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum precatório encontrado. Clique em "Sincronizar" para iniciar.
          </div>
        )}
      </div>

      {precatorios && precatorios.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {precatorios.length} precatórios encontrados
        </p>
      )}
    </div>
  );
}
