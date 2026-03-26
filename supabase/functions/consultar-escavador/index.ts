import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  const v_cpf = cpf.replace(/\D/g, '');
  if (v_cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(v_cpf)) return false;

  let total1 = 0;
  for (let i = 0; i < 9; i++) {
    total1 += parseInt(v_cpf.charAt(i)) * (10 - i);
  }
  let dig1 = 11 - (total1 % 11);
  if (dig1 >= 10) dig1 = 0;

  let total2 = 0;
  for (let i = 0; i < 10; i++) {
    total2 += parseInt(v_cpf.charAt(i)) * (11 - i);
  }
  let dig2 = 11 - (total2 % 11);
  if (dig2 >= 10) dig2 = 0;

  return dig1 === parseInt(v_cpf.charAt(9)) && dig2 === parseInt(v_cpf.charAt(10));
}

function isValidCNPJ(cnpj: string): boolean {
  if (!cnpj) return false;
  const v_cnpj = cnpj.replace(/\D/g, '');
  if (v_cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(v_cnpj)) return false;

  let tamanho = v_cnpj.length - 2;
  let numeros = v_cnpj.substring(0, tamanho);
  let digitos = v_cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = v_cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

function stringifyIfNeeded(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
     if (val.valor_formatado) return val.valor_formatado;
     if (val.valor && val.moeda) return `${val.moeda} ${val.valor}`;
     return val.nome || val.descricao || val.valor || JSON.stringify(val);
  }
  return String(val);
}

async function findNaturezaId(supabase: any, classe: string | null, assunto: string | null) {
  const text = `${classe || ''} ${assunto || ''}`.toLowerCase();
  
  let nomeNatureza = 'Comum';
  
  if (text.includes('alimentar') || text.includes('pensão') || text.includes('salário') || 
      text.includes('proventos') || text.includes('servidor') || text.includes('benefício') ||
      text.includes('previdenciário') || text.includes('aposentadoria') || text.includes('vencimento')) {
    nomeNatureza = 'Alimentar';
  } else if (text.includes('indeniza') || text.includes('dano') || text.includes('reparação') || text.includes('desapropriação')) {
    nomeNatureza = 'Indenizatório';
  } else if (text.includes('tributário') || text.includes('imposto') || text.includes('contruibuição') || text.includes('fiscal') || text.includes('icms') || text.includes('iptu')) {
    nomeNatureza = 'Tributário';
  }

  const { data } = await supabase.from('naturezas').select('id, nome').eq('nome', nomeNatureza).maybeSingle();
  return data || { id: null, nome: nomeNatureza };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numero, user_id, return_raw } = await req.json();

    if (!numero) {
      return jsonResponse({ success: false, error: 'Número do precatório é obrigatório' }, 400);
    }

    const numeroLimpo = numero.replace(/\D/g, '');

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get API Key
    let configQuery = supabase.from('api_configurations').select('escavador_api_key, escavador_endpoint');
    if (user_id) configQuery = configQuery.eq('user_id', user_id);
    let { data: config } = await configQuery.maybeSingle();

    if (!config && !user_id) {
       const { data: fallback } = await supabase.from('api_configurations').select('escavador_api_key, escavador_endpoint').limit(1).maybeSingle();
       config = fallback;
    }

    if (!config?.escavador_api_key) {
      return jsonResponse({ success: false, error: 'API Key do Escavador não configurada.' });
    }

    const ESCAVADOR_API_KEY = config.escavador_api_key;
    const ESCAVADOR_ENDPOINT = config.escavador_endpoint || 'https://api.escavador.com/api/v2';
    const isV2 = ESCAVADOR_ENDPOINT.includes('/v2');
    
    let url = isV2 
      ? `${ESCAVADOR_ENDPOINT}/processos/numero_cnj/${encodeURIComponent(numero)}`
      : `${ESCAVADOR_ENDPOINT}/processo-tribunal/${numero}/async`;

    const fetchOptions: any = {
      method: isV2 ? 'GET' : 'POST',
      headers: {
        'Authorization': `Bearer ${ESCAVADOR_API_KEY}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    if (!isV2) fetchOptions.body = JSON.stringify({ send_callback: 0, wait: 1 });

    let response = await fetch(url, fetchOptions);
    
    if (isV2 && response.status === 404) {
        url = `${ESCAVADOR_ENDPOINT}/processos/numero_cnj/${numeroLimpo}`;
        response = await fetch(url, fetchOptions);
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return jsonResponse({ success: false, error: 'Resposta inválida do Escavador', details: responseText.substring(0, 500) });
    }

    if (!response.ok) {
      return jsonResponse({ success: false, error: data.error || data.message || `Erro ${response.status}`, details: data });
    }

    let parsed: any = null;
    const mainObj = data.resposta || data.processo || (Array.isArray(data) ? data[0] : data);
    
    if (isV2 && (mainObj.id || mainObj.numero_cnj || mainObj.fontes)) {
      parsed = parseEscavadorResponseV2(mainObj, numero);
    } else if (!isV2 && data.status === 'SUCESSO') {
      parsed = parseEscavadorResponseV1(data.resposta, numero);
    }

    if (parsed) {
      const natureInfo = await findNaturezaId(supabase, parsed.classe, parsed.assunto);
      parsed.natureza = natureInfo?.nome || null;
      parsed.natureza_id = natureInfo?.id || null;

      if (user_id) {
        const updateData: any = {
          nome_titular: parsed.nome_identificado,
          cpf: parsed.cpf_identificado,
          escavador_dados: parsed,
          status: parsed.cpf_identificado ? 'cpf_encontrado' : 'pendente',
          natureza: parsed.natureza,
          natureza_id: parsed.natureza_id,
          updated_at: new Date().toISOString()
        };
        await supabase.from('precatorios').update(updateData).eq('numero', numero).eq('user_id', user_id);
      }

      const resData: any = { success: true, encontrado: true, dados: parsed };
      if (return_raw) resData.raw_escavador = data;
      return jsonResponse(resData);
    }

    return jsonResponse({ success: true, encontrado: false, mensagem: 'Estrutura não reconhecida', details: data });
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
  const envolvidos = item.envolvidos || [];
  let cpf_identificado: string | null = null;
  let nome_identificado: string | null = null;

  envolvidos.forEach((env: any) => {
    const tipo = String(env.tipo_original || env.tipo || '').toUpperCase();
    const doc = env.documento || env.cpf;
    if ((tipo.includes('AUTOR') || tipo.includes('REQUERENTE')) && doc && (isValidCPF(doc) || isValidCNPJ(doc))) {
      cpf_identificado = doc;
      nome_identificado = env.nome;
    }
  });

  return {
    numero,
    encontrado: true,
    tribunal: item.tribunal?.nome || null,
    classe: item.classe || null,
    assunto: item.assunto?.nome || null,
    cpf_identificado,
    nome_identificado,
    partes: envolvidos.map((e: any) => `${e.nome} (${e.tipo_original || e.tipo || 'Parte'})`),
  };
}

function parseEscavadorResponseV2(data: any, numero: string) {
  const processo = data.processo || data;
  const fontes = processo.fontes || [];
  const primaryFonte = fontes[0] || {};
  const capa = primaryFonte.capa || processo.capa || {};
  
  const allEnvolvidos: any[] = [...(processo.envolvidos || [])];
  fontes.forEach((f: any) => {
    if (f.envolvidos) {
      allEnvolvidos.push(...f.envolvidos.map((e: any) => ({ ...e, tribunal: f.tribunal?.nome })));
    }
  });

  let cpf_identificado: string | null = null;
  let nome_identificado: string | null = null;
  let oab_identificado: string | null = null;

  const holderRoles = ['AUTOR', 'REQUERENTE', 'EXEQUENTE', 'RECLAMANTE', 'INTERESSADO', 'RECORRENTE', 'AGRAVANTE'];

  // FILTER HOLDERS FIRST
  const candidates = allEnvolvidos.filter(env => {
    const tipo = String(env.tipo_identificado || env.tipo_original || env.tipo || '').toUpperCase();
    return holderRoles.some(role => tipo.includes(role));
  });

  // PRIORITY 1: Holders with valid CPF/CNPJ
  for (const holder of candidates) {
    const doc = holder.documento || holder.cpf || holder.cnpj;
    if (doc && (isValidCPF(doc) || isValidCNPJ(doc))) {
      cpf_identificado = doc;
      nome_identificado = holder.nome || (typeof holder === 'string' ? holder : null);
      break;
    }
  }

  // PRIORITY 2: Any Holder (even without document)
  if (!nome_identificado && candidates.length > 0) {
    const firstHolder = candidates[0];
    nome_identificado = firstHolder.nome || (typeof firstHolder === 'string' ? firstHolder : null);
    cpf_identificado = firstHolder.documento || firstHolder.cpf || firstHolder.cnpj || null;
  }

  // ONLY IF ABSOLUTELY NO HOLDERS FOUND, FALLBACK TO OTHERS (BUT NOT ADVOGADOS IF POSSIBLE)
  if (!nome_identificado) {
    for (const env of allEnvolvidos) {
        const doc = env.documento || env.cpf || env.cnpj;
        const tipo = String(env.tipo_identificado || env.tipo_original || '').toUpperCase();
        if (doc && (isValidCPF(doc) || isValidCNPJ(doc)) && !tipo.includes('ADVOGADO') && !tipo.includes('PROCURADOR')) {
            cpf_identificado = doc;
            nome_identificado = env.nome;
            break;
        }
    }
  }

  // FINAL FALLBACK TO LAWYER ONLY IF NOTHING ELSE FOUND
  if (!nome_identificado) {
    const adv = allEnvolvidos.find(e => {
        const tipo = String(e.tipo_identificado || e.tipo_original || '').toUpperCase();
        return (tipo.includes('ADVOGADO') || tipo.includes('PROCURADOR')) && (e.documento || e.cpf || e.cnpj);
    });
    if (adv) {
      oab_identificado = adv.documento || adv.cpf || adv.cnpj;
      cpf_identificado = `ADV: ${oab_identificado}`;
      nome_identificado = adv.nome;
    }
  }

  return {
    numero,
    encontrado: true,
    tribunal: stringifyIfNeeded(processo.tribunal?.nome || primaryFonte.tribunal?.nome || processo.tribunal),
    orgao_julgador: stringifyIfNeeded(primaryFonte.unidade_judiciaria || primaryFonte.orgao_julgador || processo.orgao_julgador || primaryFonte.tribunal?.nome),
    classe: stringifyIfNeeded(capa.classe || processo.classe_natureza || processo.classe || primaryFonte.classe),
    assunto: stringifyIfNeeded(capa.assunto || processo.assunto_principal || primaryFonte.assunto_principal || (Array.isArray(processo.assuntos) ? processo.assuntos[0] : null)),
    data_publicacao: stringifyIfNeeded(processo.data_inicio || primaryFonte.data_inicio || primaryFonte.data_ultima_movimentacao),
    valor_causa: stringifyIfNeeded(capa.valor_causa || processo.valor_da_causa || primaryFonte.valor_da_causa),
    cpf_identificado,
    nome_identificado,
    oab_identificado,
    partes: [...new Set(allEnvolvidos.map(e => {
        const nome = e.nome || (typeof e === 'string' ? e : '');
        const tipo = e.tipo_original || e.tipo_identificado || e.tipo || 'Parte';
        return nome ? `${nome} (${tipo})` : '';
    }).filter(Boolean))],
  };
}
