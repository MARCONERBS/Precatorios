const API_URL = "https://sender.uazapi.com";
const TOKEN = "VfR0AnNIdd8V"; // From previous successful tests/logs if available or common
const NUMBER = "554799967404"; 

async function testProfile() {
  const url = `${API_URL}/chat/profile-picture?number=${NUMBER}`;
  console.log(`Testing URL: ${url}`);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { token: TOKEN }
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
        const data = await res.json();
        console.log("Data:", JSON.stringify(data, null, 2));
    } else {
        const text = await res.text();
        console.log("Error body:", text);
    }
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

testProfile();
