const ADMIN_TOKEN = "xv1Owe6xk6IceFnWDv0I609XMJflCO9djzHEwJkT43L62s56CL";
const BASE_URL = "https://sender.uazapi.com";

async function testCreate() {
  const name = "EVAAPI_TEST_" + Math.floor(Math.random() * 1000);
  console.log("Creating instance:", name);
  const res = await fetch(`${BASE_URL}/instance/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "admintoken": ADMIN_TOKEN
    },
    body: JSON.stringify({ Name: name, name: name, instanceName: name })
  });
  console.log("Status:", res.status);
  console.log(await res.text());
}

testCreate();
