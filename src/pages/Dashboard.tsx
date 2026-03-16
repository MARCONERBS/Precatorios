import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, Phone, TrendingUp, History, ListFilter, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  // Optimized fetching: targeted queries for accurate stats even with 31k+ rows
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: async () => {
      // 1. Total count of precatorios (meta-only)
      const { count: totalCount } = await supabase.from("precatorios").select("*", { count: "exact", head: true });
      
      // 2. Specific status counts (meta-only)
      const { count: contactReadyCount } = await supabase.from("precatorios").select("*", { count: "exact", head: true }).eq("status", "contato_pronto");
      const { count: cpfFoundCount } = await supabase.from("precatorios").select("*", { count: "exact", head: true }).in("status", ["cpf_encontrado", "contato_pronto"]);
      
      // 3. Sum of values (Estimated). Fetching just column 'valor' to reduce data transfer.
      const { data: valuesData } = await supabase.from("precatorios").select("valor");
      const totalValue = valuesData?.reduce((sum, p) => sum + Number(p.valor), 0) ?? 0;

      // 4. Status Distribution (Stats for a large sample)
      const { data: recentForDist } = await supabase.from("precatorios").select("status").limit(5000);
      const statusCounts = recentForDist?.reduce((acc: Record<string, number>, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}) ?? {};

      // 5. Recent Activity (Latest arrivals)
      const { data: recentTickets } = await supabase
        .from("precatorios")
        .select("id, created_at, nome_titular, status")
        .order("created_at", { ascending: false })
        .limit(5);

      // 6. Highest Value (Top tickets)
      const { data: highValueTickets } = await supabase
        .from("precatorios")
        .select("id, numero, nome_titular, valor")
        .order("valor", { ascending: false })
        .limit(5);

      return {
        totalCount: totalCount ?? 0,
        contactReady: contactReadyCount ?? 0,
        cpfFound: cpfFoundCount ?? 0,
        totalValue,
        statusCounts,
        recentTickets: recentTickets ?? [],
        highValueTickets: highValueTickets ?? []
      };
    },
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const statCards = [
    { label: "Precatórios Coletados", value: String(dashboardData?.totalCount ?? 0), icon: FileText, color: "text-blue-500" },
    { label: "CPFs Encontrados", value: String(dashboardData?.cpfFound ?? 0), icon: Search, color: "text-amber-500" },
    { label: "Contatos Prontos", value: String(dashboardData?.contactReady ?? 0), icon: Phone, color: "text-green-500" },
    { label: "Valor Estimado", value: formatCurrency(dashboardData?.totalValue ?? 0), icon: TrendingUp, color: "text-emerald-600" },
  ];

  if (isLoading) {
    return <div className="p-6 font-mono font-bold uppercase tracking-widest animate-pulse">Carregando Mogui Dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-foreground underline decoration-orange-500 decoration-4 underline-offset-4">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-2 font-medium">
            Métricas de prospecção do Sistema Mogui.
          </p>
        </div>
        <Button 
          onClick={() => navigate("/precatorios")}
          className="rounded-none border-2 border-primary bg-background text-primary hover:bg-primary hover:text-white font-bold uppercase tracking-widest shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          Ver Todos <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div 
            key={stat.label} 
            className="bg-card border-4 border-border p-6 shadow-[6px_6px_0_0_rgba(17,17,17,0.8)] flex flex-col justify-between overflow-hidden group hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.color} group-hover:scale-110 transition-transform`} strokeWidth={2.5} />
            </div>
            {/* Using smaller/responsive text to prevent overflow for large values */}
            <p className="text-xl md:text-2xl font-black text-foreground font-mono mt-4 leading-tight break-all">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status Distribution */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ListFilter className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-black uppercase tracking-widest">Distribuição</h2>
          </div>
          <div className="bg-card border-4 border-border p-6 shadow-[6px_6px_0_0_rgba(17,17,17,1)] space-y-4">
            {Object.entries(dashboardData?.statusCounts || {}).map(([status, count]) => {
              const totalDist = Object.values(dashboardData?.statusCounts || {}).reduce((a, b) => a + b, 0);
              const percentage = totalDist > 0 ? (count / totalDist) * 100 : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                    <span>{status.replace("_", " ")}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 bg-muted border-2 border-border p-[1px]">
                    <div 
                      className="h-full bg-orange-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Highest Values */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <h2 className="text-sm font-black uppercase tracking-widest">Precatórios de Maior Valor</h2>
          </div>
          <div className="bg-card border-4 border-border overflow-hidden shadow-[6px_6px_0_0_rgba(17,17,17,1)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-4 border-border bg-muted/50">
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest">Número</th>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest">Titular</th>
                  <th className="p-3 text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-border">
                {dashboardData?.highValueTickets.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">{p.numero}</td>
                    <td className="p-3 text-xs font-bold uppercase truncate max-w-[150px]">{p.nome_titular || "Titular Oculto"}</td>
                    <td className="p-3 text-xs font-black text-right text-emerald-600">{formatCurrency(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-black uppercase tracking-widest">Atividade Recente</h2>
        </div>
        <div className="bg-card border-4 border-border overflow-hidden shadow-[8px_8px_0_0_rgba(17,17,17,1)]">
          <div className="grid grid-cols-1 md:grid-cols-5 divide-y-2 md:divide-y-0 md:divide-x-2 divide-border">
            {dashboardData?.recentTickets.map((p) => (
              <div 
                key={p.id} 
                className="p-4 space-y-2 hover:bg-muted/40 transition-colors cursor-pointer" 
                onClick={() => navigate("/precatorios")}
              >
                <div className="text-[10px] font-black uppercase text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </div>
                <div className="text-xs font-bold truncate tracking-tight">{p.nome_titular || "SEM NOME"}</div>
                <div className="inline-block px-2 py-0.5 border border-border bg-background text-[9px] font-black uppercase">
                  {p.status.split("_").join(" ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
