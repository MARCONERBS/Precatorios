import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, Phone, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { data: precatorios } = useQuery({
    queryKey: ["precatorios-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("precatorios").select("*");
      if (error) throw error;
      return data;
    },
  });

  const total = precatorios?.length ?? 0;
  const cpfFound = precatorios?.filter((p) => p.status === "cpf_encontrado" || p.status === "contato_pronto").length ?? 0;
  const contactReady = precatorios?.filter((p) => p.status === "contato_pronto").length ?? 0;
  const totalValue = precatorios?.reduce((sum, p) => sum + Number(p.valor), 0) ?? 0;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const stats = [
    { label: "Precatórios Coletados", value: String(total), icon: FileText },
    { label: "CPFs Encontrados", value: String(cpfFound), icon: Search },
    { label: "Contatos Prontos", value: String(contactReady), icon: Phone },
    { label: "Valor Total", value: formatCurrency(totalValue), icon: TrendingUp },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da prospecção de precatórios</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-lg p-5 shadow-card transition-default hover:shadow-card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-2xl font-semibold text-foreground font-mono">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg shadow-card p-6">
        <h2 className="text-base font-medium text-foreground mb-4">Status do Sistema</h2>
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            TRF1 Sync Status: <span className="font-medium text-foreground">Idle</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Configure suas credenciais de API em Configurações para iniciar a coleta automática.
        </p>
      </div>
    </div>
  );
}
