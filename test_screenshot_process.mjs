const url = "https://qngvpahklvjskttxqzkt.supabase.co/functions/v1/consultar-escavador";
const apikey = "sb_publishable_gr57BrfXzHdl0Pqd8zMiiQ_EJaLidcE";

async function test(numero) {
    console.log(`Chamando a função para o processo ${numero}...`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apikey,
                'Authorization': `Bearer ${apikey}`
            },
            body: JSON.stringify({ 
                numero: numero,
                user_id: "6cf3b215-2d4b-4aa6-a002-0612a9b80b39"
            })
        });
        
        const text = await response.text();
        console.log("Status:", response.status);
        console.log("Resultado:", text);
    } catch (err) {
        console.error("Erro na chamada:", err.message);
    }
}

// Processo do print
test("0168707-40.2025.4.01.9198");
