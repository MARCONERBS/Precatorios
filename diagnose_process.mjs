const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkProcess(numero) {
  const url = `${SUPABASE_URL}/functions/v1/consultar-escavador`;
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ numero })
  };

  const res = await fetch(url, options);
  const data = await res.json();
  console.log('Result for', numero, ':');
  console.log(JSON.stringify(data, null, 2));
}

checkProcess('0168707-40.2025.4.01.9198');
