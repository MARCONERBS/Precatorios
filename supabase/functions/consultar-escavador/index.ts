import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractProcessData(html: string) {
  const data: {
    titulo: string | null;
    tribunal: string | null;
    vara: string | null;
    partes: string[];
    movimentacoes: string[];
    data_distribuicao: string | null;
    resumo: string | null;
  } = {
    titulo: null,
    tribunal: null,
    vara: null,
    partes: [],
    movimentacoes: [],
    data_distribuicao: null,
    resumo: null,
  };

  // Extract process title
  const titleMatch = html.match(/<h2[^>]*class="[^"]*processo[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
  if (titleMatch) {
    data.titulo = titleMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  // Extract tribunal info
  const tribunalMatch = html.match(/(?:Tribunal|Órgão)[:\s]*([^<\n]+)/i);
  if (tribunalMatch) {
    data.tribunal = tribunalMatch[1].trim();
  }

  // Extract vara
  const varaMatch = html.match(/(?:Vara|Juízo)[:\s]*([^<\n]+)/i);
  if (varaMatch) {
    data.vara = varaMatch[1].trim();
  }

  // Extract parties
  const partesRegex = /(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Impetrante|Impetrado|Apelante|Apelado|Recorrente|Recorrido|Agravante|Agravado)[:\s]*([^<\n]+)/gi;
  let parteMatch;
  while ((parteMatch = partesRegex.exec(html)) !== null) {
    const parte = parteMatch[0].replace(/<[^>]+>/g, "").trim();
    if (parte && !data.partes.includes(parte)) {
      data.partes.push(parte);
    }
  }

  // Extract date
  const dateMatch = html.match(/(?:Data de distribuição|Distribuído em|Data)[:\s]*([\d]{2}\/[\d]{2}\/[\d]{4})/i);
  if (dateMatch) {
    data.data_distribuicao = dateMatch[1];
  }

  // Extract movements - look for common patterns
  const movRegex = /<(?:li|div|p|tr)[^>]*>[\s\S]*?(\d{2}\/\d{2}\/\d{4})[:\s-]*([\s\S]*?)<\/(?:li|div|p|tr)>/gi;
  let movMatch;
  let movCount = 0;
  while ((movMatch = movRegex.exec(html)) !== null && movCount < 10) {
    const text = `${movMatch[1]} - ${movMatch[2].replace(/<[^>]+>/g, "").trim()}`;
    if (text.length > 15 && text.length < 500) {
      data.movimentacoes.push(text);
      movCount++;
    }
  }

  // Extract a summary/snippet from search results
  const snippetMatch = html.match(/<p[^>]*class="[^"]*(?:snippet|description|resumo)[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  if (snippetMatch) {
    data.resumo = snippetMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  // If we got very little structured data, try to get raw text content from the results area
  if (!data.titulo && data.partes.length === 0 && data.movimentacoes.length === 0) {
    // Try to find the main results container
    const resultsMatch = html.match(/<div[^>]*(?:id|class)="[^"]*(?:result|conteudo|processo)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (resultsMatch) {
      const rawText = resultsMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (rawText.length > 20) {
        data.resumo = rawText.substring(0, 2000);
      }
    }
  }

  return data;
}

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

    console.log("Consultando Escavador para:", numero);

    const searchUrl = `https://www.escavador.com/busca?q=${encodeURIComponent(numero)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      console.error("Escavador returned status:", response.status);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Escavador retornou status ${response.status}. Pode estar bloqueando a consulta.`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();
    console.log("HTML recebido, tamanho:", html.length);

    const dados = extractProcessData(html);

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
      JSON.stringify({ success: true, dados, url_consulta: searchUrl }),
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
