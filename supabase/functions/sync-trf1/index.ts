import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Known URL patterns for TRF1 precatórios by year
const TRF1_URLS: Record<number, string> = {
  2025: "https://www.trf1.jus.br/trf1/conteudo/precat%C3%B3rios%20federias%20alimentares%20or%C3%A7amento%202025.htm",
  2026: "https://www.trf1.jus.br/trf1/conteudo/rela%C3%A7%C3%A3o%20precat%C3%B3rio%20or%C3%A7amento%202026%20publica%C3%A7%C3%A3o%20rela%C3%A7%C3%A3o%20v_2.htm",
};

function parseHtmlTable(html: string): Array<{ numero: string; valor: number }> {
  const results: Array<{ numero: string; valor: number }> = [];

  // Match table rows: each <tr> has cells for ORDEM, PRECATÓRIO, VALOR, PREFERÊNCIA
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  const rows = html.match(rowRegex) || [];

  for (const row of rows) {
    const cells: string[] = [];
    let cellMatch;
    cellRegex.lastIndex = 0;

    while ((cellMatch = cellRegex.exec(row)) !== null) {
      // Strip HTML tags and &nbsp; entities, trim
      const text = cellMatch[1]
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(text);
    }

    // We expect 4 columns: ORDEM, PRECATÓRIO, VALOR, PREFERÊNCIA
    if (cells.length < 3) continue;

    const ordem = cells[0];
    const precatorio = cells[1];
    const valorStr = cells[2];

    // Skip header rows and summary rows
    if (!ordem || isNaN(Number(ordem))) continue;
    if (!precatorio || precatorio.length < 10) continue;

    // Parse valor: "123.399,62" -> 123399.62
    const cleanValor = valorStr
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const valor = parseFloat(cleanValor);

    if (isNaN(valor)) continue;

    // Format precatório number with mask: NNNNNNN-NN.NNNN.N.NN.NNNN
    let numero = precatorio.replace(/\D/g, "");
    if (numero.length === 20) {
      numero = `${numero.slice(0, 7)}-${numero.slice(7, 9)}.${numero.slice(9, 13)}.${numero.slice(13, 14)}.${numero.slice(14, 16)}.${numero.slice(16, 20)}`;
    }

    results.push({ numero, valor });
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { ano } = await req.json().catch(() => ({ ano: new Date().getFullYear() }));
    const year = ano || new Date().getFullYear();

    console.log(`Syncing precatórios for year ${year}`);

    // 1. First, fetch the TRF1 main page to find the link for the current year
    let fileUrl = TRF1_URLS[year];

    if (!fileUrl) {
      // Try to find the URL dynamically from the main page
      const mainPageRes = await fetch(
        "https://www.trf1.jus.br/trf1/processual/rpv-e-precatorios",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
        }
      );
      const mainHtml = await mainPageRes.text();

      // Look for links containing the year and "Precatórios Federais"
      const linkRegex = new RegExp(
        `href="([^"]*)"[^>]*>[^<]*Precat[^<]*${year}`,
        "i"
      );
      const linkMatch = mainHtml.match(linkRegex);
      if (linkMatch) {
        fileUrl = linkMatch[1];
        if (fileUrl.startsWith("/")) {
          fileUrl = `https://www.trf1.jus.br${fileUrl}`;
        }
      }
    }

    if (!fileUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Não foi possível encontrar o arquivo de precatórios para o ano ${year}`,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching file: ${fileUrl}`);

    // 2. Download the HTML file
    const fileRes = await fetch(fileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "https://www.trf1.jus.br/trf1/processual/rpv-e-precatorios",
      },
    });

    if (!fileRes.ok) {
      console.error(`Failed to fetch file: ${fileRes.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao baixar arquivo do TRF1: HTTP ${fileRes.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await fileRes.text();
    console.log(`Downloaded HTML: ${html.length} bytes`);

    // 3. Parse precatórios from HTML
    const precatorios = parseHtmlTable(html);
    console.log(`Parsed ${precatorios.length} precatórios`);

    if (precatorios.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nenhum precatório encontrado no arquivo HTML. Verifique se o formato mudou.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get user from auth token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Upsert precatórios (avoid duplicates by numero)
    let inserted = 0;
    let skipped = 0;

    for (const p of precatorios) {
      // Check if already exists
      const { data: existing } = await supabase
        .from("precatorios")
        .select("id")
        .eq("user_id", user.id)
        .eq("numero", p.numero)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("precatorios").insert({
        user_id: user.id,
        numero: p.numero,
        valor: p.valor,
        ano: year,
        status: "pendente",
        kanban_coluna: "novo",
      });

      if (insertError) {
        console.error(`Error inserting ${p.numero}:`, insertError.message);
      } else {
        inserted++;
      }
    }

    console.log(`Done: ${inserted} inserted, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total_encontrados: precatorios.length,
        inseridos: inserted,
        ja_existentes: skipped,
        ano: year,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
