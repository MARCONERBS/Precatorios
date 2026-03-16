import { useState, useEffect, useRef, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Send, Plus, MessageSquare, Trash2, AlertTriangle, BookOpen, Copy, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { evaApi } from "@/lib/evaapi";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  text: string;
  sender: "user" | "lead";
  time: string;
}

interface Contact {
  id: string;
  nome: string;
  numero: string;
  lastMessage?: string;
  timestamp?: string;
  avatarUrl?: string | null;
  status: "pendente" | "aberto";
  dbId?: string;
}

type StatusFilter = "todos" | "pendente" | "aberto";


export default function ChatPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [instanceDbId, setInstanceDbId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messagesByContact, setMessagesByContact] = useState<Record<string, Message[]>>({});
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [newChatNumber, setNewChatNumber] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [isSseConnected, setIsSseConnected] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const instanceDbIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<any>(null);
  const contactListRef = useRef<Contact[]>([]);

  useEffect(() => { contactListRef.current = contacts; }, [contacts]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      userRef.current = user;
      const savedToken = localStorage.getItem("evachat_token");
      setToken(savedToken);
      tokenRef.current = savedToken;
      if (savedToken && user) {
        const { data: instData } = await supabase
          .from("evachat_instances").select("id").eq("token", savedToken).maybeSingle();
        if (instData) {
          setInstanceDbId(instData.id);
          instanceDbIdRef.current = instData.id;
          loadHistory(instData.id);
          connectSSE(savedToken);
        }
      }
    };
    init();
    return () => { eventSourceRef.current?.close(); };
  }, []);

  const loadHistory = async (instId: string) => {
    try {
      const { data: dbContacts } = await supabase
        .from("evachat_contacts").select("*").eq("instance_id", instId).order("updated_at", { ascending: false });
      if (!dbContacts || dbContacts.length === 0) return;

      setContacts(dbContacts.map((c) => ({
        id: c.wa_id, nome: c.nome || c.wa_id, numero: c.numero || c.wa_id,
        lastMessage: c.last_message || "", avatarUrl: c.avatar_url,
        timestamp: c.last_timestamp ? new Date(c.last_timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        status: c.status as "pendente" | "aberto", dbId: c.id,
      })));

      const { data: dbMsgs } = await supabase
        .from("evachat_messages").select("*").in("contact_id", dbContacts.map((c) => c.id)).order("timestamp", { ascending: true });
      if (!dbMsgs) return;

      const grouped: Record<string, Message[]> = {};
      dbMsgs.forEach((m) => {
        const contact = dbContacts.find((c) => c.id === m.contact_id);
        if (contact) {
          if (!grouped[contact.wa_id]) grouped[contact.wa_id] = [];
          grouped[contact.wa_id].push({
            id: m.wa_message_id || m.id, text: m.text, sender: m.sender as "user" | "lead",
            time: new Date(m.timestamp || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        }
      });
      setMessagesByContact(grouped);
    } catch (e) { console.error("loadHistory:", e); }
  };


  const fetchAvatar = async (instanceToken: string, waId: string) => {
    try {
      const url = await evaApi.getProfilePicture(instanceToken, waId);
      if (url) {
        setContacts((prev) => prev.map((c) => (c.id === waId ? { ...c, avatarUrl: url } : c)));
        if (instanceDbIdRef.current)
          await supabase.from("evachat_contacts").update({ avatar_url: url })
            .eq("instance_id", instanceDbIdRef.current).eq("wa_id", waId);
      }
    } catch { /* ignore */ }
  };

  const persistInbound = async (waId: string, name: string, text: string, msgId: string, tsMs: number) => {
    const instId = instanceDbIdRef.current;
    const user = userRef.current;
    if (!instId || !user) { console.warn("persistInbound: refs missing"); return; }
    try {
      const { error: uErr } = await supabase.from("evachat_contacts").upsert(
        { instance_id: instId, user_id: user.id, wa_id: waId, nome: name, numero: waId,
          last_message: text, last_timestamp: new Date(tsMs).toISOString(), status: "pendente" },
        { onConflict: "instance_id,wa_id" }
      );
      if (uErr) { console.error("persistInbound upsert:", uErr); return; }

      const { data: cRow } = await supabase.from("evachat_contacts").select("id")
        .eq("instance_id", instId).eq("wa_id", waId).single();
      if (!cRow) { console.error("persistInbound: no contact row"); return; }

      const { error: mErr } = await supabase.from("evachat_messages").insert({
        contact_id: cRow.id, user_id: user.id, wa_message_id: msgId,
        text, sender: "lead", timestamp: new Date(tsMs).toISOString(),
      });
      if (mErr && mErr.code !== "23505") console.error("persistInbound insert:", mErr);
    } catch (e) { console.error("persistInbound exception:", e); }
  };

  const connectSSE = (instanceToken: string) => {
    eventSourceRef.current?.close();
    const es = new EventSource(evaApi.getSSEUrl(instanceToken));
    eventSourceRef.current = es;
    es.onopen = () => setIsSseConnected(true);
    es.onerror = () => setIsSseConnected(false);

    es.onmessage = (event) => {
      try {
        if (!event.data || event.data.trim() === "") return;
        const data = JSON.parse(event.data);
        if (data.EventType !== "messages" || !data.message) return;

        const msg = data.message;
        if (!msg.chatid || msg.chatid.includes("status@broadcast")) return;

        const waId = msg.chatid.split("@")[0];
        const text = (msg.content?.text || msg.text || "").trim();
        if (!text) return;

        const isFromMe = !!msg.fromMe;
        const senderName = (msg.senderName || data.chat?.name || waId) as string;

        const rawTs = msg.messageTimestamp;
        const tsMs = rawTs
          ? rawTs > 1_000_000_000_000 ? rawTs : rawTs * 1000
          : Date.now();

        const msgId = (msg.messageid || msg.id || `sse-${tsMs}-${waId}`).toString();

        const newMsg: Message = {
          id: msgId, text,
          sender: isFromMe ? "user" : "lead",
          time: new Date(tsMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessagesByContact((prev) => {
          const chatMsgs = prev[waId] || [];
          if (chatMsgs.some((m) => m.id === msgId)) return prev;
          if (isFromMe) {
            const tempIdx = chatMsgs.findIndex((m) => m.id.startsWith("temp-") && m.text === text);
            if (tempIdx !== -1) {
              const updated = [...chatMsgs];
              updated[tempIdx] = newMsg;
              return { ...prev, [waId]: updated };
            }
            return prev;
          }
          return { ...prev, [waId]: [...chatMsgs, newMsg] };
        });

        setContacts((prev) => {
          const nextStatus: "pendente" | "aberto" = isFromMe ? "aberto" : "pendente";
          const idx = prev.findIndex((c) => c.id === waId);
          if (idx !== -1) {
            const updated = prev.map((c) => c.id === waId
              ? { ...c, lastMessage: text, timestamp: newMsg.time, nome: senderName !== waId ? senderName : c.nome, status: nextStatus }
              : c);
            const [moved] = updated.splice(idx, 1);
            return [moved, ...updated];
          }
          return [{ id: waId, nome: senderName, numero: waId, lastMessage: text, status: nextStatus, timestamp: newMsg.time }, ...prev];
        });

        if (!isFromMe) persistInbound(waId, senderName, text, msgId, tsMs);

        const tok = tokenRef.current;
        if (tok && !contactListRef.current.find((c) => c.id === waId)?.avatarUrl)
          fetchAvatar(tok, waId);
      } catch (err) { console.error("SSE parse error:", err); }
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const instId = instanceDbIdRef.current;
    const user = userRef.current;
    const tok = tokenRef.current;
    if (!messageText.trim() || !selectedContactId || !tok || !instId || !user) return;

    const sendingText = messageText;
    const currentId = selectedContactId;
    const contact = contactListRef.current.find((c) => c.id === currentId);
    setMessageText("");

    const tempId = `temp-${Date.now()}`;
    const tsLocal = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessagesByContact((prev) => ({
      ...prev, [currentId]: [...(prev[currentId] || []), { id: tempId, text: sendingText, sender: "user", time: tsLocal }],
    }));
    setContacts((prev) => prev.map((c) => c.id === currentId ? { ...c, lastMessage: sendingText, timestamp: tsLocal, status: "aberto" as const } : c));

    try {
      const data = await evaApi.sendMessage(tok, currentId, sendingText);
      const realId = (data.messageid || data.id || Date.now().toString()).toString();

      setMessagesByContact((prev) => {
        const chatMsgs = prev[currentId] || [];
        if (chatMsgs.some((m) => m.id === realId))
          return { ...prev, [currentId]: chatMsgs.filter((m) => m.id !== tempId) };
        return { ...prev, [currentId]: chatMsgs.map((m) => (m.id === tempId ? { ...m, id: realId } : m)) };
      });

      const { error: uErr } = await supabase.from("evachat_contacts").upsert(
        { instance_id: instId, user_id: user.id, wa_id: currentId, nome: contact?.nome || currentId,
          numero: currentId, last_message: sendingText, last_timestamp: new Date().toISOString(), status: "aberto" },
        { onConflict: "instance_id,wa_id" }
      );
      if (uErr) { console.error("send upsert:", uErr); return; }

      const { data: cRow } = await supabase.from("evachat_contacts").select("id")
        .eq("instance_id", instId).eq("wa_id", currentId).single();
      if (cRow) {
        const { error: mErr } = await supabase.from("evachat_messages").insert({
          contact_id: cRow.id, user_id: user.id, wa_message_id: realId,
          text: sendingText, sender: "user", timestamp: new Date().toISOString(),
        });
        if (mErr && mErr.code !== "23505") console.error("send insert:", mErr);
      }
    } catch (err) {
      toast.error("Erro ao enviar.");
      setMessageText(sendingText);
      setMessagesByContact((prev) => ({ ...prev, [currentId]: (prev[currentId] || []).filter((m) => m.id !== tempId) }));
    }
  };

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    const num = newChatNumber.replace(/\D/g, "");
    if (!num) return;
    setSelectedContactId(num);
    setIsCreatingChat(false);
    setNewChatNumber("");
    if (!contacts.find((c) => c.id === num)) {
      setContacts((prev) => [{ id: num, nome: num, numero: num, lastMessage: "", timestamp: "", status: "aberto" }, ...prev]);
      if (tokenRef.current) fetchAvatar(tokenRef.current, num);
    }
  };

  // ─── Delete handlers ──────────────────────────────────────────────────────
  const handleDeleteContact = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setContactToDelete(contact);
  };

  const confirmDeleteContact = async () => {
    const contact = contactToDelete;
    setContactToDelete(null);
    if (!contact) return;
    if (contact.dbId) {
      await supabase.from("evachat_messages").delete().eq("contact_id", contact.dbId);
      await supabase.from("evachat_contacts").delete().eq("id", contact.dbId);
    }
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    setMessagesByContact((prev) => { const next = { ...prev }; delete next[contact.id]; return next; });
    if (selectedContactId === contact.id) setSelectedContactId(null);
    toast.success("Conversa excluída com sucesso.");
  };

  const currentMessages = selectedContactId ? messagesByContact[selectedContactId] || [] : [];
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [currentMessages.length]);

  if (token === null) return null;
  if (token === "") return (
    <div className="h-full flex items-center justify-center p-10">
      <div className="text-center border-4 border-dashed border-border p-12 max-w-md">
        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" strokeWidth={1} />
        <p className="font-black uppercase tracking-widest opacity-50">Conecte sua instância primeiro.</p>
      </div>
    </div>
  );

  return (
    <Fragment>
      <div className="h-[calc(100vh-5rem)] flex flex-col bg-background p-6 overflow-hidden">
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-3xl font-black uppercase tracking-tighter">EvaChat Live</h1>
          <p className="text-xs font-bold flex items-center gap-2 mt-1 uppercase">
            <span className={cn("w-2 h-2 rounded-full", isSseConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
            {isSseConnected ? "Recebendo em tempo real" : "Reconectando..."}
          </p>
        </div>

        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
          {/* ── Contact sidebar ── */}
          <div className="w-80 bg-card border-4 border-border flex flex-col shadow-[4px_4px_0_0_rgba(17,17,17,1)] overflow-hidden flex-shrink-0">
            <div className="p-4 border-b-4 border-border bg-muted/30 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold uppercase tracking-widest text-sm">Conversas</h2>
                <Button onClick={() => setIsCreatingChat(!isCreatingChat)} variant="outline" size="icon"
                  className="h-8 w-8 rounded-none border-2 shadow-[2px_2px_0_0_rgba(17,17,17,1)] active:shadow-none transition-none">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {isCreatingChat && (
                <form onSubmit={handleStartChat} className="flex gap-2 mb-3">
                  <Input value={newChatNumber} onChange={(e) => setNewChatNumber(e.target.value)} placeholder="DDD + Número" className="rounded-none border-2 h-9 text-xs" />
                  <Button type="submit" size="sm" className="rounded-none h-9 px-3">OK</Button>
                </form>
              )}
              <div className="flex border-2 border-border overflow-hidden">
                {(["todos", "pendente", "aberto"] as StatusFilter[]).map((f) => (
                  <button key={f} onClick={() => setStatusFilter(f)}
                    className={cn("flex-1 py-1.5 text-[10px] font-black uppercase tracking-tighter border-r-2 last:border-r-0",
                      statusFilter === f ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                    {f === "todos" ? "Todos" : f === "pendente" ? "Pendentes" : "Abertos"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {contacts.filter((c) => statusFilter === "todos" || c.status === statusFilter).map((contact) => (
                /* ── Contact card with slide-reveal delete button ── */
                <div key={contact.id} className="group relative overflow-hidden">
                  {/* Main card — slides left on hover to reveal delete */}
                  <button
                    onClick={() => setSelectedContactId(contact.id)}
                    className={cn(
                      "w-full text-left p-3 border-2 flex gap-3 items-center",
                      "transition-transform duration-200 ease-out",
                      "group-hover:-translate-x-10",
                      selectedContactId === contact.id
                        ? "border-primary bg-primary/5 shadow-[2px_2px_0_0_rgba(11,11,11,1)]"
                        : "border-transparent hover:border-border hover:bg-muted/50"
                    )}>
                    <div className="w-10 h-10 border-2 border-border flex-shrink-0 bg-muted flex items-center justify-center overflow-hidden">
                      {contact.avatarUrl
                        ? <img src={contact.avatarUrl} className="w-full h-full object-cover" />
                        : <span className="font-black text-xs font-mono">{contact.nome.substring(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm truncate uppercase">{contact.nome}</span>
                        <span className="text-[10px] opacity-50 ml-2 flex-shrink-0">{contact.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] opacity-70 truncate flex-1">{contact.lastMessage}</p>
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", contact.status === "pendente" ? "bg-red-500" : "bg-green-500")} />
                      </div>
                    </div>
                  </button>

                  {/* Slide-in delete button — revealed when card slides left */}
                  <button
                    onClick={(e) => handleDeleteContact(contact, e)}
                    title="Excluir conversa"
                    className={cn(
                      "absolute right-0 top-0 h-full w-10",
                      "flex flex-col items-center justify-center gap-0.5",
                      "bg-red-600 text-white",
                      "translate-x-10 group-hover:translate-x-0",
                      "transition-transform duration-200 ease-out",
                      "hover:bg-red-700 active:bg-red-800 active:scale-95"
                    )}>
                    <Trash2 className="w-4 h-4" />
                    <span className="text-[7px] font-black uppercase tracking-widest leading-none">del</span>
                  </button>
                </div>
              ))}
              {contacts.filter((c) => statusFilter === "todos" || c.status === statusFilter).length === 0 && (
                <div className="p-8 text-center text-[10px] font-bold uppercase opacity-20">Vazio</div>
              )}
            </div>
          </div>

          {/* ── Chat area ── */}
          <div className="flex-1 bg-card border-4 border-border flex flex-col shadow-[4px_4px_0_0_rgba(17,17,17,1)] overflow-hidden">
            {selectedContactId ? (
              <>
                <div className="p-4 border-b-4 border-border bg-muted/30 flex items-center gap-3 flex-shrink-0">
                  <div className="w-10 h-10 border-2 border-primary flex-shrink-0 bg-primary/10 flex items-center justify-center overflow-hidden font-bold">
                    {contacts.find((c) => c.id === selectedContactId)?.avatarUrl
                      ? <img src={contacts.find((c) => c.id === selectedContactId)!.avatarUrl!} className="w-full h-full object-cover" />
                      : contacts.find((c) => c.id === selectedContactId)?.nome?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold font-mono uppercase">{contacts.find((c) => c.id === selectedContactId)?.nome}</h3>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">+{selectedContactId}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[size:30px_30px] bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)]">
                  {currentMessages.map((msg) => (
                    <div key={msg.id} className={cn("flex flex-col max-w-[80%]", msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start")}>
                      <div className={cn("p-4 border-2 font-medium text-sm shadow-[4px_4px_0_0_rgba(11,11,11,0.8)]",
                        msg.sender === "user" ? "bg-primary text-primary-foreground border-primary rounded-l-xl rounded-tr-xl" : "bg-background text-foreground border-border rounded-r-xl rounded-tl-xl")}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] font-bold uppercase opacity-40 mt-1.5 px-1">{msg.time}</span>
                    </div>
                  ))}
                  {currentMessages.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-xs uppercase font-bold tracking-[1em] opacity-10">Silêncio</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t-4 border-border bg-background flex-shrink-0">
                  <form onSubmit={handleSendMessage} className="flex gap-4 items-end">
                    <div className="flex-1 flex flex-col gap-2">

                       <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="MENSAGEM..."
                          className="flex-1 h-14 border-2 border-border shadow-[4px_4px_0_0_rgba(11,11,11,1)] rounded-none focus-visible:ring-0 focus-visible:border-primary font-bold px-4" />
                    </div>
                    <Button type="submit" disabled={!messageText.trim()}
                      className="h-14 px-10 border-2 shadow-[4px_4px_0_0_rgba(11,11,11,1)] font-black uppercase transition-none active:translate-x-1 active:translate-y-1 active:shadow-none">
                      <Send className="w-5 h-5 mr-3" /> ENVIAR
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                <MessageSquare className="w-20 h-20 mb-4" strokeWidth={0.75} />
                <p className="font-black uppercase tracking-[0.5em] text-sm">Selecione uma conversa</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Premium Delete Confirmation Dialog ══ */}
      <AlertDialog open={!!contactToDelete} onOpenChange={(open) => { if (!open) setContactToDelete(null); }}>
        <AlertDialogContent className="max-w-sm rounded-none border-4 border-border shadow-[8px_8px_0_0_hsl(var(--foreground))] p-0 overflow-hidden gap-0">
          {/* Bold red header stripe */}
          <div className="bg-red-600 px-6 py-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-sm bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <AlertDialogTitle className="text-white font-black uppercase tracking-tight text-lg leading-tight m-0">
              Excluir conversa?
            </AlertDialogTitle>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <AlertDialogHeader className="space-y-0">
              <AlertDialogDescription className="text-sm text-foreground/80 leading-relaxed">
                Você está prestes a excluir a conversa com{" "}
                <span className="font-black text-foreground">{contactToDelete?.nome}</span>.
                <br /><br />
                <span className="font-bold text-red-600">Todas as mensagens serão apagadas</span>{" "}
                e esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <AlertDialogFooter className="px-6 pb-6 gap-3 flex-row">
            <AlertDialogCancel className="flex-1 rounded-none border-2 border-border font-bold uppercase tracking-widest h-11 shadow-[3px_3px_0_0_rgba(0,0,0,0.15)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteContact}
              className="flex-1 rounded-none border-2 border-red-700 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest h-11 shadow-[3px_3px_0_0_rgba(153,27,27,0.6)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all gap-2">
              <Trash2 className="w-4 h-4" />
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Fragment>
  );
}
