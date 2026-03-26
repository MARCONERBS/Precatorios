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
    natureza?: string | null;
    natureza_id?: string | null;
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
      // Get current user for auth context if needed by the edge function
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("consultar-escavador", {
        body: { 
          numero: item.numero,
          user_id: user?.id 
        },
      });

      if (error) throw error;

      if (data?.success && data?.dados) {
        const escavadorDados = data.dados;
        const updateData: any = { escavador_dados: escavadorDados };

        // Use pre-identified applicant if available
        if (escavadorDados.cpf_identificado) {
          updateData.cpf = escavadorDados.cpf_identificado;
          updateData.nome_titular = escavadorDados.nome_identificado || null;
        }

        // Include Natureza if found
        if (escavadorDados.natureza) {
          updateData.natureza = escavadorDados.natureza;
          updateData.natureza_id = escavadorDados.natureza_id || null;
        }

        // Search in partes if not found or to supplement
        if (!updateData.cpf && escavadorDados.partes && escavadorDados.partes.length > 0) {
          // Look for candidates that don't look like lawyers or government entities
          const candidates = escavadorDados.partes.filter((p: string) => {
            const low = p.toLowerCase();
            return !low.includes('(advogado)') && 
                   !low.includes('uniao federal') && 
                   !low.includes('fazenda') && 
                   !low.includes('instituto') &&
                   !low.includes('caixa economica') &&
                   !low.includes('ministerio');
          });
          
          if (candidates.length > 0) {
            // Priority to "beneficiario", "autor", "exequente", "requerente"
            const prioritized = candidates.find((p: string) => {
              const low = p.toLowerCase();
              return low.includes('beneficiário') || low.includes('autor') || low.includes('exequente') || low.includes('requerente');
            }) || candidates[0];

            // Extract Name (everything before the first '[' or '(')
            const nameMatch = prioritized.match(/^([^[(]+)/);
            if (nameMatch && !updateData.nome_titular) {
              updateData.nome_titular = nameMatch[1].trim();
            }

            // Extract CPF/CNPJ from [CPF/CNPJ: ...] or standard patterns
            const cpfMatch = prioritized.match(/\[CPF\/CNPJ:\s*([\d.-]+)\]/) || prioritized.match(/(?:\d{3}\.\d{3}\.\d{3}-\d{2})/) || prioritized.match(/CPF:\s*(\d+)/);
            if (cpfMatch && !updateData.cpf) {
              updateData.cpf = cpfMatch[1] || cpfMatch[0];
            }
          }
        }

        // Clean CPF if it has symbols but keep ADV prefix
        if (updateData.cpf) {
          const isAdv = updateData.cpf.startsWith('ADV:');
          const numbers = updateData.cpf.replace(/[^\d]/g, '');
          updateData.cpf = isAdv ? `ADV: ${numbers}` : numbers;
          updateData.status = "cpf_encontrado"; // Update status if we found data

          // Plan C: Move to Kanban Column "CPF Encontrado" if it exists in the same board
          if (item.id) {
            // Get current board ID first
            const { data: precat } = await supabase.from("precatorios").select("kanban_board_id").eq("id", item.id).single();
            if (precat?.kanban_board_id) {
              const { data: cols } = await supabase.from("kanban_columns")
                .select("id")
                .eq("board_id", precat.kanban_board_id)
                .ilike("title", "%CPF Encontrado%")
                .single();
              
              if (cols?.id) {
                updateData.kanban_column_id = cols.id;
              }
            }
          }
        }

        await supabase.from("precatorios").update(updateData).eq("id", item.id);
        await queryClient.invalidateQueries({ queryKey: ["precatorios"] });
        await queryClient.invalidateQueries({ queryKey: ["precatorios-kanban"] }); // Also refresh Kanban
        onToggle(item.id);
        
        if (updateData.nome_titular) {
          toast({ title: "Dados atualizados", description: `Titular identificado: ${updateData.nome_titular}` });
        }
      } else if (data?.status === 'processando') {
        toast({ 
          title: "Consulta em andamento", 
          description: data.mensagem || "O Escavador está buscando os dados. Tente novamente em 1 minuto.",
        });
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

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  let displayValue = value;
  if (typeof value === 'object') {
    displayValue = value?.nome || value?.descricao || null;
  }
  
  // Final safety: if it's still an object, try to get a name or stringify
  if (typeof displayValue === 'object') {
    displayValue = displayValue?.nome || displayValue?.descricao || JSON.stringify(displayValue);
  }

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-none bg-background border-2 border-border shadow-[2px_2px_0_0_rgba(17,17,17,1)]">
      <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-none border-2 border-primary bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2.5} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground mt-0.5 leading-snug">{displayValue || '-'}</p>
      </div>
    </div>
  );
}

export function EscavadorExpandedContent({ item }: { item: { natureza?: string | null; escavador_dados: any } }) {
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
        {/* Status and Identity Highlight */}
        {(dados.nome_identificado || dados.cpf_identificado) && (
          <div className="p-4 bg-green-500/10 border-2 border-green-500/30 shadow-[4px_4px_0_0_rgba(34,197,94,0.2)]">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-xs font-bold text-green-700 uppercase tracking-widest">Titular Identificado</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-medium text-green-600/70 uppercase">Nome</p>
                <p className="text-sm font-bold text-green-900">{dados.nome_identificado || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-green-600/70 uppercase">CPF/CNPJ Identificado</p>
                <p className="text-sm font-bold text-green-900 font-mono">{dados.cpf_identificado || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info cards grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <InfoCard icon={Building2} label="Tribunal" value={dados.tribunal} />
          <InfoCard icon={Gavel} label="Órgão Julgador" value={dados.orgao_julgador} />
          <InfoCard icon={Scale} label="Classe" value={dados.classe} />
          <InfoCard icon={Scale} label="Natureza" value={item.natureza || dados.natureza} />
          <InfoCard icon={Calendar} label="Data" value={dados.data_publicacao} />
          <InfoCard icon={Scale} label="Assunto" value={dados.assunto} />
          {dados.area && <InfoCard icon={Scale} label="Área" value={dados.area} />}
          {dados.valor_causa && <InfoCard icon={Scale} label="Valor da Causa" value={dados.valor_causa} />}
        </div>

        {/* Magistrados */}
        {dados.magistrados && dados.magistrados.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Gavel className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Magistrados / Juízes</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {dados.magistrados.map((m: string, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-600 border-2 border-amber-200 shadow-[2px_2px_0_0_rgba(17,17,17,1)]"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

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
