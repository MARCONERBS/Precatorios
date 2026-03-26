const url = "https://qngvpahklvjskttxqzkt.supabase.co/functions/v1/consultar-escavador";
const apikey = "sb_publishable_gr57BrfXzHdl0Pqd8zMiiQ_EJaLidcE";

async function test() {
    console.log("Chamando a função para o processo 2152200320244019198...");
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apikey,
                'Authorization': `Bearer ${apikey}`
            },
            body: JSON.stringify({ numero: "2152200320244019198" })
        });
        
        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Resultado:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Erro na chamada:", err.message);
    }
}

test();
