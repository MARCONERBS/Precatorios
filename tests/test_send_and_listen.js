const TOKEN = "ce75e21d-459b-421e-aabb-85376f84b318";
const BASE_URL = "https://sender.uazapi.com";
const NUMBER = "595992697333";

async function listen() {
  console.log("Starting SSE listener...");
  const res = await fetch(`${BASE_URL}/sse?token=${TOKEN}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    console.log("SSE CHUNK:\n", chunk);
  }
}

async function send() {
  console.log("Sending test message to", NUMBER);
  const res = await fetch(`${BASE_URL}/send/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: TOKEN,
    },
    body: JSON.stringify({ number: NUMBER, text: "Automated test message for SSE inspection" }),
  });
  console.log("Send status:", res.status, await res.text());
}

listen();
setTimeout(send, 2000);
setTimeout(() => process.exit(0), 10000); // exit after 10s
