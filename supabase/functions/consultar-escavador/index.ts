import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractDuckDuckGoResults(html: string) {
  const data: {
    encontrado: boolean;
    resultados: Array<{ titulo: string; link: string; snippet: string }>;
    partes: string[];
    tribunal: string | null;
    classe: string | null;
    resumo: string | null;
  } = {
    encontrado: false,
    resultados: [],
    partes: [],
    tribunal: null,
    classe: null,
    resumo: null,
  };

  // DuckDuckGo HTML lite results pattern
  // Try multiple patterns for DuckDuckGo result extraction
  
  // Pattern 1: result__a links with result__snippet
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  
  const links: Array<{titulo: string; link: string}> = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    links.push({
      link: linkMatch[1],
      titulo: linkMatch[2].replace(/<[^>]+>/g, "").trim(),
    });
  }
  
  const snippets: string[] = [];
  let snippetMatch;
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(snippetMatch[1].replace(/<[^>]+>/g, "").trim());
  }

  for (let i = 0; i < links.length; i++) {
    data.resultados.push({
      titulo: links[i].titulo,
      link: links[i].link,
      snippet: snippets[i] || "",
    });
  }

  // Pattern 2: fallback - extract any links with titles
  if (data.resultados.length === 0) {
    const genericRegex = /<a[^>]*href="(https?:\/\/(?!duckduckgo)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let gMatch;
    const seen = new Set<string>();
    while ((gMatch = genericRegex.exec(html)) !== null) {
      const link = gMatch[1];
      const titulo = gMatch[2].replace(/<[^>]+>/g, "").trim();
      if (titulo.length > 10 && !seen.has(link) && 
          (link.includes("jusbrasil") || link.includes("escavador") || link.includes("trf") || link.includes("cnj"))) {
        seen.add(link);
        data.resultados.push({ titulo, link, snippet: "" });
      }
    }
  }

  if (data.resultados.length > 0) {
    data.encontrado = true;
  }

  // Extract info from snippets
  const allText = data.resultados.map((r) => r.snippet + " " + r.titulo).join(" ");

  // Parties
  const parteRegex = /(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Impetrante|Impetrado|Apelante|Apelado)[:\s]+([^.;,\n]{3,80})/gi;
  let parteMatch;
  while ((parteMatch = parteRegex.exec(allText)) !== null) {
    const parte = parteMatch[0].trim();
    if (!data.partes.includes(parte)) data.partes.push(parte);
  }

  // Tribunal
  const tribunalMatch = allText.match(/(?:TRF|TJ|TST|STJ|STF)\s*(?:\d+[ªa]?\s*(?:Região)?)?/i);
  if (tribunalMatch) data.tribunal = tribunalMatch[0].trim();

  // Classe
  const classeMatch = allText.match(/(?:Precatório|Execução\s+\w+|Ação\s+\w+|Mandado\s+de\s+Segurança)/i);
  if (classeMatch) data.classe = classeMatch[0].trim();

  // Summary
  const relevantSnippets = data.resultados
    .filter((r) => r.snippet.length > 30)
    .slice(0, 3)
    .map((r) => r.snippet);
  if (relevantSnippets.length > 0) {
    data.resumo = relevantSnippets.join("\n\n");
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

    console.log("Buscando no DuckDuckGo:", numero);

    // Use DuckDuckGo HTML lite (no JS needed, no captcha)
    const query = encodeURIComponent(`"${numero}" processo precatório`);
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${query}`;

    const response = await fetch(ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    if (!response.ok) {
      console.error("DuckDuckGo returned status:", response.status);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Busca retornou status ${response.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();
    console.log("HTML recebido, tamanho:", html.length);

    const dados = extractDuckDuckGoResults(html);
    console.log("Resultados encontrados:", dados.resultados.length);

    // Save to database
    if (precatorio_id && dados.encontrado) {
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
