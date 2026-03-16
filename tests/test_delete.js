const ADMIN_TOKEN = "xv1Owe6xk6IceFnWDv0I609XMJflCO9djzHEwJkT43L62s56CL";
const BASE_URL = "https://sender.uazapi.com";

async function run() {
  const toDelete = "EVAAPI_TEST_519";
  
  console.log("Trying DELETE with /instance/delete (body)");
  const res1 = await fetch(`${BASE_URL}/instance/delete`, {
    method: "DELETE",
    headers: { admintoken: ADMIN_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ Name: toDelete, instanceName: toDelete })
  });
  console.log(res1.status, await res1.text());

  console.log("Trying POST with /instance/delete");
  const res2 = await fetch(`${BASE_URL}/instance/delete`, {
    method: "POST",
    headers: { admintoken: ADMIN_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ Name: toDelete, instanceName: toDelete })
  });
  console.log(res2.status, await res2.text());
  
  console.log("Trying DELETE with /instance/logout/Name");
  const res3 = await fetch(`${BASE_URL}/instance/logout/${toDelete}`, {
    method: "DELETE",
    headers: { admintoken: ADMIN_TOKEN }
  });
  console.log(res3.status, await res3.text());
}

run();
