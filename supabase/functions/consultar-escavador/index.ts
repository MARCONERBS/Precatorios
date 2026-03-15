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

    // Step 1: Scrape Escavador search page to find the process link
    const escavadorSearchUrl = `https://www.escavador.com/busca?q=${encodeURIComponent(numero)}&qo=relevancia`;
    console.log('Step 1: Scraping search page:', escavadorSearchUrl);

    const searchScrape = await firecrawlScrape(apiKey, escavadorSearchUrl, ['markdown', 'links']);

    if (!searchScrape.ok) {
      console.error('Search scrape failed, trying web search fallback');
      return await tryWebSearch(apiKey, numero);
    }

    const searchMarkdown = searchScrape.data?.markdown || '';
    const searchLinks = searchScrape.data?.links || [];
    console.log('Search page markdown length:', searchMarkdown.length, 'links:', searchLinks.length);

    // Step 2: Find the actual process page URL from the links
    const processUrl = findProcessUrl(searchLinks, numero);

    if (processUrl) {
      console.log('Step 2: Found process URL, scraping:', processUrl);
      const processScrape = await firecrawlScrape(apiKey, processUrl, ['markdown']);

      if (processScrape.ok && processScrape.data?.markdown?.length > 100) {
        const parsed = parseProcessPage(processScrape.data.markdown, processUrl, numero);
        return jsonResponse({ success: true, encontrado: true, dados: parsed });
      }
    }

    // Step 3: If no process URL found or scrape failed, parse search page itself
    if (searchMarkdown.length > 50) {
      console.log('Step 3: Parsing search page directly');
      const parsed = parseSearchPage(searchMarkdown, searchLinks, numero);
      
      // Check if we got any useful data
      if (parsed.tribunal || parsed.partes.length > 0 || parsed.resumo) {
        return jsonResponse({ success: true, encontrado: true, dados: parsed });
      }
    }

    // Step 4: Fallback to web search
    console.log('Step 4: Falling back to web search');
    return await tryWebSearch(apiKey, numero);

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function firecrawlScrape(apiKey: string, url: string, formats: string[]) {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats, waitFor: 3000 }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Firecrawl error:', data);
      return { ok: false, data: null };
    }

    return { ok: true, data: data.data || data };
  } catch (err) {
    console.error('Firecrawl fetch error:', err);
    return { ok: false, data: null };
  }
}

function findProcessUrl(links: string[], numero: string): string | null {
  // Look for direct process page links on Escavador
  const processLinks = links.filter((l: string) =>
    l.includes('escavador.com/processos') && !l.includes('/busca')
  );

  if (processLinks.length > 0) {
    return processLinks[0];
  }

  // Look for links containing the process number pattern
  const numeroClean = numero.replace(/[.\-]/g, '');
  for (const link of links) {
    if (link.includes(numeroClean) && link.includes('escavador.com')) {
      return link;
    }
  }

  return null;
}

function parseProcessPage(markdown: string, url: string, numero: string) {
  const dados: Record<string, any> = {
    numero,
    fontes: [{ url, titulo: 'Escavador - Página do Processo' }],
    partes: [] as string[],
    tribunal: null,
    orgao_julgador: null,
    classe: null,
    assunto: null,
    resumo: null,
  };

  // Tribunal
  const tribunalMatch = markdown.match(/Tribunal\s+Regional\s+Federal\s+da\s+\d+[ªa]?\s*Região/i)
    || markdown.match(/(?:TRF\s*\d+[ªa]?\s*Região|TRF\d|STF|STJ|TST|TJ[A-Z]{2})/i);
  if (tribunalMatch) dados.tribunal = tribunalMatch[0].trim();

  // Órgão julgador
  const orgaoMatch = markdown.match(/(?:Órgão\s+[Jj]ulgador|Vara|Juízo)[:\s]*([^\n]{3,80})/i)
    || markdown.match(/(?:Ju[ií]zo\s+Federal\s+da?\s+\d+[ªa]?\s*Vara[^\n,.)]{0,30})/i)
    || markdown.match(/(?:\d+[ªa]?\s*(?:Vara|Turma|Câmara|Seção)[^\n,.)]{0,40})/i);
  if (orgaoMatch) dados.orgao_julgador = (orgaoMatch[1] || orgaoMatch[0]).trim();

  // Classe
  const classeMatch = markdown.match(/(?:Classe|Tipo\s+processual|Classe\s+processual)[:\s]*([^\n]{3,60})/i);
  if (classeMatch) dados.classe = classeMatch[1].trim();

  // Assunto
  const assuntoMatch = markdown.match(/(?:Assunto|Matéria|Assuntos?)[:\s]*([^\n]{3,100})/i);
  if (assuntoMatch) dados.assunto = assuntoMatch[1].trim();

  // Partes - multiple patterns
  const partesSection = markdown.match(/(?:Partes|Polo\s+Ativo|Polo\s+Passivo|Partes\s+do\s+Processo)[\s\S]{0,500}/i);
  if (partesSection) {
    const names = partesSection[0].matchAll(/\[([^\]]{3,80})\]/g);
    for (const m of names) {
      const name = m[1].trim();
      if (name && !dados.partes.includes(name) && !name.startsWith('http') && !isUiElement(name)) {
        dados.partes.push(name);
      }
    }
  }

  const partesPatterns = [
    /(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Apelante|Apelado|Beneficiário|Impetrante|Impetrado)[:\s]+([^\n]{3,80})/gi,
  ];
  for (const pattern of partesPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const name = match[1].trim().replace(/\*\*/g, '').replace(/\[|\]/g, '').replace(/\(.*?\)/g, '').trim();
      if (name && !dados.partes.includes(name) && name.length > 2 && !isUiElement(name)) {
        dados.partes.push(name);
      }
    }
  }

  // Also try "partes envolvidas" pattern
  const partesEnvolvidas = markdown.match(/partes?\s+envolvidas?\s+(.+?)(?:\.\s|$)/i);
  if (partesEnvolvidas) {
    const nameMatches = partesEnvolvidas[1].matchAll(/\[([^\]]+)\]/g);
    for (const m of nameMatches) {
      const name = m[1].trim();
      if (name && !dados.partes.includes(name) && name.length > 2 && !name.startsWith('http') && !isUiElement(name)) {
        dados.partes.push(name);
      }
    }
  }

  // Data
  const dateMatch = markdown.match(/(?:Distribuído\s+em|Data\s+de\s+distribuição|em)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)
    || markdown.match(/(?:em|desde)\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i);
  if (dateMatch) dados.data_publicacao = dateMatch[1];

  // Valor
  const valorMatch = markdown.match(/(?:Valor\s+da\s+causa|Valor)[:\s]*R\$\s*([\d.,]+)/i);
  if (valorMatch) dados.valor_causa = valorMatch[1];

  // Build resumo from clean content
  const cleanContent = markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\\{2,}/g, '')
    .split('\n')
    .filter(line => line.trim().length > 10 && !isUiLine(line))
    .slice(0, 8)
    .join('\n')
    .trim();

  if (cleanContent.length > 20) {
    dados.resumo = cleanContent.substring(0, 600);
    if (cleanContent.length > 600) dados.resumo += '…';
  }

  return dados;
}

function parseSearchPage(markdown: string, links: string[], numero: string) {
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

  // Extract process-specific links
  const processLinks = links.filter((l: string) =>
    l.includes('escavador.com/processos') || l.includes('escavador.com/diarios')
  );
  for (const link of processLinks.slice(0, 5)) {
    dados.fontes.push({ url: link, titulo: 'Escavador' });
  }

  // Tribunal
  const tribunalMatch = markdown.match(/Tribunal\s+Regional\s+Federal\s+da\s+\d+[ªa]?\s*Região/i)
    || markdown.match(/(?:TRF\s*\d+[ªa]?\s*Região|TRF\d|STF|STJ|TST|TJ[A-Z]{2})/i);
  if (tribunalMatch) dados.tribunal = tribunalMatch[0].trim();

  // Órgão julgador
  const orgaoMatch = markdown.match(/(?:Ju[ií]zo\s+Federal\s+da?\s+\d+[ªa]?\s*Vara[^\n,.)]{0,30})/i)
    || markdown.match(/(?:\d+[ªa]?\s*(?:Vara|Turma|Câmara|Seção)[^\n,.)]{0,40})/i);
  if (orgaoMatch) dados.orgao_julgador = orgaoMatch[0].trim();

  // Classe
  const classeMatch = markdown.match(/(?:Classe|Tipo\s+processual)[:\s]*([^\n]{3,60})/i);
  if (classeMatch) dados.classe = classeMatch[1].trim();

  // Partes envolvidas
  const partesEnvolvidas = markdown.match(/partes?\s+envolvidas?\s+(.+?)(?:\.\s|$)/i);
  if (partesEnvolvidas) {
    const nameMatches = partesEnvolvidas[1].matchAll(/\[([^\]]+)\]/g);
    for (const m of nameMatches) {
      const name = m[1].trim();
      if (name && !dados.partes.includes(name) && name.length > 2 && !name.startsWith('http') && !isUiElement(name)) {
        dados.partes.push(name);
      }
    }
  }

  // Standard partes patterns
  const partesPatterns = [
    /(?:Autor|Réu|Requerente|Requerido|Exequente|Executado|Apelante|Apelado|Beneficiário)[:\s]+([^\n]{3,80})/gi,
  ];
  for (const pattern of partesPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const name = match[1].trim().replace(/\*\*/g, '').replace(/\[|\]/g, '');
      if (name && !dados.partes.includes(name) && name.length > 2 && !isUiElement(name)) {
        dados.partes.push(name);
      }
    }
  }

  // Resumo from context
  const contextMatch = markdown.match(/Tem como partes envolvidas\s+(.+?)(?:\.\s|e outros)/is);
  if (contextMatch) {
    const raw = contextMatch[1]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/\n/g, ' ')
      .trim();
    dados.resumo = `Partes envolvidas: ${raw}`;
  }

  // Date
  const dateMatch = markdown.match(/(?:em|desde)\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i);
  if (dateMatch) dados.data_publicacao = dateMatch[1];

  return dados;
}

async function tryWebSearch(apiKey: string, numero: string) {
  console.log('Web search fallback for:', numero);

  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `site:escavador.com "${numero}"`,
      limit: 5,
      scrapeOptions: { formats: ['markdown'] },
    }),
  });

  const searchData = await response.json();

  if (!response.ok) {
    console.error('Web search failed:', searchData);
    return jsonResponse({ success: false, error: searchData.error || 'Falha na busca' }, response.status);
  }

  const results = searchData.data || [];
  console.log(`Web search found ${results.length} results`);

  if (results.length === 0) {
    return jsonResponse({ success: true, encontrado: false, dados: null, mensagem: 'Nenhum resultado encontrado' });
  }

  // If we got a result with markdown, parse the best one
  const bestResult = results.find((r: any) => r.markdown && r.markdown.length > 100) || results[0];

  if (bestResult?.markdown) {
    const parsed = parseProcessPage(bestResult.markdown, bestResult.url || '', numero);
    // Add all result URLs as sources
    parsed.fontes = results
      .filter((r: any) => r.url)
      .map((r: any) => ({ url: r.url, titulo: r.title || 'Escavador' }));
    return jsonResponse({ success: true, encontrado: true, dados: parsed });
  }

  return jsonResponse({ success: true, encontrado: false, dados: null, mensagem: 'Nenhum resultado encontrado' });
}

function isUiElement(text: string): boolean {
  const uiTerms = ['Fechar', 'Entrar', 'menu', 'Cadastre', 'Login', 'Buscar', 'Pesquisar', 'Ver mais', 'Saiba mais', 'Termos', 'Privacidade', 'Cookie', 'Solicitar', 'Polo Ativo', 'Polo Passivo', 'Exibir', 'Compartilhar', 'sem internet'];
  return uiTerms.some(term => text.toLowerCase().includes(term.toLowerCase())) || /^[—\-\s\\]+/.test(text);
}

function isUiLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 5) return true;
  return isUiElement(trimmed) || /^(Escavador|©|Todos os direitos|Siga-nos)/i.test(trimmed);
}
