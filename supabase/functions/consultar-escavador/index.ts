import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numero, user_id } = await req.json();

    if (!numero) {
      return jsonResponse({ success: false, error: 'Número do precatório é obrigatório' }, 400);
    }

    const normalizedNumero = numero.replace(/\D/g, '');
    console.log(`Debug: Normalized number to ${normalizedNumero}`);

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get API Key from configurations
    let query = supabase.from('api_configurations').select('escavador_api_key, escavador_endpoint');
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    
    let { data: config, error: configError } = await query.maybeSingle();

    // Fallback: If no config for this user, try to get the first available config (for testing/single user setups)
    if (!config && !configError) {
      console.log('No config for specific user_id, trying fallback to first config');
      const { data: fallbackData } = await supabase.from('api_configurations').select('escavador_api_key, escavador_endpoint').limit(1).maybeSingle();
      config = fallbackData;
    }

    if (!config?.escavador_api_key) {
      console.error('API Key not found in DB');
      return jsonResponse({ success: false, error: 'API Key do Escavador não configurada.' }, 200);
    }

    const ESCAVADOR_API_KEY = config.escavador_api_key;
    const ESCAVADOR_ENDPOINT = config.escavador_endpoint || 'https://api.escavador.com/api/v1';
    
    console.log(`Using endpoint: ${ESCAVADOR_ENDPOINT}`);
    console.log(`Using API Key (length: ${ESCAVADOR_API_KEY.length})`);

    const isV2 = ESCAVADOR_ENDPOINT.includes('/v2');
    let url = '';
    let fetchOptions: any = {
      headers: {
        'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };

    if (isV2) {
      // V2 Search: API uses /processos/numero_cnj/{numero}
      // We'll try with the raw number first as CNJ format is standard
      url = `${ESCAVADOR_ENDPOINT}/processos/numero_cnj/${encodeURIComponent(numero)}`;
      fetchOptions.method = 'GET';
      console.log(`Querying Escavador V2 (GET): ${url}`);
    } else {
      // V1 Search by Number Pattern (POST)
      url = `${ESCAVADOR_ENDPOINT}/processo-tribunal/${numero}/async`;
      fetchOptions.method = 'POST';
      fetchOptions.body = JSON.stringify({
        send_callback: 0,
        wait: 1 
      });
      console.log(`Querying Escavador V1 (POST): ${url}`);
    }
    
    const response = await fetch(url, fetchOptions);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const responseText = await response.text();
    console.log(`Escavador API Call: ${url}`);
    console.log(`Escavador Status: ${response.status}`);
    console.log(`Escavador Headers:`, JSON.stringify(responseHeaders));
    console.log(`Escavador Raw Response:`, responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON');
      return jsonResponse({ success: false, error: 'Resposta inválida do Escavador', raw: responseText.substring(0, 200) }, 200);
    }

    if (!response.ok) {
      console.error('Escavador API error:', data);
      return jsonResponse({ 
        success: false, 
        error: data.error || data.message || `Erro ${response.status} na API`,
        details: data
      }, 200); // Return 200 so invoke doesn't throw, but success is false
    }

    // Process result
    if (isV2) {
      // V2 return structure usually wraps the process in a 'resposta' object or returns it directly
      const resultData = data.resposta || data;
      console.log('Result Data Keys:', Object.keys(resultData).join(', '));
      // Log more if it is a process object
      const proc = resultData.processo || resultData;
      console.log('Process Keys:', Object.keys(proc).join(', '));
      console.log('Result Data extracted:', JSON.stringify(resultData).substring(0, 2000));

      if (resultData && (resultData.id || resultData.processo || resultData.numero_cnj)) {
        const parsed = parseEscavadorResponseV2(resultData, numero);
        return jsonResponse({ success: true, encontrado: true, dados: parsed });
      }
    } else {
      // V1 return status/resposta
      if (data.status === 'SUCESSO' && data.resposta) {
        const parsed = parseEscavadorResponseV1(data.resposta, numero);
        return jsonResponse({ success: true, encontrado: true, dados: parsed });
      } else if (data.status === 'PENDENTE' || data.status === 'PROCESSANDO') {
        return jsonResponse({ 
          success: true, 
          encontrado: true, 
          status: 'processando',
          mensagem: 'A busca está em andamento nos tribunais.',
          link_api: data.link_api
        });
      }
    }

    return jsonResponse({ success: true, encontrado: false, mensagem: 'Processo não encontrado.' });

  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseEscavadorResponseV1(resposta: any, numero: string) {
  const item = resposta.processo || resposta;
  
  const dados: Record<string, any> = {
    numero,
    fontes: [] as any[],
    partes: [] as string[],
    tribunal: item.tribunal?.nome || item.unidade_judiciaria?.tribunal?.nome || null,
    orgao_julgador: item.unidade_judiciaria?.nome || null,
    classe: item.classe || null,
    assunto: item.assunto?.nome || null,
    data_publicacao: item.data_distribuicao || item.data_inicio || null,
    resumo: item.titulo || null,
  };

  if (item.url) {
    dados.fontes.push({ url: item.url, titulo: 'Link Oficial' });
  }

  // Extract involved parties
  const envolvidos = item.envolvidos || [];
  envolvidos.forEach((env: any) => {
    if (env.nome) {
      let label = env.nome;
      if (env.tipo_original) label += ` (${env.tipo_original})`;
      dados.partes.push(label);
    }
  });

  return dados;
}

function parseEscavadorResponseV2(data: any, numero: string) {
  const processo = data.processo || data;
  const fontes = processo.fontes || [];
  
  const toString = (val: any) => {
    if (!val) return null;
    if (typeof val === 'string') return val.trim() || null;
    if (typeof val === 'object') {
      // Prioritized keys for labels
      const priorityKeys = ['nome', 'descricao', 'titulo', 'valor', 'texto', 'designacao', 'sigla'];
      for (const key of priorityKeys) {
        if (val[key] && typeof val[key] === 'string' && val[key].trim()) {
          return val[key].trim();
        }
      }
      // If no priority key, check any string property
      for (const key in val) {
        if (typeof val[key] === 'string' && val[key].trim().length > 2) {
          return val[key].trim();
        }
      }
      return null;
    }
    return String(val);
  };

  // Aggressive nested field extraction from root and all sources
  let tribunal = toString(processo.tribunal);
  let orgao_julgador = toString(processo.unidade_judiciaria) || toString(processo.unidade_origem);
  let classe = toString(processo.classe) || toString(processo.classe_natureza) || toString(processo.classe_cnj) || toString(processo.natureza);
  let assunto = toString(processo.assunto_principal) || toString(processo.assunto_principal_cnj);
  let area = toString(processo.area);
  let valor_causa = toString(processo.valor_da_causa);
  
  // Fallbacks using all Fontes
  fontes.forEach((f: any) => {
    if (!tribunal) tribunal = toString(f.tribunal) || toString(f.nome);
    if (!orgao_julgador) orgao_julgador = toString(f.unidade_judiciaria) || toString(f.unidade_origem) || toString(f.orgao_julgador);
    if (!classe) classe = toString(f.classe) || toString(f.classe_natureza) || toString(f.classe_cnj) || toString(f.natureza);
    if (!assunto) {
      const assuntos = f.assuntos || [];
      if (assuntos.length > 0) assunto = toString(assuntos[0]);
      if (!assunto) assunto = toString(f.assunto_principal) || toString(f.assunto_principal_cnj);
    }
    if (!area) area = toString(f.area);
    if (!valor_causa) valor_causa = toString(f.valor_da_causa);
  });

  // Try to parse Classe and Assunto from title if still null
  // Title pattern: "Procedimento Especial - Assunto X" or similar
  const titulo = toString(processo.titulo);
  if (titulo) {
    if (!classe) {
      const classeMatch = titulo.match(/^([^:-]+)/);
      if (classeMatch) classe = classeMatch[1].trim();
    }
    if (!assunto && titulo.includes('Assunto:')) {
      const assuntoMatch = titulo.match(/Assunto:\s*([^;]+)/i);
      if (assuntoMatch) assunto = assuntoMatch[1].trim();
    }
  }

  const data_pub = processo.data_ultima_movimentacao || processo.distribuido_em || (fontes.length > 0 ? fontes[0].data_inicio : null);

  // Identification of Applicant and Document
  let cpf_identificado: string | null = null;
  let nome_identificado: string | null = null;
  
  // Collect all envolvidos from root and all fontes
  const allEnvolvidos: any[] = [...(processo.envolvidos || [])];
  fontes.forEach((f: any) => {
    if (f.envolvidos && Array.isArray(f.envolvidos)) {
      allEnvolvidos.push(...f.envolvidos);
    }
  });

  // Unique list of parties formatted with documents and roles
  const partesFormatadas: string[] = [];
  const seenParties = new Set<string>();

  allEnvolvidos.forEach((env: any) => {
    const nome = toString(env);
    if (nome && !seenParties.has(nome)) {
      seenParties.add(nome);
      let label = nome;
      const doc = env.documento || env.cpf || env.cnpj;
      if (doc) label += ` [CPF/CNPJ: ${doc}]`;
      const tipo = env.tipo_original || env.tipo || env.tipo_identificado;
      if (tipo) label += ` (${tipo})`;
      partesFormatadas.push(label);

      // Identification logic (Plan A: Requerente)
      if (!cpf_identificado) {
        const isRequerente = (env.tipo_polo === 'ATIVO' || 
                             ['REQUERENTE', 'AUTOR', 'EXEQUENTE'].includes(String(tipo).toUpperCase()));
        if (isRequerente && doc) {
          cpf_identificado = doc;
          nome_identificado = nome;
        }
      }
    }
  });

  // Unique list of magistrates (juizes)
  const magistrados: string[] = [];
  allEnvolvidos.forEach((env: any) => {
    const tipo = String(env.tipo_original || env.tipo || '').toUpperCase();
    if (tipo.includes('JUIZ') || tipo.includes('MAGISTRADO') || tipo.includes('RELATOR')) {
      const nome = toString(env);
      if (nome && !magistrados.includes(nome)) magistrados.push(nome);
    }
  });

  // Plan B: Lawyer/Adv fallback if no Requerente document found
  if (!cpf_identificado) {
    const adv = allEnvolvidos.find((e: any) => {
      const tipo = String(e.tipo || e.tipo_original || '').toLowerCase();
      return tipo.includes('advogado') && (e.documento || e.cpf || e.cnpj);
    });
    if (adv) {
      cpf_identificado = `ADV: ${adv.documento || adv.cpf || adv.cnpj}`;
      nome_identificado = toString(adv);
    }
  }

  // Fallback parsing from 'partes' string array
  const listagemPartesRoot = (processo.partes || []).map((p: any) => typeof p === 'string' ? p : toString(p));
  if (!cpf_identificado || !nome_identificado) {
    const docRegex = /(\d{11,14})/;
    for (const p of listagemPartesRoot) {
      if (!p) continue;
      const match = p.match(docRegex);
      if (match && !cpf_identificado) {
        if (p.toUpperCase().includes('REQUERENTE') || p.toUpperCase().includes('AUTOR')) {
          cpf_identificado = match[1];
        } else if (p.toUpperCase().includes('ADVOGADO')) {
          cpf_identificado = `ADV: ${match[1]}`;
        }
      }
      if (!nome_identificado && (p.toUpperCase().includes('REQUERENTE') || p.toUpperCase().includes('AUTOR'))) {
        nome_identificado = p.split('[')[0].split('(')[0].trim();
      }
    }
  }

  const result: Record<string, any> = {
    numero,
    encontrado: true,
    fontes: [] as any[],
    partes: partesFormatadas.length > 0 ? partesFormatadas : listagemPartesRoot.filter(Boolean),
    magistrados,
    tribunal,
    orgao_julgador,
    classe,
    assunto,
    area,
    valor_causa,
    data_publicacao: data_pub,
    resumo: processo.titulo || null,
    cpf_identificado,
    nome_identificado,
    raw_debug_keys: Object.keys(processo),
  };

  fontes.forEach((f: any) => {
    if (f.url || f.link) {
      result.fontes.push({ 
        url: f.url || f.link, 
        titulo: f.nome || f.descricao || 'Fonte Escavador' 
      });
    }
  });

  return result;
}
