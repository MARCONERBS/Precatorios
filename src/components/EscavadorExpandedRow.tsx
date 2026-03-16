import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ChevronDown, ChevronUp, ExternalLink, Scale, Building2, Gavel, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface EscavadorProps {
  item: {
    id: string;
    numero: string;
    escavador_dados: any;
  };
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

export function EscavadorCell({ item, isExpanded, onToggle }: EscavadorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const dados = item.escavador_dados as any;
  const hasData = dados && dados.encontrado !== false;

  const handleConsultar = async () => {
    if (hasData) {
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
        await supabase.from("precatorios").update({ escavador_dados: data.dados }).eq("id", item.id);
        await queryClient.invalidateQueries({ queryKey: ["precatorios"] });
        onToggle(item.id);
      } else if (data?.encontrado === false) {
        await supabase.from("precatorios").update({ escavador_dados: { encontrado: false } }).eq("id", item.id);
        await queryClient.invalidateQueries({ queryKey: ["precatorios"] });
        toast({ title: "Nenhum resultado", description: "Nenhum dado encontrado no Escavador." });
        onToggle(item.id);
      } else {
        toast({ title: "Erro", description: data?.error || "Erro ao consultar", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro na consulta", description: err.message || "Falha ao consultar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleConsultar} disabled={loading}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
      {hasData ? (isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : "Consultar"}
    </Button>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-none bg-background border-2 border-border shadow-[2px_2px_0_0_rgba(17,17,17,1)]">
      <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-none border-2 border-primary bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2.5} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground mt-0.5 leading-snug">{value}</p>
      </div>
    </div>
  );
}

export function EscavadorExpandedContent({ item }: { item: { escavador_dados: any } }) {
  const dados = item.escavador_dados as any;
  if (!dados || dados.encontrado === false) {
    return (
      <td colSpan={7} className="px-6 py-6 text-center text-muted-foreground text-sm">
        Nenhum resultado encontrado no Escavador.
      </td>
    );
  }

  // Filter out noisy partes
  const cleanPartes = (dados.partes || []).filter((p: string) => {
    const lower = p.toLowerCase();
    return p.length > 2
      && !lower.includes('monitorar')
      && !lower.includes('solicitar')
      && !lower.includes('polo ativo')
      && !lower.includes('polo passivo')
      && !p.startsWith('—');
  });

  // Clean resumo - remove noisy lines
  const cleanResumo = dados.resumo
    ? dados.resumo
        .split('\n')
        .filter((line: string) => {
          const l = line.trim().toLowerCase();
          return l.length > 3
            && !l.includes('sem internet')
            && !l.includes('verifique seu sinal')
            && !l.includes('processo ativo')
            && !l.includes('compartilhar')
            && !l.includes('exibir número')
            && !l.includes('valor da causa')
            && !l.includes('indisponível')
            && !l.includes('última verificação')
            && !l.startsWith('016') // process number
            && !l.startsWith('monitorar');
        })
        .join('\n')
        .trim()
    : null;

  return (
    <td colSpan={7} className="p-0">
      <div className="px-6 py-5 space-y-4 bg-muted/20 border-t border-border/40">
        {/* Info cards grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {dados.tribunal && (
            <InfoCard icon={Building2} label="Tribunal" value={dados.tribunal} />
          )}
          {dados.orgao_julgador && (
            <InfoCard icon={Gavel} label="Órgão Julgador" value={dados.orgao_julgador} />
          )}
          {dados.assunto && (
            <InfoCard icon={Scale} label="Assunto" value={dados.assunto} />
          )}
          {dados.data_publicacao && (
            <InfoCard icon={Calendar} label="Data" value={dados.data_publicacao} />
          )}
          {dados.classe && (
            <InfoCard icon={Scale} label="Classe" value={dados.classe} />
          )}
        </div>

        {/* Partes */}
        {cleanPartes.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Partes Envolvidas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {cleanPartes.map((p: string, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border-2 border-border shadow-[2px_2px_0_0_rgba(17,17,17,1)]"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Resumo */}
        {cleanResumo && (
          <div className="rounded-none bg-background border-2 border-border shadow-card p-4">
            <p className="text-[11px] font-bold text-foreground uppercase tracking-widest mb-2 border-b-2 border-border pb-1">Resumo</p>
            <p className="text-sm font-mono text-foreground leading-relaxed whitespace-pre-line max-w-3xl">
              {cleanResumo}
            </p>
          </div>
        )}

        {/* Fonte link */}
        {dados.fontes?.length > 0 && (
          <div className="flex items-center gap-3 pt-1">
            {dados.fontes.map((f: { url: string; titulo: string }, i: number) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {f.titulo?.substring(0, 50) || "Ver no Escavador"}
              </a>
            ))}
          </div>
        )}
      </div>
    </td>
  );
}
