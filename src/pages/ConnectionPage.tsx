import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { QrCode, Smartphone, Loader2, Plus, LogOut, CheckCircle2, Trash2, Link as LinkIcon, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { evaApi } from "@/lib/evaapi";
import { supabase } from "@/integrations/supabase/client";

export default function ConnectionPage() {
  const [instanceName, setInstanceName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  
  // Create / List modes
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");
  const [isCreating, setIsCreating] = useState(false);
  
  // Existing Instances
  const [instances, setInstances] = useState<any[]>([]);
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);

  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const qrRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("evachat_token");
    if (savedToken) {
      setToken(savedToken);
      checkStatus(savedToken);
      startStatusPolling(savedToken);
    } else {
      loadInstances();
    }
    return () => {
      stopPolling();
      stopQrRefresh();
    };
  }, []);

  const loadInstances = async () => {
    setIsLoadingInstances(true);
    try {
      const { data, error } = await supabase
        .from('evachat_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Data in supbase has name and token, we map it to match UI expectations
      const mappedInstances = data?.map(i => ({
         name: i.name,
         token: i.token,
         status: "Verificando..." // Initial generic status until clicked
      })) || [];
      
      setInstances(mappedInstances);

      // Async fetch actual live status from UazaPi for each instance
      mappedInstances.forEach(async (inst) => {
         try {
            const st = await evaApi.getStatus(inst.token);
            setInstances(prev => prev.map(p => 
              p.token === inst.token ? { ...p, status: st.instance?.status || "disconnected" } : p
            ));
         } catch {
            setInstances(prev => prev.map(p => 
              p.token === inst.token ? { ...p, status: "offline/error" } : p
            ));
         }
      });
      
    } catch (err) {
      toast.error("Erro ao buscar instâncias existentes no banco de dados.");
    } finally {
      setIsLoadingInstances(false);
    }
  };

  const startStatusPolling = (currentToken: string) => {
    stopPolling();
    pollInterval.current = setInterval(() => checkStatus(currentToken), 5000);
  };

  const stopPolling = () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
  };

  const startQrRefresh = (currentToken: string) => {
    stopQrRefresh();
    // Refresh QR code every 25 seconds if still connecting
    qrRefreshInterval.current = setInterval(() => {
      refreshQrCode(currentToken);
    }, 25000);
  };

  const stopQrRefresh = () => {
    if (qrRefreshInterval.current) clearInterval(qrRefreshInterval.current);
  };

  const checkStatus = async (currentToken: string) => {
    try {
      const data = await evaApi.getStatus(currentToken);
      const newStatus = data.instance?.status || "disconnected";
      setStatus(newStatus);
      
      if (newStatus === "connected") {
        stopPolling();
        stopQrRefresh();
        setQrCode(null);
      } else if (newStatus === "connecting") {
        if (data.instance?.qrcode) {
           setQrCode(data.instance.qrcode);
        }
      } else {
        stopQrRefresh();
      }
    } catch (err) {
      console.error(err);
      setStatus("disconnected");
      stopQrRefresh();
    }
  };

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceName.trim()) return;

    setIsCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
         throw new Error("Usuário não autenticado");
      }

      const data = await evaApi.createInstance(instanceName);
      if (data?.instance?.token) {
        const newToken = data.instance.token;

        // Save to Supabase DB so the user owns this instance
        const { error: dbError } = await supabase.from('evachat_instances').insert({
           name: instanceName,
           token: newToken,
           user_id: userData.user.id
        });

        if (dbError) throw dbError;

        linkToken(newToken);
        toast.success("Instância criada com sucesso!");
        handleConnect(newToken); 
      } else {
        throw new Error("Token não retornado pela API");
      }
    } catch (err) {
      toast.error("Erro ao criar instância.");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const linkToken = (newToken: string) => {
    localStorage.setItem("evachat_token", newToken);
    setToken(newToken);
  };

  const handleExistingSelect = (selectedToken: string) => {
    linkToken(selectedToken);
    checkStatus(selectedToken);
    startStatusPolling(selectedToken);
  };

  const handleDeleteInstance = async (name: string, instanceToken: string) => {
    if (!confirm(`Deseja realmente apagar e desconectar a instância ${name}?`)) return;
    
    setDeletingId(instanceToken);
    try {
      // 1. Apagar do Supabase
      const { error: dbError } = await supabase
         .from('evachat_instances')
         .delete()
         .eq('token', instanceToken);
         
      if (dbError) throw dbError;

      // 2. Apagar da UazaPI
      await evaApi.deleteInstance(name);
      toast.success("Instância removida com sucesso.");
      
      loadInstances();
      // Se for a mesma que estou usando, desloga localmente
      if (token === instanceToken) {
        handleDisconnectLocally();
      }
    } catch (err) {
      toast.error("Erro ao remover instância.");
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const refreshQrCode = async (currentToken: string) => {
    setIsRefreshingQr(true);
    try {
      const data = await evaApi.connectInstance(currentToken);
      if (data?.instance?.qrcode) {
        setQrCode(data.instance.qrcode);
        setStatus("connecting");
        // Reinicia o poll caso tenha parado
        startStatusPolling(currentToken);
      } else if (data?.instance?.status === "connected") {
        setStatus("connected");
        stopQrRefresh();
        stopPolling();
      }
    } catch (err) {
      console.error("Falha ao atualizar QR Code invisivelmente", err);
    } finally {
      setIsRefreshingQr(false);
    }
  };

  const handleConnect = async (currentToken: string) => {
    setIsConnecting(true);
    try {
      const data = await evaApi.connectInstance(currentToken);
      if (data?.instance?.qrcode) {
        setQrCode(data.instance.qrcode);
        setStatus("connecting");
        startStatusPolling(currentToken);
        startQrRefresh(currentToken);
      } else if (data?.instance?.status === "connected") {
        setStatus("connected");
        toast.success("WhatsApp já está conectado!");
      }
    } catch (err) {
      toast.error("Falha ao gerar QR Code");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectLocally = () => {
    localStorage.removeItem("evachat_token");
    setToken(null);
    setStatus("disconnected");
    setQrCode(null);
    stopPolling();
    stopQrRefresh();
    loadInstances();
    toast.info("Aba desvinculada. Escolha uma instância.");
  };

  return (
    <div className="h-full flex flex-col bg-background p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-2">
          Conexão EvaChat
        </h1>
        <p className="text-muted-foreground font-medium max-w-2xl">
          Gerencie suas instâncias do WhatsApp. Crie conexões novas, vincule sessões existentes ou remova as antigas. O QR Code atualiza automaticamente para não expirar!
        </p>
      </div>

      <div className="flex-1 flex items-start justify-center pt-8">
        <div className="w-full max-w-xl bg-card border-4 border-border p-8 shadow-[8px_8px_0_0_rgba(17,17,17,1)] transition-all">
          
          {/* STATE 1: NO TOKEN BOUND */}
          {!token && (
            <div className="space-y-6">
              <div className="flex border-b-4 border-border mb-6">
                <button
                  onClick={() => setActiveTab("new")}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all",
                    activeTab === "new" 
                      ? "bg-primary text-primary-foreground border-b-4 border-primary -mb-1"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  Criar Nova
                </button>
                <button
                  onClick={() => { setActiveTab("existing"); loadInstances(); }}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all",
                    activeTab === "existing" 
                      ? "bg-primary text-primary-foreground border-b-4 border-primary -mb-1"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  Existentes
                </button>
              </div>

              {activeTab === "new" && (
                <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Plus className="w-8 h-8 text-primary" strokeWidth={3} />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Criar Instância</h2>
                  <p className="text-sm text-muted-foreground font-medium px-8">
                    Dê um nome para a sua nova conexão. Será gerado um container dedicado no servidor para acoplar seu WhatsApp.
                  </p>
                  
                  <form onSubmit={handleCreateInstance} className="w-full space-y-4">
                    <Input
                      placeholder="Ex: Pessoal, Setor A..."
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="h-14 border-2 border-border shadow-[4px_4px_0_0_rgba(17,17,17,1)] focus-visible:ring-0 focus-visible:border-primary font-bold tracking-wider placeholder:text-muted-foreground/50 transition-all rounded-none text-center text-lg"
                      disabled={isCreating}
                    />
                    <Button 
                      type="submit" 
                      className="w-full h-14 border-2 border-transparent hover:border-border rounded-none shadow-[4px_4px_0_0_rgba(17,17,17,1)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(17,17,17,1)] font-black tracking-widest uppercase text-lg"
                      disabled={isCreating || !instanceName.trim()}
                    >
                      {isCreating ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        "CRIAR E VINCULAR"
                      )}
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === "existing" && (
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-black uppercase tracking-tight">Suas Instâncias</h2>
                     <Button variant="outline" size="sm" onClick={loadInstances} disabled={isLoadingInstances} className="border-2 rounded-none font-bold uppercase tracking-widest text-xs h-8">
                        <RefreshCw className={cn("w-3 h-3 mr-2", isLoadingInstances && "animate-spin")} />
                        Atualizar
                     </Button>
                  </div>
                  
                  {isLoadingInstances && instances.length === 0 ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : instances.length === 0 ? (
                    <div className="text-center p-8 border-4 border-dashed border-border bg-muted/20">
                      <Server className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="font-bold uppercase tracking-widest text-muted-foreground text-sm">Nenhuma instância encontrada</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                      {instances.map((inst) => (
                        <div key={inst.token} className="flex items-center justify-between p-4 border-2 border-border bg-card hover:bg-muted/30 transition-colors shadow-[2px_2px_0_0_rgba(17,17,17,1)]">
                          <div>
                            <p className="font-black uppercase tracking-widest text-foreground">{inst.name}</p>
                            <p className="text-xs font-bold font-mono text-muted-foreground mt-1">Status: {inst.status || "desconhecido"}</p>
                          </div>
                          <div className="flex gap-2">
                             <Button 
                               onClick={() => handleDeleteInstance(inst.name, inst.token)}
                               variant="ghost" 
                               size="icon" 
                               disabled={deletingId === inst.token}
                               className="text-destructive hover:bg-destructive hover:text-white rounded-none border-2 border-transparent transition-colors"
                             >
                               {deletingId === inst.token ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                             </Button>
                             <Button 
                               onClick={() => handleExistingSelect(inst.token)}
                               className="rounded-none font-bold uppercase tracking-widest text-xs h-10 border-2 border-transparent hover:border-primary hover:bg-primary/10 hover:text-primary transition-all shadow-[2px_2px_0_0_rgba(17,17,17,1)]"
                             >
                               <LinkIcon className="w-4 h-4 mr-2" />
                               Vincular
                             </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STATE 2: TOKEN BOUND, SHOWING QR OR CONNECT STATUS */}
          {token && status !== "connected" && (
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <QrCode className="w-8 h-8 text-primary" strokeWidth={2} />
              </div>
              
              <h2 className="text-2xl font-black uppercase tracking-tight">
                {qrCode ? "Leia o QR Code" : "Vincular WhatsApp"}
              </h2>
              
              <p className="text-sm text-muted-foreground font-medium px-4">
                {qrCode 
                  ? "Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e aponte a câmera para o código abaixo. O código atualiza automaticamente."
                  : "A instância está vinculada a esta aba. Solicite o QR Code para parear o seu aparelho."}
              </p>

              {qrCode ? (
                <div className="relative">
                  <div className={cn(
                    "bg-white p-4 border-4 border-border shadow-[4px_4px_0_0_rgba(255,255,255,1)] transition-opacity duration-300",
                    isRefreshingQr ? "opacity-50 grayscale" : "opacity-100"
                  )}>
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                  </div>
                  {isRefreshingQr && (
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="bg-primary text-primary-foreground px-4 py-2 font-bold uppercase tracking-widest text-xs border-2 shadow-[2px_2px_0_0_rgba(17,17,17,1)] shadow-black">
                         Atualizando QR...
                       </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  onClick={() => handleConnect(token)}
                  className="w-full h-14 bg-primary text-primary-foreground border-2 border-transparent hover:border-border rounded-none shadow-[4px_4px_0_0_rgba(17,17,17,1)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(17,17,17,1)] font-black tracking-widest uppercase text-lg"
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    "GERAR QR CODE"
                  )}
                </Button>
              )}

              <Button 
                variant="ghost" 
                onClick={handleDisconnectLocally}
                className="text-xs uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 border-2 border-transparent hover:border-border rounded-none"
              >
                Voltar à Lista de Instâncias
              </Button>
            </div>
          )}

          {/* STATE 3: CONNECTED */}
          {token && status === "connected" && (
            <div className="flex flex-col items-center text-center space-y-6 py-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-2 border-4 border-green-500 shadow-[4px_4px_0_0_rgba(34,197,94,1)]">
                <CheckCircle2 className="w-10 h-10 text-green-500" strokeWidth={3} />
              </div>
              
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight text-foreground mb-2">
                  Conectado!
                </h2>
                <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
                  Instância Ativa e Pareada com Sucesso
                </p>
              </div>

              <div className="w-full pt-8 space-y-4 border-t-2 border-border mt-4">
                <p className="text-sm font-medium text-muted-foreground px-4 pb-2">
                  Você já pode acessar o menu <b>Chat</b> para conversar. Para gerenciar outra instância, desvincule esta aba primeiro.
                </p>
                <Button 
                  variant="outline"
                  onClick={handleDisconnectLocally}
                  className="w-full h-12 border-2 border-destructive text-destructive hover:bg-destructive hover:text-white rounded-none shadow-[4px_4px_0_0_rgba(239,68,68,1)] transition-all font-bold tracking-widest uppercase"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Desvincular e Listar Outras
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
