import { useState } from "react";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Contact {
  id: string;
  nome: string;
  numero: string;
  lastMessage: string;
  timestamp: string;
}

const mockContacts: Contact[] = [
  {
    id: "1",
    nome: "Maria Lima",
    numero: "0007654-33.2024",
    lastMessage: "Tenho interesse em saber mais...",
    timestamp: "14:32",
  },
  {
    id: "2",
    nome: "João Santos",
    numero: "0003187-12.2024",
    lastMessage: "Podemos agendar uma reunião?",
    timestamp: "Ontem",
  },
];

interface Message {
  id: string;
  text: string;
  sender: "user" | "lead";
  time: string;
}

const mockMessages: Message[] = [
  { id: "1", text: "Olá Maria, tudo bem? Meu nome é Carlos da JurisFlow.", sender: "user", time: "14:20" },
  { id: "2", text: "Olá Carlos! Tudo bem sim. Sobre o que se trata?", sender: "lead", time: "14:25" },
  { id: "3", text: "Tenho interesse em saber mais sobre a proposta.", sender: "lead", time: "14:32" },
];

export default function ChatPage() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(mockContacts[0]);
  const [message, setMessage] = useState("");

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* Contact list */}
      <div className="w-[280px] border-r border-border flex flex-col bg-card">
        <div className="p-3 border-b border-border">
          <Input placeholder="Buscar contato..." className="h-8 text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {mockContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={cn(
                "w-full text-left px-3 py-3 border-b border-border transition-default",
                selectedContact?.id === contact.id
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-foreground">{contact.nome}</span>
                <span className="text-[10px] text-muted-foreground">{contact.timestamp}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            <div className="px-4 py-3 border-b border-border bg-card">
              <p className="text-sm font-medium text-foreground">{selectedContact.nome}</p>
              <p className="text-xs text-muted-foreground font-mono">{selectedContact.numero}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
              {mockMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[70%] px-3 py-2 rounded-lg text-sm",
                    msg.sender === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-accent text-foreground"
                  )}
                >
                  <p>{msg.text}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-1",
                      msg.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    {msg.time}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border bg-card flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 h-9 text-sm"
              />
              <Button size="sm" className="h-9 px-3">
                <Send className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecione um contato para iniciar
          </div>
        )}
      </div>

      {/* Lead context */}
      {selectedContact && (
        <div className="w-[240px] border-l border-border bg-card p-4 hidden lg:block">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Contexto do Lead
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-medium text-foreground">{selectedContact.nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Precatório</p>
              <p className="text-xs font-mono text-foreground">{selectedContact.numero}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-sm font-mono font-medium text-foreground">R$ 345.000,00</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm text-foreground">Contato Encontrado</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
