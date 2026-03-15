import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type EscavadorDados = {
  titulo: string | null;
  tribunal: string | null;
  vara: string | null;
  partes: string[];
  movimentacoes: string[];
  data_distribuicao: string | null;
  resumo: string | null;
};

interface EscavadorRowProps {
  precatorioId: string;
  numero: string;
  cachedData: EscavadorDados | null;
}

export function EscavadorRow({ precatorioId, numero, cachedData }: EscavadorRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<EscavadorDados | null>(cachedData);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConsultar = async () => {
    if (dados) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("consultar-escavador", {
        body: { numero, precatorio_id: precatorioId },
      });

      if (fnError) throw fnError;

      if (data?.success) {
        setDados(data.dados);
        setExpanded(true);
      } else {
        setError(data?.error || "Erro desconhecido");
        toast({
          title: "Erro na consulta",
          description: data?.error || "Não foi possível consultar o Escavador",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      const msg = err.message || "Falha na consulta";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <td className="px-4 py-2.5">
        <button
          onClick={handleConsultar}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {dados ? (expanded ? "Fechar" : "Ver dados") : "Consultar"}
        </button>
      </td>
    </>
  );
}

export function EscavadorExpandedContent({ dados, error }: { dados: EscavadorDados | null; error: string | null }) {
  if (error) {
    return (
      <div className="px-6 py-4 text-sm text-destructive bg-destructive/5">
        Erro: {error}
      </div>
    );
  }

  if (!dados) return null;

  const hasContent = dados.titulo || dados.tribunal || dados.partes.length > 0 || dados.movimentacoes.length > 0 || dados.resumo;

  if (!hasContent) {
    return (
      <div className="px-6 py-4 text-sm text-muted-foreground bg-muted/30">
        Nenhum dado encontrado para este processo no Escavador.
      </div>
    );
  }

  return (
    <div className="px-6 py-4 bg-muted/30 space-y-3 text-sm">
      {dados.titulo && (
        <div>
          <span className="font-medium text-foreground">Processo: </span>
          <span className="text-muted-foreground">{dados.titulo}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {dados.tribunal && (
          <div>
            <span className="font-medium text-foreground">Tribunal: </span>
            <span className="text-muted-foreground">{dados.tribunal}</span>
          </div>
        )}
        {dados.vara && (
          <div>
            <span className="font-medium text-foreground">Vara: </span>
            <span className="text-muted-foreground">{dados.vara}</span>
          </div>
        )}
        {dados.data_distribuicao && (
          <div>
            <span className="font-medium text-foreground">Distribuição: </span>
            <span className="text-muted-foreground">{dados.data_distribuicao}</span>
          </div>
        )}
      </div>

      {dados.partes.length > 0 && (
        <div>
          <span className="font-medium text-foreground block mb-1">Partes:</span>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            {dados.partes.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {dados.movimentacoes.length > 0 && (
        <div>
          <span className="font-medium text-foreground block mb-1">Últimas Movimentações:</span>
          <ul className="space-y-1 text-muted-foreground text-xs font-mono">
            {dados.movimentacoes.map((m, i) => (
              <li key={i} className="border-l-2 border-primary/30 pl-3">{m}</li>
            ))}
          </ul>
        </div>
      )}

      {dados.resumo && !dados.titulo && dados.partes.length === 0 && (
        <div>
          <span className="font-medium text-foreground block mb-1">Dados encontrados:</span>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-background/50 rounded p-3 max-h-60 overflow-auto">
            {dados.resumo}
          </pre>
        </div>
      )}
    </div>
  );
}
