import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { RefreshCw, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EscavadorCell, EscavadorExpandedContent } from "@/components/EscavadorExpandedRow";

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

type SortField = "numero" | "valor" | "ano" | "status" | "created_at";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export default function Precatorios() {
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["precatorios", page, sortField, sortDir],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("precatorios")
        .select("*", { count: "exact" })
        .order(sortField, { ascending: sortDir === "asc" })
        .range(from, to);

      if (error) throw error;
      return { items: data, total: count ?? 0 };
    },
  });

  const precatorios = data?.items;
  const totalCount = data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

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
        setPage(0);
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

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 3) pages.push("...");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 4) pages.push("...");
      pages.push(totalPages - 1);
    }
    return pages;
  };

  return (
    <div className="p-6 space-y-4">
      {syncing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-primary/20">
          <div className="h-full bg-primary animate-pulse-subtle" style={{ width: "100%" }} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground">Precatórios</h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            {totalCount > 0 ? `${totalCount.toLocaleString("pt-BR")} precatórios` : `Precatórios Federais de ${currentYear}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Exportar
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} strokeWidth={1.5} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-none border-2 border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/20">
                <th
                  className="text-left font-bold text-foreground px-4 py-3 cursor-pointer select-none hover:bg-accent/50 transition-colors uppercase tracking-widest text-[11px]"
                  onClick={() => toggleSort("numero")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Número do Precatório <SortIcon field="numero" />
                  </span>
                </th>
                <th
                  className="text-center font-bold text-foreground px-4 py-3 cursor-pointer select-none hover:bg-accent/50 transition-colors uppercase tracking-widest text-[11px]"
                  onClick={() => toggleSort("ano")}
                >
                  <span className="inline-flex items-center justify-center gap-1.5 w-full">
                    Ano <SortIcon field="ano" />
                  </span>
                </th>
                <th
                  className="text-right font-bold text-foreground px-4 py-3 cursor-pointer select-none hover:bg-accent/50 transition-colors uppercase tracking-widest text-[11px]"
                  onClick={() => toggleSort("valor")}
                >
                  <span className="inline-flex items-center justify-end gap-1.5">
                    Valor <SortIcon field="valor" />
                  </span>
                </th>
                <th
                  className="text-left font-bold text-foreground px-4 py-3 cursor-pointer select-none hover:bg-accent/50 transition-colors uppercase tracking-widest text-[11px]"
                  onClick={() => toggleSort("status")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Status <SortIcon field="status" />
                  </span>
                </th>
                <th className="text-left font-bold text-foreground px-4 py-3 uppercase tracking-widest text-[11px]">CPF</th>
                <th className="text-left font-bold text-foreground px-4 py-3 uppercase tracking-widest text-[11px]">Contato</th>
                <th className="text-left font-bold text-foreground px-4 py-3 uppercase tracking-widest text-[11px]">Escavador</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border" style={{ height: 44 }}>
                    <td className="px-4 py-2.5"><div className="h-4 w-48 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-12 bg-muted rounded animate-pulse mx-auto" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-28 bg-muted rounded animate-pulse ml-auto" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-20 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-12 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-16 bg-muted rounded animate-pulse" /></td>
                  </tr>
                ))}
              {precatorios?.map((item) => (
                <React.Fragment key={item.id}>
                  <tr
                    className="border-b-2 border-border last:border-0 hover:bg-muted/30 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground font-medium">{item.numero}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs text-muted-foreground">{item.ano}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-foreground">
                      {formatCurrency(Number(item.valor))}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={statusMap[item.status] || "pendente"} />
                    </td>
                    <td className="px-4 py-2.5 text-foreground text-xs font-mono font-medium">
                      {item.cpf || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-foreground text-xs font-mono font-medium">
                      {item.telefones?.length || item.emails?.length ? "📞 📧" : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <EscavadorCell
                        item={item}
                        isExpanded={expandedId === item.id}
                        onToggle={toggleExpanded}
                      />
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr className="bg-muted/30">
                      <EscavadorExpandedContent item={item} />
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && (!precatorios || precatorios.length === 0) && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum precatório encontrado. Clique em "Sincronizar" para iniciar.
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t-2 border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-mono text-muted-foreground">
              Mostrando {(page * PAGE_SIZE + 1).toLocaleString("pt-BR")}–{Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString("pt-BR")} de {totalCount.toLocaleString("pt-BR")}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              {getPageNumbers().map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p + 1}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
