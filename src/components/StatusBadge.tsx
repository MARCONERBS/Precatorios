import { cn } from "@/lib/utils";

type StatusType = "pendente" | "buscando" | "encontrado" | "erro" | "contato_pronto";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  buscando: { label: "Buscando CPF", className: "bg-primary/10 text-primary" },
  encontrado: { label: "CPF Encontrado", className: "bg-status-success/10 text-status-success" },
  erro: { label: "Erro", className: "bg-destructive/10 text-destructive" },
  contato_pronto: { label: "Contatos Prontos", className: "bg-status-success/10 text-status-success" },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-none border-2 border-border shadow-[2px_2px_0_0_rgba(17,17,17,1)] text-[10px] font-bold uppercase tracking-widest",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
