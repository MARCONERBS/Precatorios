import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { QrCode, Smartphone, Loader2, Plus, LogOut, CheckCircle2, Trash2, Link as LinkIcon, RefreshCw, Server, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { evaApi } from "@/lib/evaapi";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function ConnectionPage() {
  const navigate = useNavigate();
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
      
      const mappedInstances = data?.map(i => ({
         name: i.name,
         token: i.token,
         status: "Verificando..." 
      })) || [];
      
      setInstances(mappedInstances);

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
      toast.error("Erro ao buscar instâncias existentes.");
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
      if (!userData.user) throw new Error("Usuário não autenticado");

      const data = await evaApi.createInstance(instanceName);
      if (data?.instance?.token) {
        const newToken = data.instance.token;

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
    if (!confirm(`Deseja realmente apagar a instância ${name}?`)) return;
    
    setDeletingId(instanceToken);
    try {
      const { error: dbError } = await supabase
         .from('evachat_instances')
         .delete()
         .eq('token', instanceToken);
         
      if (dbError) throw dbError;

      await evaApi.deleteInstance(name);
      toast.success("Instância removida com sucesso.");
      
      loadInstances();
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
        startStatusPolling(currentToken);
      } else if (data?.instance?.status === "connected") {
        setStatus("connected");
        stopQrRefresh();
        stopPolling();
      }
    } catch (err) {
      console.error("Falha ao atualizar QR Code", err);
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
    toast.info("Aba desvinculada.");
  };

  return (
    <div className="min-h-full flex flex-col bg-background p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground underline decoration-orange-500 decoration-4 underline-offset-4 mb-4">
          Conexão EvaChat
        </h1>
        <p className="text-muted-foreground text-sm font-medium max-w-2xl">
          Gerencie suas instâncias do WhatsApp. O Sistema Mogui utiliza tecnologia de ponta para manter suas conexões estáveis e seguras.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Actions & Tabs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-card border-4 border-border shadow-[6px_6px_0_0_rgba(17,17,17,1)] overflow-hidden">
            <div className="flex border-b-4 border-border">
              <button
                onClick={() => setActiveTab("new")}
                className={cn(
                  "flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === "new" 
                    ? "bg-primary text-white"
                    : "bg-background text-muted-foreground hover:bg-muted/30"
                )}
              >
                Nova Instância
              </button>
              <button
                onClick={() => { setActiveTab("existing"); loadInstances(); }}
                className={cn(
                  "flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === "existing" 
                    ? "bg-primary text-white"
                    : "bg-background text-muted-foreground hover:bg-muted/30"
                )}
              >
                Minhas Sessões
              </button>
            </div>

            <div className="p-6">
              {activeTab === "new" ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <Plus className="w-5 h-5 text-orange-500" strokeWidth={3} />
                    <h2 className="text-sm font-black uppercase tracking-widest">Criar Nova Conexão</h2>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    Dê um nome único para sua instância. Após a criação, você poderá vincular seu WhatsApp lendo o QR Code.
                  </p>
                  
                  <form onSubmit={handleCreateInstance} className="space-y-4">
                    <Input
                      placeholder="Ex: Comercial, Suporte..."
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="h-12 border-2 border-border shadow-[4px_4px_0_0_rgba(17,17,17,1)] focus-visible:ring-0 focus-visible:border-primary font-bold tracking-wider placeholder:text-muted-foreground/30 transition-all rounded-none"
                      disabled={isCreating}
                    />
                    <Button 
                      type="submit" 
                      className="w-full h-12 border-2 border-transparent hover:border-border rounded-none shadow-[4px_4px_0_0_rgba(17,17,17,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none font-black tracking-widest uppercase"
                      disabled={isCreating || !instanceName.trim()}
                    >
                      {isCreating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>INICIAR INSTÂNCIA <ArrowRight className="ml-2 w-4 h-4" /></>
                      )}
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                     <div className="flex items-center gap-3">
                        <Server className="w-5 h-5 text-blue-500" strokeWidth={3} />
                        <h2 className="text-sm font-black uppercase tracking-widest">Instâncias Ativas</h2>
                     </div>
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={loadInstances} 
                        disabled={isLoadingInstances} 
                        className="text-[10px] font-black uppercase"
                      >
                        <RefreshCw className={cn("w-3 h-3 mr-2", isLoadingInstances && "animate-spin")} />
                        RECARREGAR
                     </Button>
                  </div>
                  
                  {isLoadingInstances && instances.length === 0 ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : instances.length === 0 ? (
                    <div className="text-center p-8 border-4 border-dashed border-border bg-muted/10">
                      <p className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">Vazio</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                       {instances.map((inst) => (
                        <div key={inst.token} className="group flex flex-col p-4 border-2 border-border bg-background hover:bg-muted/20 transition-all shadow-[3px_3px_0_0_rgba(17,17,17,1)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-black uppercase tracking-wider text-xs">{inst.name}</span>
                            <div className="flex items-center gap-1.5">
                              <div className={cn(
                                "h-2 w-2 rounded-full",
                                inst.status === "connected" ? "bg-green-500 animate-pulse" : "bg-red-500"
                              )} />
                              <span className="text-[9px] font-black uppercase text-muted-foreground">{inst.status}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                             <Button 
                                onClick={() => handleExistingSelect(inst.token)}
                                className="flex-1 rounded-none font-black uppercase tracking-widest text-[10px] h-9 border-2 border-transparent hover:border-black transition-all"
                             >
                                <LinkIcon className="w-3 h-3 mr-2" />
                                VINCULAR ABA
                             </Button>
                             <Button 
                                onClick={() => handleDeleteInstance(inst.name, inst.token)}
                                variant="destructive" 
                                size="icon" 
                                disabled={deletingId === inst.token}
                                className="rounded-none border-2 border-transparent h-9 w-9"
                             >
                                {deletingId === inst.token ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                             </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Connection Display */}
        <div className="lg:col-span-7">
          <div className="bg-card border-4 border-border p-8 shadow-[8px_8px_0_0_rgba(17,17,17,1)] min-h-[500px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 -mr-16 -mt-16 rounded-full" />
            
            {!token ? (
              <div className="text-center space-y-6 max-w-sm">
                <div className="w-20 h-20 bg-muted/20 rounded-none border-4 border-border border-dashed flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest">Seleção Pendente</h3>
                <p className="text-xs text-muted-foreground font-medium uppercase leading-relaxed">
                  Selecione uma sessão existente ou crie uma nova para visualizar o status aqui.
                </p>
              </div>
            ) : status === "connected" ? (
              <div className="text-center space-y-8 py-10 animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-green-500 text-white rounded-none border-4 border-black shadow-[6px_6px_0_0_rgba(17,17,17,1)] flex items-center justify-center mx-auto relative">
                  <CheckCircle2 className="w-12 h-12" strokeWidth={3} />
                  <div className="absolute -top-2 -right-2 bg-black text-white px-2 py-0.5 text-[8px] font-black uppercase">Online</div>
                </div>
                
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-foreground mb-4">
                    WhatsApp <span className="text-green-500">Ativo</span>
                  </h2>
                  <p className="text-xs text-muted-foreground font-black uppercase tracking-widest max-w-[300px] mx-auto leading-loose">
                    Instância operando normalmente. Pronto para comunicações.
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <Button 
                    onClick={() => navigate("/evachat/chat")}
                    className="h-14 bg-orange-500 hover:bg-orange-600 text-white border-2 border-black rounded-none shadow-[4px_4px_0_0_rgba(17,17,17,1)] transition-all font-black tracking-widest uppercase text-lg"
                  >
                    ABRIR CHAT MOGUI
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={handleDisconnectLocally}
                    className="text-[10px] font-black uppercase text-muted-foreground hover:text-destructive underline underline-offset-4 decoration-2"
                  >
                    Desvincular Instância
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-8 py-10 flex flex-col items-center">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black uppercase tracking-tight">
                    {qrCode ? "CONECTAR APARELHO" : "SOLICITAR QR CODE"}
                  </h2>
                  <div className="h-1.5 w-24 bg-orange-500 mx-auto" />
                </div>
                
                {qrCode ? (
                  <div className="relative p-2 bg-white border-4 border-black shadow-[8px_8px_0_0_rgba(17,17,17,0.1)]">
                    <div className={cn(
                      "transition-all duration-500 p-2",
                      isRefreshingQr ? "opacity-30 blur-[2px]" : "opacity-100"
                    )}>
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                    </div>
                    {isRefreshingQr && (
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="bg-black text-white px-4 py-2 font-black uppercase tracking-widest text-[9px] shadow-[4px_4px_0_0_rgba(255,107,53,1)]">
                           Sincronizando...
                         </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-64 h-64 border-4 border-border border-dashed flex flex-col items-center justify-center bg-muted/10 space-y-4">
                    <QrCode className="w-12 h-12 text-muted-foreground/20" />
                    <Button 
                      onClick={() => handleConnect(token!)}
                      variant="outline"
                      className="border-2 rounded-none font-black uppercase tracking-widest text-[10px]"
                      disabled={isConnecting}
                    >
                      {isConnecting ? "GERANDO..." : "LIMPAR E GERAR QR"}
                    </Button>
                  </div>
                )}

                <div className="max-w-xs space-y-4">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider leading-relaxed">
                    Aponte seu celular com o WhatsApp aberto para o código acima para sincronizar sua conta.
                  </p>
                  
                  <Button 
                    variant="ghost" 
                    onClick={handleDisconnectLocally}
                    className="text-[10px] font-black uppercase text-muted-foreground border-2 border-transparent hover:border-border rounded-none"
                  >
                    CANCELAR
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
