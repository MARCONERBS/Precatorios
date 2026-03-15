import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { RefreshCw, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  const [escavadorCache, setEscavadorCache] = useState<Record<string, any>>({});
  const [escavadorErrors, setEscavadorErrors] = useState<Record<string, string>>({});

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
          <h1 className="text-2xl font-semibold text-foreground">Precatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
            {syncing ? "Sincronizando..." : `Sincronizar ${currentYear}`}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th
                  className="text-left font-medium text-muted-foreground px-4 py-3 cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("numero")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Número do Precatório <SortIcon field="numero" />
                  </span>
                </th>
                <th
                  className="text-center font-medium text-muted-foreground px-4 py-3 cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("ano")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Ano <SortIcon field="ano" />
                  </span>
                </th>
                <th
                  className="text-right font-medium text-muted-foreground px-4 py-3 cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("valor")}
                >
                  <span className="inline-flex items-center justify-end gap-1.5">
                    Valor <SortIcon field="valor" />
                  </span>
                </th>
                <th
                  className="text-left font-medium text-muted-foreground px-4 py-3 cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("status")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Status <SortIcon field="status" />
                  </span>
                </th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">CPF</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Contato</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Escavador</th>
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
              {precatorios?.map((item) => {
                const cachedDados = (item as any).escavador_dados || escavadorCache[item.id] || null;
                const isExpanded = expandedId === item.id;

                return (
                  <EscavadorTableRow
                    key={item.id}
                    item={item}
                    cachedDados={cachedDados}
                    isExpanded={isExpanded}
                    error={escavadorErrors[item.id] || null}
                    onToggle={(id, dados, error) => {
                      if (dados) {
                        setEscavadorCache((prev) => ({ ...prev, [id]: dados }));
                      }
                      if (error) {
                        setEscavadorErrors((prev) => ({ ...prev, [id]: error }));
                      }
                      setExpandedId(isExpanded ? null : id);
                    }}
                    statusMap={statusMap}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && (!precatorios || precatorios.length === 0) && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum precatório encontrado. Clique em "Sincronizar" para iniciar.
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
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

// Extracted row component to keep table structure clean
import { Loader2, ChevronDown, ChevronUp, Search } from "lucide-react";

function EscavadorTableRow({
  item,
  cachedDados,
  isExpanded,
  error,
  onToggle,
  statusMap,
}: {
  item: any;
  cachedDados: any;
  isExpanded: boolean;
  error: string | null;
  onToggle: (id: string, dados?: any, error?: string) => void;
  statusMap: Record<string, any>;
}) {
  const [loading, setLoading] = useState(false);
  const [localDados, setLocalDados] = useState(cachedDados);
  const [localError, setLocalError] = useState(error);

  const handleConsultar = async () => {
    if (localDados || cachedDados) {
      onToggle(item.id);
      return;
    }

    setLoading(true);
    setLocalError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("consultar-escavador", {
        body: { numero: item.numero, precatorio_id: item.id },
      });

      if (fnError) throw fnError;

      if (data?.success) {
        setLocalDados(data.dados);
        onToggle(item.id, data.dados);
      } else {
        const errMsg = data?.error || "Erro desconhecido";
        setLocalError(errMsg);
        onToggle(item.id, undefined, errMsg);
      }
    } catch (err: any) {
      const msg = err.message || "Falha na consulta";
      setLocalError(msg);
      onToggle(item.id, undefined, msg);
    } finally {
      setLoading(false);
    }
  };

  const dados = localDados || cachedDados;
  const currentError = localError || error;

  return (
    <>
      <tr
        className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
        style={{ height: 44 }}
      >
        <td className="px-4 py-2.5 font-mono text-xs text-foreground">{item.numero}</td>
        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{item.ano}</td>
        <td className="px-4 py-2.5 text-right font-mono text-sm font-medium text-foreground">
          {formatCurrency(Number(item.valor))}
        </td>
        <td className="px-4 py-2.5">
          <StatusBadge status={statusMap[item.status] || "pendente"} />
        </td>
        <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">
          {item.cpf || "—"}
        </td>
        <td className="px-4 py-2.5 text-muted-foreground text-xs">
          {item.telefones?.length || item.emails?.length ? "📞 📧" : "—"}
        </td>
        <td className="px-4 py-2.5">
          <button
            onClick={handleConsultar}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : dados ? (
              isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {loading ? "..." : dados ? (isExpanded ? "Fechar" : "Ver") : "Consultar"}
          </button>
        </td>
      </tr>
      {isExpanded && (dados || currentError) && (
        <tr>
          <td colSpan={7} className="p-0">
            <EscavadorExpandedContent dados={dados} error={currentError} />
          </td>
        </tr>
      )}
    </>
  );
}

function EscavadorExpandedContent({ dados, error }: { dados: any; error: string | null }) {
  if (error) {
    return (
      <div className="px-6 py-4 text-sm text-destructive bg-destructive/5">
        Erro: {error}
      </div>
    );
  }

  if (!dados) return null;

  if (dados.encontrado === false) {
    return (
      <div className="px-6 py-4 text-sm text-muted-foreground bg-muted/30">
        {dados.mensagem || "Nenhum resultado encontrado na web."}
      </div>
    );
  }

  return (
    <div className="px-6 py-4 bg-muted/30 space-y-3 text-sm border-l-4 border-primary/30">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {dados.tribunal && (
          <div>
            <span className="font-medium text-foreground">Tribunal: </span>
            <span className="text-muted-foreground">{dados.tribunal}</span>
          </div>
        )}
        {dados.classe && (
          <div>
            <span className="font-medium text-foreground">Classe: </span>
            <span className="text-muted-foreground">{dados.classe}</span>
          </div>
        )}
        {dados.vara && (
          <div>
            <span className="font-medium text-foreground">Vara: </span>
            <span className="text-muted-foreground">{dados.vara}</span>
          </div>
        )}
      </div>

      {dados.partes?.length > 0 && (
        <div>
          <span className="font-medium text-foreground block mb-1">Partes:</span>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            {dados.partes.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {dados.resumo && (
        <div>
          <span className="font-medium text-foreground block mb-1">Resumo:</span>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-background/50 rounded p-3 max-h-40 overflow-auto">
            {dados.resumo}
          </pre>
        </div>
      )}

      {dados.resultados?.length > 0 && (
        <div>
          <span className="font-medium text-foreground block mb-1">Fontes encontradas:</span>
          <ul className="space-y-2">
            {dados.resultados.slice(0, 5).map((r: any, i: number) => (
              <li key={i} className="border-l-2 border-primary/20 pl-3">
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs font-medium"
                >
                  {r.titulo}
                </a>
                {r.snippet && (
                  <p className="text-xs text-muted-foreground mt-0.5">{r.snippet}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
