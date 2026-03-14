import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { RefreshCw, Download } from "lucide-react";

const mockData = [
  { numero: "0004521-88.2024.4.01.0000", valor: 1240500, status: "pendente" as const },
  { numero: "0003187-12.2024.4.01.0000", valor: 892300, status: "encontrado" as const },
  { numero: "0007654-33.2024.4.01.0000", valor: 345000, status: "contato_pronto" as const },
  { numero: "0001298-77.2024.4.01.0000", valor: 2150000, status: "buscando" as const },
  { numero: "0005432-21.2024.4.01.0000", valor: 678900, status: "pendente" as const },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100 * 100);
}

export default function Precatorios() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Precatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Precatórios Federais de {currentYear}
          </p>
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
                <th className="text-left font-medium text-muted-foreground px-4 py-3">
                  Número do Precatório
                </th>
                <th className="text-right font-medium text-muted-foreground px-4 py-3">
                  Valor
                </th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">
                  Status
                </th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">
                  CPF
                </th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">
                  Contato
                </th>
              </tr>
            </thead>
            <tbody>
              {mockData.map((item) => (
                <tr
                  key={item.numero}
                  className="border-b border-border last:border-0 hover:bg-accent/50 transition-default"
                  style={{ height: 48 }}
                >
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {item.numero}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-medium text-foreground">
                    {formatCurrency(item.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {item.status === "encontrado" || item.status === "contato_pronto"
                      ? "•••.•••.•••-••"
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {item.status === "contato_pronto" ? "📞 📧" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mockData.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum precatório encontrado. Clique em "Sincronizar" para iniciar.
          </div>
        )}
      </div>
    </div>
  );
}
