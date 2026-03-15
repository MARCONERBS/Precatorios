import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanDdgUrl(rawUrl: string): string | null {
  try {
    // Extract real URL from DuckDuckGo redirect
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      let decoded = decodeURIComponent(uddgMatch[1]);
      // If it's a DDG ad redirect, try to find the real URL inside
      if (decoded.includes("duckduckgo.com/y.js")) return null; // Ad
      return decoded;
    }
    if (rawUrl.startsWith("http")) return rawUrl;
    return null;
  } catch {
    return null;
  }
}

function extractDuckDuckGoResults(html: string) {
  const data: {
    encontrado: boolean;
    resultados: Array<{ titulo: string; link: string; snippet: string }>;
    partes: string[];
    tribunal: string | null;
    orgao_julgador: string | null;
    classe: string | null;
    resumo: string | null;
  } = {
    encontrado: false,
    resultados: [],
    partes: [],
    tribunal: null,
    orgao_julgador: null,
    classe: null,
    resumo: null,
  };

  // Extract DuckDuckGo HTML lite results
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links: Array<{ titulo: string; link: string }> = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const cleanUrl = cleanDdgUrl(linkMatch[1]);
    if (cleanUrl) {
      links.push({
        link: cleanUrl,
        titulo: linkMatch[2].replace(/<[^>]+>/g, "").trim(),
      });
    }
  }

  const snippets: string[] = [];
  let snippetMatch;
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(snippetMatch[1].replace(/<[^>]+>/g, "").trim());
  }

  // Match links with snippets, filter out ads
  let snippetIdx = 0;
  for (const link of links) {
    const snippet = snippets[snippetIdx] || "";
    snippetIdx++;
    
    // Skip irrelevant results
    if (link.link.includes("zoom.com") || link.link.includes("shopee") || 
        link.link.includes("mercadolivre") || link.link.includes("amazon")) continue;

    data.resultados.push({
      titulo: link.titulo,
      link: link.link,
      snippet,
    });
  }

  // If no results from class-based extraction, try fallback
  if (data.resultados.length === 0) {
    const genericRegex = /<a[^>]*href="([^"]*(?:jusbrasil|escavador|trf|cnj)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let gMatch;
    const seen = new Set<string>();
    while ((gMatch = genericRegex.exec(html)) !== null) {
      const cleanUrl = cleanDdgUrl(gMatch[1]) || gMatch[1];
      const titulo = gMatch[2].replace(/<[^>]+>/g, "").trim();
      if (titulo.length > 5 && cleanUrl && !seen.has(cleanUrl)) {
        seen.add(cleanUrl);
        data.resultados.push({ titulo, link: cleanUrl, snippet: "" });
      }
    }
  }

  if (data.resultados.length > 0) data.encontrado = true;

  // Extract structured info from all text
  const allText = data.resultados.map((r) => r.snippet + " " + r.titulo).join(" ");

  // Extract parties from "entre X e Y" pattern in Escavador/JusBrasil snippets
  const entreMatch = allText.match(/entre\s+(.+?)\s+e\s+(?:outros\s+e\s+)?(.+?)(?:\s+no\s+Escavador|\s+no\s+JusBrasil|\.\s|$)/i);
  if (entreMatch) {
    const parte1 = entreMatch[1].replace(/\s+e\s+outros$/i, "").trim();
    const parte2 = entreMatch[2].trim();
    if (parte1.length > 3) data.partes.push(parte1);
    if (parte2.length > 3) data.partes.push(parte2);
  }

  // More party patterns
  const parteRegex = /(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Impetrante|Impetrado|Apelante|Apelado|Recorrente|Recorrido)[:\s]+([^.;,\n]{3,80})/gi;
  let parteMatch;
  while ((parteMatch = parteRegex.exec(allText)) !== null) {
    const parte = parteMatch[0].trim();
    if (!data.partes.includes(parte)) data.partes.push(parte);
  }

  // Tribunal
  const tribunalMatch = allText.match(/(?:TRF\s*\d+|TJ\w{2}|TST|STJ|STF)/i);
  if (tribunalMatch) data.tribunal = tribunalMatch[0].trim();

  // Órgão julgador (e.g., "Juizo Federal da 7a Vara - Ba")
  const orgaoMatch = allText.match(/(?:Ju[ií]zo\s+Federal\s+da?\s+\d+[ªa]?\s+Vara[^,\n.]*)/i);
  if (orgaoMatch) data.orgao_julgador = orgaoMatch[0].trim();

  // Classe
  const classeMatch = allText.match(/(?:Precatório|Execução\s+\w+|Ação\s+\w+|Mandado\s+de\s+Segurança|Recurso\s+\w+)/i);
  if (classeMatch) data.classe = classeMatch[0].trim();

  // Summary from relevant snippets only
  const relevantSnippets = data.resultados
    .filter((r) => r.snippet.length > 30 && !r.snippet.includes("menores preços"))
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

    const query = encodeURIComponent(`"${numero}" processo`);
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
        JSON.stringify({ success: false, error: `Busca retornou status ${response.status}` }),
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
