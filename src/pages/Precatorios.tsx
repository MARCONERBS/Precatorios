import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { RefreshCw, Download } from "lucide-react";

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

  return (
    <div className="p-6 space-y-6">
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
          <Button size="sm" className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            Sincronizar {currentYear}
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
    </div>
  );
}
