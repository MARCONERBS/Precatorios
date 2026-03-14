import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRF1_URLS: Record<number, string> = {
  2025: "https://www.trf1.jus.br/trf1/conteudo/precat%C3%B3rios%20federias%20alimentares%20or%C3%A7amento%202025.htm",
  2026: "https://www.trf1.jus.br/trf1/conteudo/rela%C3%A7%C3%A3o%20precat%C3%B3rio%20or%C3%A7amento%202026%20publica%C3%A7%C3%A3o%20rela%C3%A7%C3%A3o%20v_2.htm",
};

function parseHtmlTable(html: string): Array<{ numero: string; valor: number }> {
  const results: Array<{ numero: string; valor: number }> = [];
  
  // Use a more robust approach: find all <tr>...</tr> blocks
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*?>([\s\S]*?)<\/td>/gi;
  
  let rowMatch;
  let totalRows = 0;
  let dataRows = 0;
  let logged = 0;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    totalRows++;
    const rowContent = rowMatch[1];
    
    // Skip rows with colspan (header/merged rows)
    if (/colspan/i.test(rowContent)) continue;
    
    const cells: string[] = [];
    let cellMatch;
    const localCellRegex = /<td[^>]*?>([\s\S]*?)<\/td>/gi;
    
    while ((cellMatch = localCellRegex.exec(rowContent)) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&#?\w+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(text);
    }

    if (cells.length < 3) continue;
    
    // Log first data rows for debugging
    if (logged < 10) {
      console.log(`DataRow[${logged}] cells=${cells.length}: ${JSON.stringify(cells.slice(0, 5))}`);
      logged++;
    }

    const ordem = cells[0];
    const precatorio = cells[1];
    const valorStr = cells[2];

    if (!ordem || isNaN(Number(ordem))) continue;
    
    const precDigits = precatorio.replace(/\D/g, "");
    if (precDigits.length < 10) continue;

    const cleanValor = valorStr.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(cleanValor);
    if (isNaN(valor) || valor <= 0) continue;

    dataRows++;

    let numero = precDigits;
    if (numero.length === 20) {
      numero = `${numero.slice(0, 7)}-${numero.slice(7, 9)}.${numero.slice(9, 13)}.${numero.slice(13, 14)}.${numero.slice(14, 16)}.${numero.slice(16, 20)}`;
    }

    results.push({ numero, valor });
  }

  console.log(`Total rows: ${totalRows}, data rows with valid data: ${dataRows}`);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    let fileUrl = TRF1_URLS[year];
    if (!fileUrl) {
      const mainPageRes = await fetch(
        "https://www.trf1.jus.br/trf1/processual/rpv-e-precatorios",
        { headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" } }
      );
      const mainHtml = await mainPageRes.text();
      const linkRegex = new RegExp(`href="([^"]*)"[^>]*>[^<]*Precat[^<]*${year}`, "i");
      const linkMatch = mainHtml.match(linkRegex);
      if (linkMatch) {
        fileUrl = linkMatch[1];
        if (fileUrl.startsWith("/")) fileUrl = `https://www.trf1.jus.br${fileUrl}`;
      }
    }

    if (!fileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: `Arquivo não encontrado para ${year}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching: ${fileUrl}`);
    const fileRes = await fetch(fileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Referer": "https://www.trf1.jus.br/trf1/processual/rpv-e-precatorios",
      },
    });

    if (!fileRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Erro HTTP ${fileRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await fileRes.text();
    console.log(`Downloaded: ${html.length} bytes`);

    const precatorios = parseHtmlTable(html);
    console.log(`Parsed ${precatorios.length} precatórios`);

    if (precatorios.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum precatório encontrado no arquivo", html_size: html.length }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existing } = await supabase
      .from("precatorios").select("numero").eq("user_id", user.id).eq("ano", year);
    const existingSet = new Set((existing || []).map((e: any) => e.numero));

    const toInsert = precatorios
      .filter((p) => !existingSet.has(p.numero))
      .map((p) => ({ user_id: user.id, numero: p.numero, valor: p.valor, ano: year, status: "pendente", kanban_coluna: "novo" }));

    const skipped = precatorios.length - toInsert.length;
    let inserted = 0;
    const BATCH_SIZE = 500;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("precatorios").insert(batch);
      if (insertError) console.error(`Batch error at ${i}:`, insertError.message);
      else inserted += batch.length;
    }

    console.log(`Done: ${inserted} inserted, ${skipped} skipped`);
    return new Response(
      JSON.stringify({ success: true, total_encontrados: precatorios.length, inseridos: inserted, ja_existentes: skipped, ano: year }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
