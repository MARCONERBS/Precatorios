import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EscavadorExpandedRowProps {
  item: {
    id: string;
    numero: string;
    escavador_dados: any;
  };
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

export function EscavadorExpandedRow({ item, isExpanded, onToggle }: EscavadorExpandedRowProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [localDados, setLocalDados] = useState<any>(null);

  const cachedDados = item.escavador_dados as any;

  const handleConsultar = async () => {
    const existingDados = localDados || cachedDados;
    if (existingDados && existingDados.encontrado !== false) {
      onToggle(item.id);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("consultar-escavador", {
        body: { numero: item.numero },
      });

      if (error) throw error;

      if (data?.success && data?.dados) {
        setLocalDados(data.dados);

        await supabase
          .from("precatorios")
          .update({ escavador_dados: data.dados })
          .eq("id", item.id);

        onToggle(item.id);
      } else if (data?.encontrado === false) {
        setLocalDados({ encontrado: false });
        toast({
          title: "Nenhum resultado",
          description: "Nenhum dado encontrado no Escavador para este precatório.",
        });
        onToggle(item.id);
      } else {
        toast({
          title: "Erro",
          description: data?.error || "Erro ao consultar",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro na consulta",
        description: err.message || "Falha ao consultar Escavador",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const dados = localDados || cachedDados;
  const hasData = dados && dados.encontrado !== false;

  return (
    <>
      <td className="px-4 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleConsultar}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
          {hasData ? (
            isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          ) : (
            "Consultar"
          )}
        </Button>
      </td>
      {isExpanded && hasData && (
        <tr className="bg-muted/30">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {dados.tribunal && (
                <div>
                  <span className="text-muted-foreground font-medium">Tribunal</span>
                  <p className="text-foreground mt-0.5">{dados.tribunal}</p>
                </div>
              )}
              {dados.orgao_julgador && (
                <div>
                  <span className="text-muted-foreground font-medium">Órgão Julgador</span>
                  <p className="text-foreground mt-0.5">{dados.orgao_julgador}</p>
                </div>
              )}
              {dados.classe && (
                <div>
                  <span className="text-muted-foreground font-medium">Classe</span>
                  <p className="text-foreground mt-0.5">{dados.classe}</p>
                </div>
              )}
              {dados.assunto && (
                <div>
                  <span className="text-muted-foreground font-medium">Assunto</span>
                  <p className="text-foreground mt-0.5">{dados.assunto}</p>
                </div>
              )}
            </div>

            {dados.partes?.length > 0 && (
              <div className="mt-3">
                <span className="text-muted-foreground font-medium text-xs">Partes</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {dados.partes.map((p: string, i: number) => (
                    <span key={i} className="bg-accent text-accent-foreground px-2 py-0.5 rounded text-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {dados.resumo && (
              <div className="mt-3">
                <span className="text-muted-foreground font-medium text-xs">Resumo</span>
                <p className="text-foreground text-xs mt-0.5 whitespace-pre-line leading-relaxed max-w-3xl">
                  {dados.resumo}
                </p>
              </div>
            )}

            {dados.fontes?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {dados.fontes.map((f: { url: string; titulo: string }, i: number) => (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {f.titulo?.substring(0, 50) || "Fonte"}
                  </a>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
      {isExpanded && !hasData && dados?.encontrado === false && (
        <tr className="bg-muted/30">
          <td colSpan={7} className="px-6 py-4 text-center text-muted-foreground text-xs">
            Nenhum resultado encontrado no Escavador.
          </td>
        </tr>
      )}
    </>
  );
}
