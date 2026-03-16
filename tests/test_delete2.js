const ADMIN_TOKEN = "xv1Owe6xk6IceFnWDv0I609XMJflCO9djzHEwJkT43L62s56CL";
const BASE_URL = "https://sender.uazapi.com";

async function run() {
  const toDelete = "EVAAPI_TEST_519";
  const toDelete2 = "EVAAPI_TEST_225";
  
  // Test DELETE /instance/delete/:name
  const res1 = await fetch(`${BASE_URL}/instance/delete/${toDelete}`, {
    method: "DELETE",
    headers: { apikey: ADMIN_TOKEN }
  });
  console.log("DELETE /instance/delete/:name (apikey) ->", res1.status, await res1.text());

  // Test DELETE /instance/delete/:name with admintoken
  const res2 = await fetch(`${BASE_URL}/instance/delete/${toDelete2}`, {
    method: "DELETE",
    headers: { admintoken: ADMIN_TOKEN }
  });
  console.log("DELETE /instance/delete/:name (admintoken) ->", res2.status, await res2.text());
}

run();
