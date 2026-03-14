import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PrecatorioRow {
  id: string;
  numero: string;
  valor: number;
  nome_titular: string | null;
  kanban_coluna: string;
}

const columns = [
  { id: "novo", title: "Novo Precatório" },
  { id: "cpf_encontrado", title: "CPF Encontrado" },
  { id: "contato_encontrado", title: "Contato Encontrado" },
  { id: "em_contato", title: "Em Contato" },
  { id: "negociacao", title: "Negociação" },
  { id: "fechado", title: "Fechado" },
];

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function KanbanPage() {
  const queryClient = useQueryClient();

  const { data: precatorios } = useQuery({
    queryKey: ["precatorios-kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precatorios")
        .select("id, numero, valor, nome_titular, kanban_coluna")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PrecatorioRow[];
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, coluna }: { id: string; coluna: string }) => {
      const { error } = await supabase
        .from("precatorios")
        .update({ kanban_coluna: coluna })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["precatorios-kanban"] }),
  });

  const getCards = (columnId: string) =>
    precatorios?.filter((p) => p.kanban_coluna === columnId) ?? [];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Kanban</h1>
        <p className="text-sm text-muted-foreground mt-1">Pipeline de prospecção</p>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-h-0 h-full pb-4">
          {columns.map((column) => {
            const cards = getCards(column.id);
            return (
              <div key={column.id} className="flex-shrink-0 w-[300px] flex flex-col bg-accent/50 rounded-lg">
                <div className="px-3 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">{column.title}</h3>
                  <span className="text-xs font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                    {cards.length}
                  </span>
                </div>
                <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="bg-card rounded-lg p-3 shadow-card hover:shadow-card-hover transition-default cursor-pointer"
                    >
                      <p className="font-mono text-xs text-muted-foreground mb-1">{card.numero}</p>
                      <p className="font-mono text-sm font-medium text-foreground">
                        {formatCurrency(Number(card.valor))}
                      </p>
                      {card.nome_titular && (
                        <p className="text-xs text-muted-foreground mt-2">{card.nome_titular}</p>
                      )}
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground">Nenhum card</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
