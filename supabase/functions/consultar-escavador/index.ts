import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Chave pública do Datajud/CNJ
const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numero, precatorio_id } = await req.json();

    if (!numero) {
      return new Response(
        JSON.stringify({ success: false, error: "Número do processo é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove formatting from the process number (keep only digits)
    const numeroLimpo = numero.replace(/[^0-9]/g, "");

    console.log("Consultando Datajud/CNJ para:", numeroLimpo);

    // Query Datajud API - TRF1 endpoint (Elasticsearch)
    const datajudUrl = "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search";

    const response = await fetch(datajudUrl, {
      method: "POST",
      headers: {
        "Authorization": `ApiKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          match: {
            numeroProcesso: numeroLimpo,
          },
        },
        size: 1,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Datajud returned status:", response.status, responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Datajud retornou status ${response.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(responseText);
    console.log("Datajud response hits:", result.hits?.total?.value);

    const hits = result.hits?.hits || [];

    if (hits.length === 0) {
      const dados = {
        encontrado: false,
        mensagem: "Processo não encontrado na base do Datajud/CNJ",
      };

      return new Response(
        JSON.stringify({ success: true, dados }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processo = hits[0]._source;

    // Extract structured data
    const dados: Record<string, unknown> = {
      encontrado: true,
      numero_processo: processo.numeroProcesso,
      tribunal: processo.tribunal,
      grau: processo.grau,
      classe: processo.classe?.nome,
      classe_codigo: processo.classe?.codigo,
      sistema: processo.sistema?.nome,
      formato: processo.formato?.nome,
      orgao_julgador: processo.orgaoJulgador?.nome,
      orgao_julgador_codigo: processo.orgaoJulgador?.codigo,
      data_ajuizamento: processo.dataAjuizamento,
      data_ultima_atualizacao: processo.dataHoraUltimaAtualizacao,
      nivel_sigilo: processo.nivelSigilo,
      assuntos: (processo.assuntos || []).map((a: any) => a.nome),
      movimentacoes: (processo.movimentos || []).slice(0, 15).map((m: any) => ({
        data: m.dataHora,
        nome: m.nome,
        complementos: (m.complementosTabelados || []).map((c: any) => `${c.nome}: ${c.valor}`),
      })),
    };

    // Save to database if we have a precatorio_id
    if (precatorio_id) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        await supabase
          .from("precatorios")
          .update({ escavador_dados: dados })
          .eq("id", precatorio_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, dados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
