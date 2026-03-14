import { useState } from "react";
import { cn } from "@/lib/utils";

interface KanbanCard {
  id: string;
  numero: string;
  valor: string;
  nome?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

const initialColumns: KanbanColumn[] = [
  {
    id: "novo",
    title: "Novo Precatório",
    cards: [
      { id: "1", numero: "0004521-88.2024", valor: "R$ 1.240.500,00" },
      { id: "2", numero: "0005432-21.2024", valor: "R$ 678.900,00" },
    ],
  },
  {
    id: "cpf",
    title: "CPF Encontrado",
    cards: [
      { id: "3", numero: "0003187-12.2024", valor: "R$ 892.300,00", nome: "João S." },
    ],
  },
  {
    id: "contato",
    title: "Contato Encontrado",
    cards: [
      { id: "4", numero: "0007654-33.2024", valor: "R$ 345.000,00", nome: "Maria L." },
    ],
  },
  {
    id: "em_contato",
    title: "Em Contato",
    cards: [],
  },
  {
    id: "negociacao",
    title: "Negociação",
    cards: [],
  },
  {
    id: "fechado",
    title: "Fechado",
    cards: [],
  },
];

function formatTotal(cards: KanbanCard[]) {
  return cards.length;
}

export default function KanbanPage() {
  const [columns] = useState<KanbanColumn[]>(initialColumns);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Kanban</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pipeline de prospecção
        </p>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-h-0 h-full pb-4">
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-[300px] flex flex-col bg-accent/50 rounded-lg"
            >
              <div className="px-3 py-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">{column.title}</h3>
                <span className="text-xs font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                  {formatTotal(column.cards)}
                </span>
              </div>
              <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto">
                {column.cards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-card rounded-lg p-3 shadow-card hover:shadow-card-hover transition-default cursor-pointer"
                  >
                    <p className="font-mono text-xs text-muted-foreground mb-1">
                      {card.numero}
                    </p>
                    <p className="font-mono text-sm font-medium text-foreground">
                      {card.valor}
                    </p>
                    {card.nome && (
                      <p className="text-xs text-muted-foreground mt-2">{card.nome}</p>
                    )}
                  </div>
                ))}
                {column.cards.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Nenhum card
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
