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

    // Strategy 1: Try scraping the Escavador search page directly
    const escavadorSearchUrl = `https://www.escavador.com/busca?q=${encodeURIComponent(numero)}&qo=relevancia`;
    console.log('Scraping Escavador search page:', escavadorSearchUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: escavadorSearchUrl,
        formats: ['markdown', 'links'],
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('Firecrawl scrape error:', scrapeData);
      
      // Fallback: try web search
      return await tryWebSearch(apiKey, numero);
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    const links = scrapeData.data?.links || scrapeData.links || [];
    
    console.log('Scrape markdown length:', markdown.length);
    console.log('Links found:', links.length);

    if (!markdown || markdown.length < 50) {
      // Fallback to search
      return await tryWebSearch(apiKey, numero);
    }

    const parsed = parseEscavadorMarkdown(markdown, links, numero);

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

async function tryWebSearch(apiKey: string, numero: string) {
  console.log('Falling back to web search for:', numero);
  
  const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `"${numero}" processo judicial`,
      limit: 5,
      scrapeOptions: { formats: ['markdown'] },
    }),
  });

  const searchData = await searchResponse.json();
  
  if (!searchResponse.ok) {
    console.error('Search also failed:', searchData);
    return new Response(
      JSON.stringify({ success: false, error: searchData.error || 'Falha na busca' }),
      { status: searchResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const results = searchData.data || [];
  console.log(`Web search found ${results.length} results`);

  if (results.length === 0) {
    return new Response(
      JSON.stringify({ success: true, encontrado: false, dados: null, mensagem: 'Nenhum resultado encontrado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const allText = results.map((r: any) => r.markdown || r.description || '').join('\n\n');
  const fontes = results.filter((r: any) => r.url).map((r: any) => ({ url: r.url, titulo: r.title || r.url }));

  const parsed = parseGenericText(allText, fontes, numero);

  return new Response(
    JSON.stringify({ success: true, encontrado: true, dados: parsed }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function parseEscavadorMarkdown(markdown: string, links: string[], numero: string) {
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

  // Extract process-specific links from Escavador
  const processLinks = links.filter((l: string) => 
    l.includes('escavador.com/processos') || l.includes('escavador.com/diarios')
  );
  for (const link of processLinks.slice(0, 5)) {
    dados.fontes.push({ url: link, titulo: 'Escavador' });
  }

  // Extract tribunal
  const tribunalMatch = markdown.match(/(?:TRF\s*\d+[ªa]?\s*Região|TRF\d|Tribunal\s+Regional\s+Federal[^\n]*|STF|STJ|TST|TJ[A-Z]{2})/i);
  if (tribunalMatch) dados.tribunal = tribunalMatch[0].trim();

  // Extract orgao julgador  
  const orgaoMatch = markdown.match(/(?:\d+[ªa]?\s*(?:Vara|Turma|Câmara|Seção)[^\n,.)]{0,60})/i);
  if (orgaoMatch) dados.orgao_julgador = orgaoMatch[0].trim();

  // Extract classe
  const classeMatch = markdown.match(/(?:Classe|Tipo\s+processual)[:\s]*([^\n]{3,60})/i);
  if (classeMatch) dados.classe = classeMatch[1].trim();

  // Extract assunto
  const assuntoMatch = markdown.match(/(?:Assunto|Matéria)[:\s]*([^\n]{3,100})/i);
  if (assuntoMatch) dados.assunto = assuntoMatch[1].trim();

  // Extract partes
  const partesPatterns = [
    /(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Apelante|Apelado|Beneficiário)[:\s]+([^\n]{3,80})/gi,
    /(?:Parte\s+\d+|Polo\s+(?:ativo|passivo))[:\s]+([^\n]{3,80})/gi,
  ];
  
  for (const pattern of partesPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const name = match[1].trim().replace(/\*\*/g, '');
      if (name && !dados.partes.includes(name) && name.length > 2) {
        dados.partes.push(name);
      }
    }
  }

  // Build summary - get first meaningful content section
  const lines = markdown.split('\n').filter(l => l.trim().length > 10);
  const summaryLines = lines.slice(0, 10).join('\n');
  if (summaryLines) {
    dados.resumo = summaryLines.substring(0, 600).replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (summaryLines.length > 600) dados.resumo += '…';
  }

  return dados;
}

function parseGenericText(text: string, fontes: { url: string; titulo: string }[], numero: string) {
  const dados: Record<string, any> = {
    numero,
    fontes,
    partes: [] as string[],
    tribunal: null,
    orgao_julgador: null,
    classe: null,
    assunto: null,
    resumo: null,
  };

  const tribunalMatch = text.match(/(?:TRF\s*\d+[ªa]?\s*Região|TRF\d|Tribunal\s+Regional\s+Federal[^\n]*|STF|STJ|TST|TJ[A-Z]{2})/i);
  if (tribunalMatch) dados.tribunal = tribunalMatch[0].trim();

  const orgaoMatch = text.match(/(?:\d+[ªa]?\s*(?:Vara|Turma|Câmara|Seção)[^\n,.)]{0,60})/i);
  if (orgaoMatch) dados.orgao_julgador = orgaoMatch[0].trim();

  const partesMatches = text.match(/(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Apelante|Apelado|Beneficiário)[:\s]+([^\n]{3,80})/gi);
  if (partesMatches) {
    for (const m of partesMatches) {
      const name = m.replace(/^(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Apelante|Apelado|Beneficiário)[:\s]+/i, '').trim();
      if (name && !dados.partes.includes(name)) dados.partes.push(name);
    }
  }

  if (text.length > 0) {
    dados.resumo = text.substring(0, 500).replace(/\n{3,}/g, '\n\n').trim();
    if (text.length > 500) dados.resumo += '…';
  }

  return dados;
}
