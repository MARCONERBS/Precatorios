import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // 1. Fetch Boards
  const { data: boards, isLoading: isLoadingBoards } = useQuery({
    queryKey: ["kanban-boards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kanban_boards").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Select first board strictly when loaded
  useEffect(() => {
    if (boards && boards.length > 0 && !activeBoardId) {
      setActiveBoardId(boards[0].id);
    }
  }, [boards, activeBoardId]);

  // 2. Fetch Columns for Active Board
  const { data: columns } = useQuery({
    queryKey: ["kanban-columns", activeBoardId],
    enabled: !!activeBoardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_columns")
        .select("*")
        .eq("board_id", activeBoardId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  // 3. Fetch Cards (Precatorios) for Active Board
  const { data: precatorios } = useQuery({
    queryKey: ["precatorios-kanban", activeBoardId],
    enabled: !!activeBoardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precatorios")
        .select("id, numero, valor, nome_titular, cpf, kanban_column_id")
        .eq("kanban_board_id", activeBoardId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const moveMutation = useMutation({
    mutationFn: async ({ id, columnId }: { id: string; columnId: string }) => {
      const { error } = await supabase
        .from("precatorios")
        .update({ kanban_column_id: columnId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["precatorios-kanban", activeBoardId] }),
  });

  const moveBoardMutation = useMutation({
    mutationFn: async ({ id, boardId }: { id: string; boardId: string }) => {
      const { error } = await supabase
        .from("precatorios")
        .update({ kanban_board_id: boardId, kanban_column_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["precatorios-kanban"] });
      toast.success("Precatório movido.");
    },
    onError: (error) => toast.error(`Erro ao mover: ${error.message}`),
  });

  const createBoardMutation = useMutation({
    mutationFn: async (title: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sem usuário autenticado.");
      const { data, error } = await supabase
        .from("kanban_boards")
        .insert({ title, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-boards"] });
      setActiveBoardId(newBoard.id);
      toast.success("Kanban criado.");
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const createColumnMutation = useMutation({
    mutationFn: async ({ title, boardId, orderIndex }: { title: string; boardId: string; orderIndex: number }) => {
      const { error } = await supabase
        .from("kanban_columns")
        .insert({ title, board_id: boardId, order_index: orderIndex });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-columns", activeBoardId] });
      toast.success("Fluxo criado.");
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      const { error } = await supabase.from("kanban_boards").delete().eq("id", boardId);
      if (error) throw error;
      return boardId;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-boards"] });
      if (activeBoardId === deletedId) {
        setActiveBoardId(null);
      }
      setIsConfirmingDelete(false);
      toast.success("Kanban excluído com sucesso.");
    },
    onError: (error) => {
      setIsConfirmingDelete(false);
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Handlers
  const handleCreateBoardSubmit = () => {
    if (newBoardName.trim() !== "") {
      createBoardMutation.mutate(newBoardName.trim());
    }
    setNewBoardName("");
    setIsCreatingBoard(false);
  };

  const handleCreateColumnSubmit = () => {
    if (!activeBoardId) return;
    if (newColumnName.trim() !== "") {
      const currentOrder = columns ? columns.length : 0;
      createColumnMutation.mutate({ title: newColumnName.trim(), boardId: activeBoardId, orderIndex: currentOrder });
    }
    setNewColumnName("");
    setIsCreatingColumn(false);
  };

  const handleDeleteBoard = () => {
    if (!activeBoardId) return;
    deleteBoardMutation.mutate(activeBoardId);
  };

  const getCards = (columnId: string, isFirstColumn: boolean) =>
    precatorios?.filter((p) => p.kanban_column_id === columnId || (isFirstColumn && !p.kanban_column_id)) ?? [];

  return (
    <div className="p-6 h-[calc(100vh-3.5rem)] flex flex-col bg-muted/10">
      <div className="mb-6 pb-4 border-b-2 border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">Kanban</h1>
            <p className="text-sm font-mono text-muted-foreground mt-1">Pipeline de prospecção</p>
          </div>
          {isCreatingBoard ? (
            <div className="flex gap-2 items-center">
              <input 
                autoFocus
                value={newBoardName}
                onChange={e => setNewBoardName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateBoardSubmit(); else if (e.key === 'Escape') setIsCreatingBoard(false); }}
                className="border-2 border-border bg-background px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-widest rounded-none outline-none focus:border-primary w-[200px]"
                placeholder="NOME DO KANBAN..."
              />
              <Button onClick={handleCreateBoardSubmit} className="text-xs h-[32px] px-4 font-bold uppercase">Salvar</Button>
              <Button onClick={() => setIsCreatingBoard(false)} variant="ghost" className="text-xs h-[32px] px-2 text-muted-foreground">Cancelar</Button>
            </div>
          ) : isConfirmingDelete ? (
            <div className="flex gap-2 items-center bg-red-500/10 border-2 border-red-500 p-1 pl-3">
              <span className="text-[10px] font-bold uppercase text-red-500 tracking-widest mr-2">
                Excluir Kanban e seus fluxos?
              </span>
              <Button onClick={handleDeleteBoard} variant="destructive" className="text-xs h-[30px] bg-red-600 hover:bg-red-700 text-white rounded-none border-2 border-red-800 shadow-none uppercase font-bold tracking-widest">
                Sim, Excluir
              </Button>
              <Button onClick={() => setIsConfirmingDelete(false)} variant="ghost" className="text-xs h-[30px] text-muted-foreground uppercase font-bold tracking-widest hover:text-foreground">
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {activeBoardId && boards && boards.length > 0 && boards.find(b => b.id === activeBoardId)?.title.toUpperCase() !== "KANBAN PRINCIPAL" && (
                <Button onClick={() => setIsConfirmingDelete(true)} variant="destructive" className="text-xs bg-red-600 hover:bg-red-700 text-white border-2 border-red-800 rounded-none shadow-[2px_2px_0_0_rgba(153,27,27,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-none">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              )}
              <Button onClick={() => setIsCreatingBoard(true)} variant="outline" className="text-xs">
                <Plus className="w-4 h-4 mr-2" />
                Novo Kanban
              </Button>
            </div>
          )}
        </div>

        {/* Board Tabs Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {isLoadingBoards ? (
            <span className="font-mono text-xs text-muted-foreground">Carregando kanbans...</span>
          ) : boards?.length === 0 ? (
            <span className="font-mono text-xs text-muted-foreground">Nenhum kanban criado.</span>
          ) : (
            boards?.map((board) => (
              <button
                key={board.id}
                onClick={() => setActiveBoardId(board.id)}
                className={`px-4 py-2 font-bold uppercase tracking-widest text-[11px] border-2 transition-default rounded-none shadow-[2px_2px_0_0_rgba(17,17,17,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap ${
                  activeBoardId === board.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground hover:bg-muted border-border"
                }`}
              >
                {board.title}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto border-2 border-border bg-background shadow-card p-4 rounded-none">
        <div className="flex gap-4 min-h-0 h-full">
          {(!columns || columns.length === 0) && activeBoardId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground font-mono text-sm gap-4">
              <p>Este Kanban não possui fluxos ainda.</p>
              {isCreatingColumn ? (
                <div className="w-[320px] border-2 border-border bg-card p-3 shadow-card rounded-none space-y-3">
                  <input 
                    autoFocus
                    value={newColumnName}
                    onChange={e => setNewColumnName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateColumnSubmit(); else if (e.key === 'Escape') setIsCreatingColumn(false); }}
                    className="w-full border-2 border-border bg-background px-3 py-2 text-xs font-bold font-mono rounded-none outline-none focus:border-primary uppercase tracking-widest"
                    placeholder="NOME DO FLUXO..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreateColumnSubmit} className="flex-1 text-xs font-bold uppercase">Salvar</Button>
                    <Button onClick={() => setIsCreatingColumn(false)} variant="outline" className="flex-1 text-xs font-bold uppercase">Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setIsCreatingColumn(true)} variant="outline">
                  Criar Primeiro Fluxo
                </Button>
              )}
            </div>
          ) : null}

          {columns?.map((column, index) => {
            const isFirstColumn = index === 0;
            const cards = getCards(column.id, isFirstColumn);
            return (
              <div
                key={column.id}
                className="flex-shrink-0 w-[320px] flex flex-col bg-muted/20 border-2 border-border rounded-none"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("bg-primary/5");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("bg-primary/5");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("bg-primary/5");
                  const cardId = e.dataTransfer.getData("cardId");
                  if (cardId) moveMutation.mutate({ id: cardId, columnId: column.id });
                }}
              >
                <div className="px-3 py-3 flex items-center justify-between border-b-2 border-border bg-muted/40">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">{column.title}</h3>
                  <span className="text-[10px] font-bold font-mono text-primary bg-primary/10 border-2 border-primary px-2 py-0.5 rounded-none shadow-[2px_2px_0_0_rgba(17,17,17,1)]">
                    {cards.length}
                  </span>
                </div>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("cardId", card.id);
                      }}
                      className="bg-card rounded-none border-2 border-border p-3 shadow-card hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-card-hover transition-default cursor-grab active:cursor-grabbing"
                    >
                      <p className="font-mono text-xs font-bold text-muted-foreground mb-1 border-b-2 border-border/20 pb-1">{card.numero}</p>
                      <p className="font-mono text-sm font-bold text-foreground">
                        {formatCurrency(Number(card.valor))}
                      </p>
                      {card.nome_titular && (
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-2">{card.nome_titular}</p>
                      )}
                      
                      {card.cpf && (
                        <p className="text-[10px] font-mono text-primary mt-1 flex items-center gap-1">
                          <span className="opacity-50 text-[9px] font-bold uppercase">
                            {card.cpf.startsWith('ADV:') 
                              ? "ADV:" 
                              : card.cpf.length === 11 
                                ? "CPF:" 
                                : card.cpf.length === 14 
                                  ? "CNPJ:" 
                                  : "ID:"}
                          </span>
                          {card.cpf.replace('ADV:', '').trim()}
                        </p>
                      )}
                      
                      {boards && boards.length > 1 && (
                        <div className="mt-3 pt-3 border-t-2 border-border/20">
                          <select
                            className="w-full text-[10px] font-bold uppercase tracking-widest bg-muted/50 border-2 border-border p-1 outline-none cursor-pointer hover:border-primary transition-default rounded-none text-muted-foreground hover:text-foreground"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                moveBoardMutation.mutate({ id: card.id, boardId: e.target.value });
                              }
                            }}
                          >
                            <option value="" disabled>Mover para...</option>
                            {boards.filter(b => b.id !== activeBoardId).map(b => (
                              <option key={b.id} value={b.id}>{b.title}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className="text-center py-8 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Vazio</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Column Button inside the horizontal overflow */}
          {activeBoardId && columns && columns.length > 0 && (
            <div className="flex-shrink-0 w-[320px] flex items-start">
              {isCreatingColumn ? (
                <div className="w-full border-2 border-border bg-card p-3 shadow-card rounded-none space-y-3">
                  <input 
                    autoFocus
                    value={newColumnName}
                    onChange={e => setNewColumnName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateColumnSubmit(); else if (e.key === 'Escape') setIsCreatingColumn(false); }}
                    className="w-full border-2 border-border bg-background px-3 py-2 text-xs font-bold font-mono rounded-none outline-none focus:border-primary uppercase tracking-widest"
                    placeholder="NOME DO FLUXO..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreateColumnSubmit} className="flex-1 text-xs font-bold uppercase">Salvar</Button>
                    <Button onClick={() => setIsCreatingColumn(false)} variant="outline" className="flex-1 text-xs font-bold uppercase">Cancelar</Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingColumn(true)}
                  className="w-full h-14 border-2 border-dashed border-border text-muted-foreground font-bold uppercase tracking-widest text-[11px] hover:border-primary hover:text-primary hover:bg-primary/5 transition-default rounded-none flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar Novo Fluxo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
