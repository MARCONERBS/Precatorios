import { FileText, Search, Phone, TrendingUp } from "lucide-react";

const stats = [
  { label: "Precatórios Coletados", value: "0", icon: FileText, change: null },
  { label: "CPFs Encontrados", value: "0", icon: Search, change: null },
  { label: "Contatos Prontos", value: "0", icon: Phone, change: null },
  { label: "Valor Total", value: "R$ 0,00", icon: TrendingUp, change: null },
];

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral da prospecção de precatórios
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card rounded-lg p-5 shadow-card transition-default hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-2xl font-semibold text-foreground font-mono">
              {stat.value}
            </p>
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
