

## Plano: Consulta de Processos via Web Scraping do Escavador (sem API, sem custo)

### Como funciona

Uma Edge Function fará scraping direto da página pública `escavador.com/busca?q={numero_processo}`, extraindo os dados do processo (partes, tribunal, movimentações) do HTML retornado. Sem necessidade de API key.

### Componentes

**1. Edge Function `consultar-escavador`**
- Recebe o `numero` do precatório
- Faz `fetch` em `https://www.escavador.com/busca?q={numero}` com User-Agent de navegador
- Faz parse do HTML da página de resultados para extrair:
  - Nome das partes (autor/réu)
  - Tribunal e vara
  - Data de distribuição
  - Últimas movimentações
- Retorna os dados estruturados em JSON
- Salva o resultado na coluna `escavador_dados` do precatório no banco

**2. Migration: coluna `escavador_dados`**
- Adicionar coluna `escavador_dados jsonb` na tabela `precatorios` para cachear os resultados e evitar re-consultas

**3. UI na tabela (`Precatorios.tsx`)**
- Nova coluna "Ações" com botão de lupa "Consultar" em cada linha
- Ao clicar, chama a edge function com loading spinner
- Linha expansível (Collapsible) abaixo do precatório mostrando:
  - Dados do processo formatados (partes, tribunal, movimentações)
  - Se já foi consultado antes, mostra dados do cache (`escavador_dados`)
- Estado `expandedId` controla qual linha está aberta

### Limitações conhecidas
- O Escavador pode bloquear scraping com captcha ou rate limiting. A edge function tentará com headers de navegador real. Se bloqueado, retornará erro amigável.
- Dados públicos podem ser limitados comparados à API paga.

