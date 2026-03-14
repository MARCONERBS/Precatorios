
-- Precatórios table
CREATE TABLE public.precatorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL DEFAULT 0,
  ano INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','buscando_cpf','cpf_encontrado','buscando_contato','contato_pronto','erro')),
  cpf TEXT,
  nome_titular TEXT,
  telefones TEXT[],
  emails TEXT[],
  kanban_coluna TEXT NOT NULL DEFAULT 'novo' CHECK (kanban_coluna IN ('novo','cpf_encontrado','contato_encontrado','em_contato','negociacao','fechado')),
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.precatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own precatorios"
  ON public.precatorios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own precatorios"
  ON public.precatorios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own precatorios"
  ON public.precatorios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own precatorios"
  ON public.precatorios FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_precatorios_user ON public.precatorios(user_id);
CREATE INDEX idx_precatorios_status ON public.precatorios(status);
CREATE INDEX idx_precatorios_kanban ON public.precatorios(kanban_coluna);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  precatorio_id UUID NOT NULL REFERENCES public.precatorios(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user','lead')),
  content TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own messages"
  ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_precatorio ON public.chat_messages(precatorio_id);

-- API configurations table (per user, sensitive fields)
CREATE TABLE public.api_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  escavador_api_key TEXT,
  escavador_endpoint TEXT DEFAULT 'https://api.escavador.com/api/v2',
  alertaki_usuario TEXT,
  alertaki_senha TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own config"
  ON public.api_configurations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own config"
  ON public.api_configurations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own config"
  ON public.api_configurations FOR UPDATE USING (auth.uid() = user_id);

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_precatorios_updated_at
  BEFORE UPDATE ON public.precatorios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_configurations_updated_at
  BEFORE UPDATE ON public.api_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
