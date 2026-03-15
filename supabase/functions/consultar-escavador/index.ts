const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numero } = await req.json();

    if (!numero) {
      return new Response(
        JSON.stringify({ success: false, error: 'Número do precatório é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search Escavador for the process number
    const searchQuery = `site:escavador.com ${numero}`;
    console.log('Searching Escavador via Firecrawl:', searchQuery);

    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error('Firecrawl search error:', searchData);
      return new Response(
        JSON.stringify({ success: false, error: searchData.error || `Firecrawl error ${searchResponse.status}` }),
        { status: searchResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = searchData.data || [];
    console.log(`Found ${results.length} results`);

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, encontrado: false, dados: null, mensagem: 'Nenhum resultado encontrado no Escavador' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the best result's markdown content
    const parsed = parseEscavadorData(results, numero);

    return new Response(
      JSON.stringify({ success: true, encontrado: true, dados: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseEscavadorData(results: any[], numero: string) {
  const dados: Record<string, any> = {
    numero,
    fontes: [] as { url: string; titulo: string }[],
    partes: [] as string[],
    tribunal: null,
    orgao_julgador: null,
    classe: null,
    assunto: null,
    resumo: null,
  };

  const allText: string[] = [];

  for (const result of results) {
    if (result.url) {
      dados.fontes.push({
        url: result.url,
        titulo: result.title || result.url,
      });
    }

    const md = result.markdown || result.description || '';
    if (md) allText.push(md);
  }

  const fullText = allText.join('\n\n');

  // Extract tribunal
  const tribunalMatch = fullText.match(/(?:Tribunal|TRF|TJ|STF|STJ|TST)[^\n,.)]*(?:\d+[ªa]?\s*Região)?/i);
  if (tribunalMatch) dados.tribunal = tribunalMatch[0].trim();

  // Extract orgao julgador
  const orgaoMatch = fullText.match(/(?:Vara|Turma|Câmara|Seção)[^\n,.)]{0,80}/i);
  if (orgaoMatch) dados.orgao_julgador = orgaoMatch[0].trim();

  // Extract classe processual
  const classeMatch = fullText.match(/(?:Classe|Tipo)[:\s]+([^\n]{3,60})/i);
  if (classeMatch) dados.classe = classeMatch[1].trim();

  // Extract assunto
  const assuntoMatch = fullText.match(/(?:Assunto|Matéria)[:\s]+([^\n]{3,100})/i);
  if (assuntoMatch) dados.assunto = assuntoMatch[1].trim();

  // Extract partes (names in uppercase or after Autor/Réu patterns)
  const partesMatches = fullText.match(/(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Apelante|Apelado)[:\s]+([^\n]{3,80})/gi);
  if (partesMatches) {
    for (const m of partesMatches) {
      const name = m.replace(/^(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Apelante|Apelado)[:\s]+/i, '').trim();
      if (name && !dados.partes.includes(name)) {
        dados.partes.push(name);
      }
    }
  }

  // Build a summary from the first result
  if (fullText.length > 0) {
    dados.resumo = fullText.substring(0, 500).replace(/\n{3,}/g, '\n\n').trim();
    if (fullText.length > 500) dados.resumo += '…';
  }

  return dados;
}
