import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractDataFromSnippets(html: string, numero: string) {
  const data: {
    encontrado: boolean;
    resultados: Array<{ titulo: string; link: string; snippet: string }>;
    partes: string[];
    tribunal: string | null;
    vara: string | null;
    classe: string | null;
    resumo: string | null;
  } = {
    encontrado: false,
    resultados: [],
    partes: [],
    tribunal: null,
    vara: null,
    classe: null,
    resumo: null,
  };

  // Extract Google search results
  const resultRegex = /<div class="[^"]*"[^>]*>[\s\S]*?<a href="\/url\?q=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    const link = decodeURIComponent(match[1]);
    const titulo = match[2].replace(/<[^>]+>/g, "").trim();
    const snippet = match[3].replace(/<[^>]+>/g, "").trim();
    if (titulo && snippet && link && !link.includes("google.com")) {
      data.resultados.push({ titulo, link, snippet });
    }
  }

  // Alternative: simpler result extraction
  if (data.resultados.length === 0) {
    // Try h3 + cite + span pattern
    const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    const titles: string[] = [];
    let h3Match;
    while ((h3Match = h3Regex.exec(html)) !== null) {
      titles.push(h3Match[1].replace(/<[^>]+>/g, "").trim());
    }

    // Extract all visible text snippets near the search results
    const snippetRegex = /<span[^>]*class="[^"]*(?:st|aCOpRe|IsZvec)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    const snippets: string[] = [];
    let snipMatch;
    while ((snipMatch = snippetRegex.exec(html)) !== null) {
      const text = snipMatch[1].replace(/<[^>]+>/g, "").trim();
      if (text.length > 30) snippets.push(text);
    }

    // Extract links
    const linkRegex = /<a href="\/url\?q=([^&"]+)/gi;
    const links: string[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const url = decodeURIComponent(linkMatch[1]);
      if (!url.includes("google.com") && !url.includes("accounts.google")) {
        links.push(url);
      }
    }

    for (let i = 0; i < Math.min(titles.length, 10); i++) {
      data.resultados.push({
        titulo: titles[i] || "",
        link: links[i] || "",
        snippet: snippets[i] || "",
      });
    }
  }

  if (data.resultados.length > 0) {
    data.encontrado = true;
  }

  // Extract party names from snippets
  const allText = data.resultados.map((r) => r.snippet + " " + r.titulo).join(" ");

  const parteRegex = /(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Impetrante|Impetrado|Apelante|Apelado|Recorrente|Recorrido|Agravante|Agravado)[:\s]+([^.;,\n]{3,80})/gi;
  let parteMatch;
  while ((parteMatch = parteRegex.exec(allText)) !== null) {
    const parte = `${parteMatch[0].trim()}`;
    if (!data.partes.includes(parte)) {
      data.partes.push(parte);
    }
  }

  // Extract tribunal
  const tribunalMatch = allText.match(/(?:TRF|TJ|TST|STJ|STF)[^\s]*\s*(?:da\s+)?(?:\d+[ªa]\s+)?(?:Região|Região|região)?/i);
  if (tribunalMatch) data.tribunal = tribunalMatch[0].trim();

  // Extract classe
  const classeMatch = allText.match(/(?:Precatório|Execução|Ação\s+\w+|Mandado\s+de\s+Segurança|Recurso\s+\w+)/i);
  if (classeMatch) data.classe = classeMatch[0].trim();

  // Build a summary from the best snippets
  const relevantSnippets = data.resultados
    .filter((r) => r.snippet.length > 40)
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

    console.log("Buscando no Google:", numero);

    // Search Google for the precatório number
    const query = encodeURIComponent(`"${numero}" processo precatório site:jusbrasil.com.br OR site:escavador.com OR site:trf1.jus.br`);
    const googleUrl = `https://www.google.com/search?q=${query}&hl=pt-BR&num=10`;

    const response = await fetch(googleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      console.error("Google returned status:", response.status);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Busca retornou status ${response.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();
    console.log("HTML recebido do Google, tamanho:", html.length);

    const dados = extractDataFromSnippets(html, numero);

    // Save to database if we have a precatorio_id
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
