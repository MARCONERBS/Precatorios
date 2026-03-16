const ADMIN_TOKEN = "xv1Owe6xk6IceFnWDv0I609XMJflCO9djzHEwJkT43L62s56CL";
const BASE_URL = "https://sender.uazapi.com";

async function verify() {
  console.log("Fetching all instances with apikey:");
  let res = await fetch(`${BASE_URL}/instance/fetchInstances`, {
    headers: {
      "apikey": ADMIN_TOKEN,
      "Authorization": `Bearer ${ADMIN_TOKEN}`
    }
  });
  console.log("Status Fetch:", res.status);
  console.log(await res.text());

  // Some endpoints use /instance/all or depends on Evolution API version
  // Let's try admintoken too if it failed
  if (res.status === 401 || res.status === 404) {
      console.log("Trying /instance/all with admintoken header:");
      res = await fetch(`${BASE_URL}/instance/all`, {
         headers: {
             "admintoken": ADMIN_TOKEN
         }
      });
      console.log("Status All:", res.status);
      console.log(await res.text());
  }
}

verify();
