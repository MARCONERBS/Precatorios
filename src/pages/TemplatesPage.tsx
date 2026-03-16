import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Plus, Trash2, Edit2, Check, X, Search, Copy, Tag, MessageSquare, Activity, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
}

const CATEGORIES = ["Geral", "Saudação", "Script de Venda", "Suporte", "Follow-up", "Fechamento"];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // AI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiInput, setShowAiInput] = useState(false);
  
  // Form State
  const [tempTitle, setTempTitle] = useState("");
  const [tempContent, setTempContent] = useState("");
  const [tempCategory, setTempCategory] = useState("Geral");
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) loadTemplates();
    };
    init();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data } = await (supabase.from("evachat_templates" as any) as any).select("*").order("created_at", { ascending: false });
      if (data) setTemplates(data as Template[]);
    } catch (e) { console.error("loadTemplates:", e); }
  };

  const saveTemplate = async () => {
    if (!tempTitle.trim() || !tempContent.trim() || !currentUser) {
      toast.error("Preencha todos os campos.");
      return;
    }
    try {
      const payload = { 
        title: tempTitle, 
        content: tempContent, 
        category: tempCategory,
        user_id: currentUser.id 
      };

      if (editingTemplate) {
        await (supabase.from("evachat_templates" as any) as any).update(payload).eq("id", editingTemplate.id);
        toast.success("Template atualizado!");
      } else {
        await (supabase.from("evachat_templates" as any) as any).insert(payload);
        toast.success("Template salvo!");
      }
      resetForm();
      loadTemplates();
    } catch (e) { toast.error("Erro ao salvar template."); }
  };

  const deleteTemplate = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await (supabase.from("evachat_templates" as any) as any).delete().eq("id", id);
      toast.success("Template removido.");
      loadTemplates();
    } catch (e) { toast.error("Erro ao remover template."); }
  };

  const copyToClipboard = (content: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(content);
    toast.success("Copiado!");
  };

  const resetForm = () => {
    setTempTitle("");
    setTempContent("");
    setTempCategory("Geral");
    setEditingTemplate(null);
    setIsAdding(false);
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Descreva o que você quer gerar.");
      return;
    }

    setIsGenerating(true);
    try {
      const { data: config } = await supabase.from("api_configurations").select("openai_api_key" as any).single();
      
      const openaiKey = (config as any)?.openai_api_key;
      if (!openaiKey) {
        toast.error("Configuração de IA não encontrada. Vá em Configurações.");
        setShowAiInput(false);
        return;
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: "Você é um especialista em escrita persuasiva para scripts de vendas de precatórios no Brasil. Escreva scripts curtos, diretos e naturais. Não use placeholders como [Nome]. Use variáveis MOGUI se necessário (apenas se fizer sentido)." 
            },
            { 
              role: "user", 
              content: `Gere um script de mensagem de WhatsApp baseado neste pedido: ${aiPrompt}` 
            }
          ],
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error.message);

      const generatedText = result.choices[0].message.content;
      setTempContent(generatedText);
      setShowAiInput(false);
      setAiPrompt("");
      toast.success("Script gerado com sucesso!");
    } catch (e: any) {
      console.error("AI Error:", e);
      toast.error(`Erro na IA: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const startEdit = (t: Template) => {
    setEditingTemplate(t);
    setTempTitle(t.title);
    setTempContent(t.content);
    setTempCategory(t.category || "Geral");
    setIsAdding(true);
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           t.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "Todos" || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const stats = useMemo(() => {
    return {
      total: templates.length,
      chars: templates.reduce((acc, t) => acc + t.content.length, 0),
    };
  }, [templates]);

  return (
    <div className="h-full bg-[#fdfdfd] p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 overflow-hidden font-sans">
      {/* Refined Header - More compact */}
      <div className="flex justify-between items-center flex-shrink-0 bg-white border-2 border-black p-3 lg:p-4 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
        <div className="flex gap-3 items-center">
            <div className="bg-primary p-2 border-2 border-black">
                <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tighter leading-none">Biblioteca de Scripts</h1>
              <div className="flex gap-4 mt-2">
                 <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-60">
                    <MessageSquare className="w-3 h-3 text-primary" /> {stats.total} Modelos
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-60">
                    <Activity className="w-3 h-3 text-primary" /> {stats.chars} Chars
                 </div>
              </div>
            </div>
        </div>
        {!isAdding && (
          <Button 
            onClick={() => setIsAdding(true)} 
            className="rounded-none font-black uppercase tracking-widest border-2 border-black bg-primary text-white shadow-[3px_3px_0_0_rgba(0,0,0,1)] hover:bg-primary/95 transition-all h-11 px-6 text-xs"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Script
          </Button>
        )}
      </div>

      <div className="flex-1 flex gap-4 lg:gap-6 overflow-hidden min-h-0">
        {/* Templates Explorer */}
        <div className={cn(
          "bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex flex-col overflow-hidden transition-all duration-300",
          isAdding ? "w-[340px] flex-shrink-0" : "w-full"
        )}>
          {/* Compact Toolbar */}
          <div className="p-3 bg-black text-white flex flex-col gap-3">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                <Input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="BUSCAR..."
                  className="pl-9 bg-white/10 border-white/20 rounded-none h-10 text-xs uppercase text-white placeholder:text-white/40"
                />
             </div>
             
             <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {["Todos", ...CATEGORIES].map(cat => (
                   <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-black uppercase border-2 transition-all whitespace-nowrap",
                      selectedCategory === cat 
                        ? "bg-primary border-white text-white" 
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                    )}
                   >
                    {cat}
                   </button>
                ))}
             </div>
          </div>

          <ScrollArea className="flex-1 bg-[#f5f5f5]">
            <div className={cn(
                "p-3 lg:p-4",
                isAdding ? "flex flex-col gap-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            )}>
              {filteredTemplates.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center opacity-20">
                  <p className="font-black uppercase tracking-widest text-[10px]">Vazio</p>
                </div>
              )}
              {filteredTemplates.map((t) => (
                <div 
                    key={t.id} 
                    onClick={() => isAdding && startEdit(t)}
                    className={cn(
                        "group border-2 border-black bg-white transition-all relative flex flex-col",
                        isAdding 
                            ? "p-3 hover:bg-muted cursor-pointer flex-shrink-0" 
                            : "p-4 shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5"
                    )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-black text-white px-2 py-1">
                        {t.category || "Geral"}
                    </span>
                    {isAdding && editingTemplate?.id === t.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <h3 className="font-bold uppercase text-[12px] tracking-tight text-primary truncate flex-1">{t.title}</h3>
                    {isAdding && <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />}
                  </div>

                  {!isAdding && (
                      <>
                        <div className="bg-muted px-3 py-2 border-y-2 border-black/5 text-xs font-medium leading-relaxed h-24 overflow-hidden text-muted-foreground italic my-3">
                            {t.content}
                        </div>

                        <div className="flex gap-2 mt-auto pt-3 border-t-2 border-black/5">
                            <Button 
                            className="flex-1 rounded-none border-2 border-black bg-primary text-white hover:bg-primary/90 font-black uppercase text-[10px] tracking-widest h-9 transition-all shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-y-px"
                            onClick={(e) => startEdit(t)}
                            >
                            <Edit2 className="w-3 h-3 mr-1.5" />
                            EDITAR / USAR
                            </Button>
                            <Button 
                            variant="outline" 
                            className="w-9 h-9 p-0 rounded-none border-2 border-black bg-white hover:bg-muted shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-y-px"
                            onClick={(e) => copyToClipboard(t.content, e)}
                            >
                            <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                            variant="outline" 
                            className="w-9 h-9 p-0 rounded-none border-2 border-black text-red-600 hover:bg-red-50 shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none active:translate-y-px"
                            onClick={(e) => deleteTemplate(t.id, e)}
                            >
                            <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                      </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Proportional Editor Panel */}
        {isAdding && (
          <div className="flex-1 bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-3 bg-black flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="bg-primary p-1">
                    {editingTemplate ? <Edit2 className="w-3 h-3 text-white" /> : <Plus className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-white font-black uppercase text-xs tracking-tighter">
                    {editingTemplate ? "EDITAR DISCURSO" : "NOVO SCRIPT MOGUI"}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={resetForm} className="text-white hover:bg-white/10 rounded-none h-6 w-6">
                   <X className="w-4 h-4" />
                </Button>
             </div>
             
             <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                  {/* Category Selection Area */}
                  <div className="lg:w-[260px] flex flex-col gap-3">
                    <Label className="font-black uppercase text-[11px] tracking-widest opacity-60 flex items-center gap-2">
                       <Tag className="w-3.5 h-3.5" /> Categoria
                    </Label>
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setTempCategory(cat)}
                          className={cn(
                            "px-3 py-2.5 text-[11px] font-black uppercase border-2 transition-all text-left flex items-center justify-between",
                            tempCategory === cat 
                              ? "bg-primary/10 border-primary text-primary" 
                              : "bg-muted border-transparent hover:border-black/20"
                          )}
                        >
                          {cat}
                          {tempCategory === cat && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title Area */}
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="space-y-2">
                        <Label className="font-black uppercase text-[11px] tracking-widest opacity-60 flex items-center gap-2">
                           <Check className="w-3.5 h-3.5" /> Título do Script
                        </Label>
                        <Input 
                            value={tempTitle}
                            onChange={e => setTempTitle(e.target.value)}
                            placeholder="NOME DO MODELO..."
                            className="h-12 bg-white border-2 border-black rounded-none font-bold uppercase text-sm focus:bg-muted/30 transition-all shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
                        />
                    </div>
                    
                    <div className="mt-2 flex flex-col gap-3 flex-1">
                        <div className="flex justify-between items-end">
                            <Label className="font-black uppercase text-[11px] tracking-widest opacity-60 flex items-center gap-2">
                                <MessageSquare className="w-3.5 h-3.5" /> Texto da Mensagem
                            </Label>
                            <div className="flex gap-4 items-center">
                                <div className="text-[10px] font-bold uppercase opacity-40">
                                    {tempContent.length} chars | {tempContent.split(/\s+/).filter(x => x).length} words
                                </div>
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    onClick={() => setShowAiInput(!showAiInput)}
                                    className={cn(
                                        "h-8 px-3 rounded-none border-2 border-black bg-white text-black font-black uppercase text-[10px] tracking-widest shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:shadow-none hover:bg-black hover:text-white transition-all",
                                        showAiInput && "bg-black text-white"
                                    )}
                                >
                                    <Activity className="w-3 h-3 mr-2" />
                                    Gerar com IA
                                </Button>
                            </div>
                        </div>

                        {showAiInput && (
                            <div className="bg-black text-white p-4 border-2 border-black animate-in slide-in-from-top-2 duration-200 shadow-[4px_4px_0_0_rgba(17,17,17,0.5)] mb-2">
                                <Label className="font-black uppercase text-[10px] tracking-widest text-primary mb-2 block">O que a IA deve escrever?</Label>
                                <div className="flex gap-2">
                                    <Input 
                                            className="h-10 bg-white/10 border-white/20 rounded-none text-xs text-white placeholder:text-white/30 focus:bg-white/20 transition-all font-medium"
                                            placeholder="Ex: Script de saudação persuasivo..."
                                            value={aiPrompt}
                                            onChange={e => setAiPrompt(e.target.value)}
                                            onKeyDown={e => e.key === "Enter" && generateWithAI()}
                                    />
                                    <Button 
                                            disabled={isGenerating}
                                            onClick={generateWithAI}
                                            className="bg-primary text-white rounded-none h-10 font-bold uppercase text-xs border border-white/20 px-6 hover:opacity-90 active:translate-y-px"
                                       >
                                        {isGenerating ? "Gerando..." : "Gerar"}
                                    </Button>
                                </div>
                            </div>
                        )}
                        <Textarea 
                            value={tempContent}
                            onChange={e => setTempContent(e.target.value)}
                            placeholder="DIGITE O CONTEÚDO DO SCRIPT..."
                            className="flex-1 min-h-[250px] bg-white border-2 border-black rounded-none font-medium text-base leading-relaxed p-5 focus:bg-muted/30 transition-all shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
                        />
                    </div>
                  </div>
                </div>
             </div>

             {/* Footer - More proportioned */}
             <div className="p-4 bg-black/5 border-t-2 border-black flex gap-4">
                <Button 
                   onClick={resetForm}
                   variant="outline"
                   className="px-6 border-2 border-black bg-white hover:bg-red-50 hover:text-red-700 rounded-none h-11 font-black uppercase text-xs transition-all"
                >
                   DESCARTAR
                </Button>
                {editingTemplate && (
                    <Button 
                        variant="outline"
                        className="px-6 border-2 border-black bg-white hover:bg-red-50 hover:text-red-700 rounded-none h-11 font-black uppercase text-xs transition-all"
                        onClick={() => deleteTemplate(editingTemplate.id)}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        EXCLUIR
                    </Button>
                )}
                <Button 
                   onClick={saveTemplate}
                   className="flex-1 bg-primary text-white hover:bg-primary/95 rounded-none h-11 font-black uppercase text-xs tracking-widest border-2 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] active:translate-y-px active:shadow-none transition-all"
                >
                   <Check className="w-5 h-5 mr-3" />
                   CONSOLIDAR SCRIPT
                </Button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
