# Decisões — PokéQuest

Registro de escolhas tomadas durante a implementação, com data e justificativa. Ver `Plan.md` para a especificação completa; este arquivo cobre apenas pontos onde uma decisão concreta precisou ser tomada (configuráveis da seção 2.2, ou lacunas não cobertas pela spec).

## 2026-10-13 — Ambiente único (sem separação dev/prod)

**Decisão:** um único projeto Supabase serve como dev e produção.
**Motivo:** Docker não está disponível no ambiente de desenvolvimento, então `supabase start` (banco local) não é viável. Como é um app de usuário único (RNF-011: "sem superengenharia"), manter dois projetos Supabase pagos/gerenciados não se justifica agora.
**Trade-off aceito:** migrations são aplicadas direto no banco real via `supabase db push`; não há ambiente de teste isolado para migrations. Se isso incomodar no futuro, instalar Docker Desktop habilita local dev sem mudar a estrutura do código.

## 2026-10-13 — Autenticação por email/senha

**Decisão:** login via `supabase.auth.signInWithPassword`, sem magic link ou OAuth.
**Motivo:** mais simples de implementar e usar para um único usuário; Plan.md não especificava o método (RF-001).
**Onde:** `src/features/auth/api/auth.ts`.

## 2026-10-13 — Estado de sessão de auth via Zustand, não TanStack Query

**Decisão:** sessão de autenticação vive em `src/features/auth/store/auth-store.ts` (Zustand), alimentada por `supabase.auth.onAuthStateChange`, não como uma query do TanStack Query.
**Motivo:** é estado orientado a eventos (push do SDK), não um fetch request/response — não se encaixa bem no modelo de query/invalidação. Zustand já está no stack para "estado de UI/sessão" (seção 2.1 do Plan.md).
**Implicação:** dados de domínio (tarefas, categorias, etc.) usam TanStack Query normalmente; só a sessão de auth é exceção.

## 2026-10-13 — Convenção de query keys por domínio

**Decisão:** cada domínio expõe uma factory de query keys em `src/shared/lib/query-keys.ts`, no formato `[domínio, operação, ...params]` (ex.: `['tasks', 'list', filters]`, `['tasks', 'detail', id]`). Mutações invalidam por prefixo do domínio (`queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })`), nunca `queryClient.clear()`.
**Motivo:** RNF-002 exige invalidação específica, não limpar o cache inteiro; uma factory central evita strings mágicas duplicadas entre hooks de query e mutation do mesmo domínio.
**Onde:** `src/shared/lib/query-keys.ts`; cada feature importa e estende conforme necessário.

## 2026-10-13 — Teste de "segunda conta não autorizada" (T-008) ainda pendente

**Decisão:** não criado um segundo usuário de teste para validar RLS entre contas diferentes.
**Motivo:** exigiria a `service_role` key (não deve circular fora do servidor) para criar um usuário descartável via Admin API, já que o cadastro público está desabilitado.
**Pendência:** validar manualmente mais tarde (ex.: criar um segundo usuário temporário direto no painel, testar acesso cruzado, depois apagar) antes do lançamento (T-038, auditoria de segurança).

## 2026-10-13 — Conclusão de tarefa (T-011) é idempotente só no status, não ainda no ledger de recompensa

**Decisão:** `completeTask()` (`src/features/tasks/domain.ts`) trata concluir uma tarefa já concluída como no-op (não lança erro, não gera novo `completed_at`). Isso evita um estado inconsistente em cliques duplicados, mas **não** cria nenhum registro de evento/recompensa — essa tabela (`reward_events`/ledger) e sua idempotência via chave própria são explicitamente o escopo do T-013.
**Motivo:** T-011 cobre CRUD e transições de estado da tarefa; o ledger de recompensa com XP é uma camada posterior que depende de regras de jogo (T-003) ainda não implementadas.
**Implicação:** por ora, "concluir" uma tarefa só muda `status`/`completed_at`; nenhuma UI de recompensa/XP deve ser prometida até o T-013 existir.

## 2026-10-13 — CA do T-011 validado via testes automatizados, não manualmente no navegador

**Decisão:** o CRUD de tarefas (domínio, esquemas Zod, repositório Supabase, hooks TanStack Query) foi validado com 34 testes automatizados (unitários de domínio/esquema + repositório com Supabase mockado) e contra as políticas de RLS reais (já testadas no T-008). Não construí uma UI própria para clicar manualmente, porque isso é explicitamente o escopo do T-012 ("Criar experiência de tarefas rápida e clara").
**Motivo:** evitar duplicar trabalho — qualquer UI temporária construída agora seria descartada/refeita no T-012.
**Implicação:** o teste "cria tarefa → persiste após refresh/outro dispositivo" (CA literal do T-011) só terá verificação visual real quando o T-012 estiver pronto.
