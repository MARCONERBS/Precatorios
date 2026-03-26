import fs from 'fs';

const url = "https://qngvpahklvjskttxqzkt.supabase.co/functions/v1/consultar-escavador";
const apikey = "sb_publishable_gr57BrfXzHdl0Pqd8zMiiQ_EJaLidcE";
const trf1File = 'trf1_2026.html';
const outputFile = 'cpfs_extraidos.csv';

async function run() {
    console.log("Lendo arquivo TRF1...");
    const html = fs.readFileSync(trf1File, 'utf8');
    const processes = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
        const rowContent = rowMatch[1];
        if (/colspan/i.test(rowContent)) continue;
        const cells = [];
        const cellRegex = /<td[^>]*?>([\s\S]*?)<\/td>/gi;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            const text = cellMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
            cells.push(text);
        }
        if (cells.length < 3) continue;
        const cleanValor = cells[2].replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
        const valor = parseFloat(cleanValor);
        if (!isNaN(valor) && valor > 100000) {
            processes.push({ numero: cells[1], valor: valor });
        }
        if (processes.length >= 1000) break;
    }

    console.log(`Iniciando consulta para ${processes.length} processos...`);
    fs.writeFileSync(outputFile, 'numero;valor;nome;cpf_documento;status\n');

    for (let i = 0; i < processes.length; i++) {
        const p = processes[i];
        console.log(`[${i+1}/1000] Consultando ${p.numero}...`);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apikey,
                    'Authorization': `Bearer ${apikey}`
                },
                body: JSON.stringify({ numero: p.numero })
            });

            const result = await response.json();
            
            if (result.success && result.encontrado) {
                const dados = result.dados;
                const line = `${p.numero};${p.valor};"${dados.nome_identificado || ''}";"${dados.cpf_identificado || ''}";"ENCONTRADO"\n`;
                fs.appendFileSync(outputFile, line);
                console.log(`   ✅ Encontrado: ${dados.nome_identificado}`);
            } else {
                fs.appendFileSync(outputFile, `${p.numero};${p.valor};"";"";"NAO_ENCONTRADO"\n`);
                console.log(`   ❌ Não encontrado ou erro.`);
            }
        } catch (err) {
            console.error(`   🔥 Erro fatal no processo ${p.numero}:`, err.message);
            fs.appendFileSync(outputFile, `${p.numero};${p.valor};"";"";"ERRO_API"\n`);
        }

        // Delay loop to respect rate limits (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log("Concluído! Resultados salvos em cpfs_extraidos.csv");
}

run();
