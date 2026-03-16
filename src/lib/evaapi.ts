const API_URL = "https://sender.uazapi.com";
const ADMIN_TOKEN = "xv1Owe6xk6IceFnWDv0I609XMJflCO9djzHEwJkT43L62s56CL";

export interface InstanceStatus {
  instance: {
    status: "disconnected" | "connecting" | "connected";
    qrcode?: string;
  };
}

export const evaApi = {
  // --- Admin Methods ---
  getAdminHeaders() {
    return {
      "Content-Type": "application/json",
      admintoken: ADMIN_TOKEN,
    };
  },

  async createInstance(name: string) {
    const res = await fetch(`${API_URL}/instance/create`, {
      method: "POST",
      headers: this.getAdminHeaders(),
      body: JSON.stringify({ Name: name }),
    });
    if (!res.ok) throw new Error("Falha ao criar instância na EvaChat");
    return res.json();
  },

  async fetchInstances() {
    const res = await fetch(`${API_URL}/instance/all`, {
      method: "GET",
      headers: this.getAdminHeaders(),
    });
    if (!res.ok) throw new Error("Falha ao buscar instâncias");
    return res.json();
  },

  async deleteInstance(name: string) {
    let res = await fetch(`${API_URL}/instance/delete/${name}`, {
      method: "DELETE",
      headers: this.getAdminHeaders(),
    });
    
    if (res.status === 405) {
      // Tenta apagar via POST como fallback da UazaPI
      res = await fetch(`${API_URL}/instance/delete`, {
        method: "POST",
        headers: this.getAdminHeaders(),
        body: JSON.stringify({ instanceName: name })
      });
    }

    if (!res.ok) {
       // Falta de endpoint de exclusão físico, vamos apenas deslogar
       await fetch(`${API_URL}/instance/logout/${name}`, {
         method: "DELETE",
         headers: this.getAdminHeaders(),
       });
    }
  },

  // --- Instance Methods ---
  getInstanceHeaders(token: string) {
    return {
      "Content-Type": "application/json",
      token: token,
    };
  },

  async getStatus(token: string): Promise<InstanceStatus> {
    const res = await fetch(`${API_URL}/instance/status`, {
      method: "GET",
      headers: this.getInstanceHeaders(token),
    });
    if (!res.ok) throw new Error("Falha ao buscar status da EvaChat");
    return res.json();
  },

  async connectInstance(token: string): Promise<InstanceStatus> {
    const res = await fetch(`${API_URL}/instance/connect`, {
      method: "POST",
      headers: this.getInstanceHeaders(token),
    });
    if (!res.ok) throw new Error("Falha ao solicitar conexão web da EvaChat");
    return res.json();
  },

  async logoutInstance(token: string) {
    const res = await fetch(`${API_URL}/instance/logout`, {
      method: "DELETE",
      headers: this.getInstanceHeaders(token),
    });
    if (!res.ok) throw new Error("Falha ao deslogar a instância");
    return res.json();
  },

  async sendMessage(token: string, number: string, text: string) {
    const res = await fetch(`${API_URL}/send/text`, {
      method: "POST",
      headers: this.getInstanceHeaders(token),
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) throw new Error("Falha ao enviar mensagem");
    return res.json();
  },

  getSSEUrl(token: string): string {
    return `${API_URL}/sse?token=${token}`;
  },

  async getProfilePicture(token: string, number: string) {
    const res = await fetch(`${API_URL}/chat/details`, {
      method: "POST",
      headers: this.getInstanceHeaders(token),
      body: JSON.stringify({ number })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.image || data.imagePreview || null;
  }
};
