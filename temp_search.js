const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: Chaves não encontradas no .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    console.log('Pesquisando processos com valor > 100.000...');
    const { data, error, count } = await supabase
        .from('precatorios')
        .select('numero, valor', { count: 'exact' })
        .gt('valor', 100000)
        .limit(20);

    if (error) {
        console.error('Erro na busca:', error.message);
        return;
    }

    console.log(`Encontrados no total: ${count}`);
    console.log('Amostra dos primeiros 20:');
    console.table(data);
}

search();
