const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\Marcone\\AppData\\Local\\Temp\\trf1_2026.html';

try {
    const html = fs.readFileSync(filePath, 'utf8');
    const results = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
        const rowContent = rowMatch[1];
        if (/colspan/i.test(rowContent)) continue;

        const cells = [];
        const cellRegex = /<td[^>]*?>([\s\S]*?)<\/td>/gi;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            const text = cellMatch[1]
                .replace(/<[^>]*>/g, "")
                .replace(/&nbsp;/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            cells.push(text);
        }

        if (cells.length < 3) continue;
        const ordem = cells[0];
        const precatorio = cells[1];
        const valorStr = cells[2];

        if (!ordem || isNaN(Number(ordem))) continue;

        const cleanValor = valorStr.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
        const valor = parseFloat(cleanValor);

        if (!isNaN(valor) && valor > 100000) {
            results.push({ numero: precatorio, valor: valor });
        }
    }

    console.log(`Encontrados ${results.length} processos acima de R$ 100.000,00.`);
    console.log('--- AMOSTRA (10 primeiros) ---');
    results.slice(0, 10).forEach(r => {
        console.log(`Numero: ${r.numero} | Valor: ${r.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
    });

} catch (err) {
    console.error('Erro ao ler arquivo:', err.message);
}
