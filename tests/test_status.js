const TOKEN = "ce75e21d-459b-421e-aabb-85376f84b318";
const BASE_URL = "https://sender.uazapi.com";

async function run() {
  console.log("Fetching status...");
  const res = await fetch(`${BASE_URL}/instance/status`, {
    headers: { token: TOKEN }
  });
  console.log(res.status, await res.text());
}

run();
