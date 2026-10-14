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

## 2026-10-13 — Formulário de tarefas (T-012) sem seletor de categoria

**Decisão:** o formulário "Nova tarefa"/edição não expõe campo de categoria, mesmo a coluna `category_id` existindo desde o T-007.
**Motivo:** não existe nenhuma feature de CRUD de categorias ainda (tabela `categories` está vazia); um seletor sem opções não ajudaria o usuário. RF-007 trata categoria como opcional.
**Implicação:** quando uma feature de gerenciamento de categorias existir, adicionar o campo ao `TaskForm` (categoria já é opcional em `taskInputSchema`, só falta a UI de seleção).

## 2026-10-13 — Idempotência de conclusão (T-013) garantida por gatilho no banco, não por chave do cliente

**Decisão:** a tabela `productivity_events` (migration `20261013161719_create_productivity_events.sql`) é um ledger append-only alimentado **exclusivamente** por um trigger `AFTER UPDATE` em `tasks` (`record_task_completion_event`, `SECURITY DEFINER`). O gatilho só insere um evento quando `OLD.status IS DISTINCT FROM NEW.status` e o novo status é `'completed'` — ou seja, quando a transição **realmente aconteceu** no banco, não quando o cliente _pede_ para completar. Reforço adicional: `unique (source_type, source_id, occurred_at)` + `ON CONFLICT DO NOTHING`.
**Motivo:** um identificador gerado pelo cliente (ex.: idempotency key enviada pela UI) pode ser forjado, esquecido ou divergir entre abas/dispositivos; a transição de estado real no banco não pode. Isso satisfaz RNF-006 ("o cliente nunca é fonte confiável do próprio XP") de forma mais forte do que uma chave client-side.
**Por que isso já resolve o cenário de duas abas/dispositivos:** se o dispositivo A conclui a tarefa primeiro, quando a atualização do dispositivo B chega, `OLD.status` já é `'completed'` (valor committado por A) — a condição do gatilho é falsa e nenhum segundo evento é inserido, independentemente dos timestamps `completed_at` serem diferentes entre A e B.
**Reabrir e concluir de novo:** é tratado como um **novo episódio de conclusão legítimo** (gera um novo evento, já que `occurred_at` — o `completed_at` daquela conclusão — é diferente do anterior). Não há reversão automática de recompensas já concedidas ao reabrir (ainda não existem recompensas — isso é T-021+); se uma política de reversão for necessária depois, ela precisa ser decidida explicitamente, não inferida daqui.
**Validado:** rodei um script SQL (`supabase db query --linked`) direto no banco real, criando e removendo uma tarefa descartável, confirmando: 1 evento após a primeira conclusão, ainda 1 evento após uma conclusão duplicada ("retry"/duas abas), 2 eventos após reabrir e concluir de novo. Nenhum resíduo ficou no banco.
**Pendência:** não há teste automatizado desse comportamento no Vitest (exigiria Postgres real; não há Docker/ambiente local — ver decisão "Ambiente único" acima). O script fica versionado em `supabase/verification/t013-completion-idempotency.sql` — roda com `npx supabase db query --linked -f supabase/verification/t013-completion-idempotency.sql` sempre que o gatilho for alterado.

## 2026-10-13 — `awaiting_confirmation` (T-016) é um estado derivado, não uma coluna persistida

**Decisão:** `focus_sessions.status` só guarda `running`/`paused`/`completed`/`cancelled`. O estado "tempo esgotado, esperando confirmação" (RF-016) é **calculado** no cliente a partir de `started_at`/`paused_at`/`accumulated_pause_seconds`/`planned_duration_seconds` (`getSessionPhase()` em `src/features/focus/domain.ts`), não escrito no banco.
**Motivo:** evita uma viagem ao servidor só para marcar "o relógio chegou a zero" — isso é puramente uma questão de apresentação/tempo, que já é derivável dos timestamps já persistidos (RF-015 exige cálculo via timestamps, não ticks). Uma sessão pausada que já passou do tempo planejado permanece `paused` (não pula para `awaiting_confirmation`) porque pausar foi uma ação explícita do usuário.
**Implicação:** `confirmSession()` recalcula a fase a partir do estado persistido e **rejeita** a confirmação se `awaiting_confirmation` não for a fase atual — isso é o que impede uma "vitória implícita" (RF-016) mesmo que a UI tente confirmar antes da hora.

## 2026-10-13 — Pausa de sessão (RF-014) ≠ descanso entre ciclos (RF-018)

**Decisão:** `focus_sessions.paused_at`/`accumulated_pause_seconds` modelam só o botão "pausar" dentro de uma sessão ativa (RF-014). O descanso clássico do Pomodoro entre um foco e o próximo (RF-018, presets 5/10/15 min) é um conceito separado, ainda não modelado — fica para o T-020.
**Motivo:** o Plan.md usa "pausa" para as duas coisas em português; sem essa distinção explícita, o schema correria risco de confundir os dois.

## 2026-10-13 — Limites de duração do Pomodoro (T-016)

**Decisão:** `planned_duration_seconds` aceita de 60 (1 min) a 7200 (2h) na constraint do banco.
**Motivo:** RF-013 pede "limites razoáveis" sem definir números; a tabela de propostas (seção 2.2) sugere presets 25/30/45/60 min como _UI_ (ainda não construída — T-018/T-020), não como limite rígido. O teto de 2h segue o princípio de seção 5.1.5 ("não exigir Pomodoros de horas"); o piso de 1 min permite sessões de teste/custom curtas sem abrir a porta para sessões de duração ~0.
**Implicação:** os presets da UI (T-018) vão ficar bem dentro desses limites; não há necessidade de alterar a constraint ao implementá-los.

## 2026-10-13 — Vínculo com batalha/encontro (RF-017) deferido para a Fase 4

**Decisão:** `focus_sessions` tem `task_id` (opcional, nullable) mas **não** tem nenhuma coluna para vincular a um encontro/batalha ainda.
**Motivo:** as tabelas `battles`/`battle_commitments` não existem (Fase 4 do backlog). RF-017 descreve o vínculo a um "encontro/desafio" como esperado, mas os objetivos do produto (seção 1.1, item 3: "permitir sessões de foco sem precisar interagir com o jogo") e os princípios de seção 5.1 confirmam que o Pomodoro tem que funcionar de forma independente da camada de RPG.
**Implicação:** quando a Fase 4 criar `battles`, uma migration nova adiciona uma coluna `battle_id` nullable a `focus_sessions` — não é uma mudança destrutiva.

## 2026-10-13 — Conflito de sessão concorrente (T-017) é resolvido no repositório, não exposto como erro

**Decisão:** `startSession()` (`src/features/focus/api/focus-sessions-repository.ts`) tenta o `insert`; se colidir com a restrição "uma sessão ativa por usuário" (Postgres `23505`), ele busca e retorna a sessão que já está ativa, em vez de propagar o erro de conflito pro chamador.
**Motivo:** RF-019/T-017 pedem para "resolver conflito entre duas abas/dispositivos e mostrar o estado verdadeiro" — se a aba B tentar iniciar uma sessão enquanto a aba A já tem uma rodando, a aba B deve simplesmente passar a refletir a sessão real da aba A, não mostrar uma mensagem de erro para uma ação que, do ponto de vista do usuário, nem devia ter sido possível.
**Implicação:** `useStartFocusSession` nunca precisa de um tratamento especial de erro para esse caso específico — o retorno da mutação já é a sessão verdadeira, ativa ou recém-criada.

## 2026-10-13 — "Restaurar sessão ativa" (T-017) é responsabilidade do cache do TanStack Query, ainda sem UI

**Decisão:** `useActiveFocusSession()` consulta `focus_sessions` por status `running`/`paused` sempre que montado; qualquer página pode usá-lo para recuperar a sessão verdadeira ao navegar ou recarregar. Não criei nenhuma UI (banner persistente, mini-player) que o consuma ainda — isso é o T-018 (tela de Foco).
**Motivo:** T-016/T-017 cobrem o motor (estado + persistência); a experiência visual completa, incluindo onde/como mostrar que existe uma sessão ativa fora da tela de Foco, é explicitamente escopo do T-018.

## 2026-10-13 — Tela de Foco (T-018) sem adversário/equipe, e áudio opcional sem preferências persistidas

**Decisão:** a tela de Foco não mostra nenhum "adversário"/equipe Pokémon (só um aviso discreto de que isso vem na Fase 4). O som opcional de término (checkbox "Som ao terminar") é estado local do componente — não persiste entre visitas/dispositivos, e não existe nenhum sistema de preferências do usuário ainda.
**Motivo:** `battles`/`pokemon`/`game_progress` não existem (Fase 4); construir uma seção falsa seria pior que não ter nenhuma. Preferências reais de áudio/tempo são T-020/T-040 — até lá, um toggle local e efêmero já cumpre "feedback opcional de término" sem fingir infraestrutura que não existe.
**Limitação documentada (parte do checklist do T-018):** numa aba em segundo plano/throttled, o som pode atrasar ou não disparar — `setInterval` não tem garantia de rodar nesse estado. Isso não afeta a contagem visível, que é sempre recalculada a partir dos timestamps persistidos quando a aba volta ao foco (ver `use-session-clock.ts`); só o aviso sonoro em si pode falhar. Não há Service Worker/Notifications API aqui para contornar isso.
**Implicação:** quando T-020 construir preferências reais, mover `soundEnabled` de `useState` local para o store/tabela de configurações é a única mudança necessária — a lógica do `useCompletionChime` já está isolada e não precisa mudar.

## 2026-10-13 — Transições de foco (T-019) usam update condicional por status, não só o trigger do banco

**Decisão:** `transitionSession()` (`src/features/focus/api/focus-sessions-repository.ts`) só aplica o `UPDATE` se a sessão ainda estiver em um dos `fromStatuses` esperados (`.eq('id', id).in('status', fromStatuses)`). Se zero linhas baterem — porque uma requisição anterior (a mesma, reenviada após perder a resposta por queda de conexão) já moveu a sessão para a frente —, busca e devolve o estado **atual** da sessão em vez de tentar aplicar o patch de novo ou lançar erro.
**Motivo:** o trigger do T-013/T-016 já garante que o evento de recompensa nunca duplica, mas ele não protege os outros campos da sessão (`paused_at`, `ended_at`, `accumulated_pause_seconds`) de serem sobrescritos por um `UPDATE` de retry sem essa guarda. Sem o guard condicional, um "confirmar" reenviado (resposta perdida, usuário ou rede reenvia) sobrescreveria `ended_at` com um timestamp mais tardio; um "pausar" reenviado sobrescreveria `paused_at`, fazendo o próximo "retomar" calcular `accumulated_pause_seconds` errado (contando pausa de menos). Isso é silencioso — não gera erro nem evento duplicado — mas corrompe dados.
**Por que devolver o estado atual em vez de erro:** do ponto de vista do usuário, a ação (pausar/confirmar/cancelar) já tinha funcionado na primeira tentativa; mostrar um erro para o retry seria enganoso. `useSessionTransitionMutation` recebe de volta a sessão verdadeira e sincroniza a UI com ela.
**Validado:** testes de repositório mockados cobrindo exatamente esse cenário (update condicional não bate nenhuma linha → busca e retorna o estado atual, com o timestamp do retry explicitamente descartado). Não precisou de migration nova — é lógica de aplicação, não de banco.

## 2026-10-13 — Lacuna encontrada e corrigida: `profiles` nunca tinha uma linha para a conta existente

**Decisão:** nova migration (`20261013174059_create_profile_on_signup.sql`) cria um trigger `handle_new_user()` em `auth.users` que insere a linha em `public.profiles` automaticamente, e faz backfill imediato para usuários já existentes.
**Motivo:** a tabela `profiles` existe desde o T-007, mas nada nunca criou a linha para a conta real — ela foi criada direto no painel do Supabase (não pelo fluxo de signup da própria app, que está desabilitado). Sem essa linha, T-020 (preferências em `profiles.settings`) não teria onde persistir nada. Descoberto ao tentar implementar T-020 e confirmar via `supabase db query --linked` que `select * from profiles` retornava vazio.
**Validado:** rodei a query direto no banco depois do push — a linha existe agora, com `timezone='UTC'` (padrão) e `settings={}`.

## 2026-10-13 — Preferências de foco armazenadas em `profiles.settings.focus` (JSON), não em tabela própria

**Decisão:** presets de duração, descanso curto/longo, som e movimento reduzido ficam dentro do JSON `profiles.settings`, sob a chave `focus`, lidos/escritos via `parseFocusPreferences()`/`updateFocusPreferences()` (`src/features/settings/`). Dados ausentes ou inválidos nessa chave caem para `DEFAULT_FOCUS_PREFERENCES` por completo (sem merge parcial de campo individual invalido).
**Motivo:** a coluna `settings jsonb` já existe desde o T-007 exatamente para isso (seção 7.3 do Plan.md). Criar uma tabela `game_settings`/preferências dedicada agora seria prematuro para um blob de configuração de baixo risco, de um usuário só.
**Implicação:** futuras preferências de outras features (ex.: jornada, áudio de batalha) podem reutilizar o mesmo padrão, cada uma com sua própria chave dentro de `settings`, sem migration nova.

## 2026-10-13 — Descanso curto/longo (T-020) é só um timer local, sem persistência

**Decisão:** `RestBreakTimer`/`RestBreakPrompt` não criam nenhuma linha em `focus_sessions` nem em `productivity_events` — é um `setInterval` local, perdido se a aba fechar.
**Motivo:** o descanso é explicitamente opcional e não gera recompensa (RF-018, "sem transformar pausa em obrigação"); criar um registro persistente para algo que não conta XP e que o usuário pode pular a qualquer momento seria complexidade sem benefício real.
**Implicação:** se no futuro o descanso precisar aparecer em estatísticas (ex.: "tempo total de descanso"), será necessário promovê-lo a um registro persistido — não existe hoje.

## 2026-10-13 — "Semana" no histórico de foco é uma janela rolante de 7 dias, não semana de calendário

**Decisão:** `summarizeFocusHistory()` (`src/features/focus/stats.ts`) soma sessões concluídas nos últimos 7×24h corridos a partir de agora, não "desde segunda-feira" ou qualquer início de semana fixo.
**Motivo:** Plan.md não especifica o dia de início da semana; uma janela rolante é mais simples de implementar e testar corretamente, e evita a escolha arbitrária de domingo vs. segunda.
**Implicação:** se o produto precisar de "semana de calendário" no futuro (ex.: para comparar com metas semanais fixas), é uma mudança isolada dentro de `summarizeFocusHistory`.

## 2026-10-13 — Timezone correto via `profiles.timezone` + `Intl.DateTimeFormat`, não o relógio da máquina

**Decisão:** `toZonedDateString()` usa `Intl.DateTimeFormat('en-CA', { timeZone, ... })` para obter o `YYYY-MM-DD` de um timestamp UTC no fuso **salvo no perfil** do usuário — não `Date.getFullYear()`/`getMonth()`/`getDate()` (que usam o fuso do dispositivo rodando o código).
**Motivo:** RNF-013 exige consistência de fuso nos agrupamentos; usar o fuso do dispositivo quebraria ao acessar de outro computador/fuso. `profiles.timezone` (default `'UTC'`) agora tem uma UI para ajustar (`TimezoneSettings`, botão "usar fuso deste navegador").
**Nota de inconsistência conhecida:** `src/features/tasks/scheduling.ts` (`todayIsoDate()`, usado para separar tarefas em Hoje/Pendentes/Futuras no T-012) ainda usa o fuso local do dispositivo, não `profiles.timezone`. Não corrigi isso agora porque está fora do escopo do T-020 (é sobre tarefas, não foco) — fica registrado aqui como pendência para quando alguém tocar em agrupamento de tarefas por data de novo.

## 2026-10-13 — T-003 (regras do jogo) feito junto com o T-021 (motor), não antes

**Decisão:** `docs/GAME_RULES.md` foi escrito na mesma sessão que `src/features/battles/engine.ts`, em vez de ser um documento isolado produzido muito antes do código (como a Fase 0 do Plan.md sugeria).
**Motivo:** escrever a matemática do jogo em abstrato, sem nenhum código real pra validar contra, tinha alto risco de ficar bonito no papel e errado na prática (unidades inconsistentes, casos de borda esquecidos). Fazer os dois juntos, com os exemplos verificáveis do doc virando os testes do motor **linha por linha**, garante que o documento descreve o que o código realmente faz.
**Implicação:** qualquer mudança futura nas constantes/fórmulas deve atualizar os dois arquivos juntos — o doc não é uma referência "histórica", é a especificação viva.

## 2026-10-13 — XP de bônus de batalha é só um número hoje; não há onde persistir ainda

**Decisão:** `resolveBattle()` e todo `src/features/battles/engine.ts` são funções puras, sem nenhuma tabela `battles`/`battle_commitments` por trás. Nada na UI chama esse motor ainda.
**Motivo:** persistir resultado de batalha com integridade transacional (RNF-006: "o cliente nunca é fonte confiável do próprio XP") exige a RPC/transação do T-022, que ainda não existe. Implementar o motor primeiro, puro e bem testado, e só depois construir a casca transacional em volta dele, é mais seguro do que tentar os dois ao mesmo tempo.
**Implicação:** T-022 vai chamar essas funções exportadas (`getViableCommitments`, `resolveBattle`, etc.) dentro de uma RPC/Edge Function, não reimplementar a lógica em SQL.

## 2026-10-13 — `PartySnapshot` simplificado a `averageLevel`, sem tipos elementais

**Decisão:** o motor de batalha considera só o nível médio do time para o multiplicador de XP e a redução de dificuldade — nenhuma vantagem/desvantagem de tipo (fogo vs. água etc.).
**Motivo:** o catálogo de Pokémon com tipos (T-024) não existe ainda; modelar vantagem elemental sem dados reais de tipo seria adivinhação. RF-027 só pede "mostrar como a força do time modifica facilidade e recompensas" — nível médio já cumpre isso de forma auditável.
**Implicação:** se tipos elementais forem adicionados depois, o multiplicador pode ganhar um fator extra sem quebrar a assinatura de `PartySnapshot` (é só adicionar campos opcionais).

## 2026-10-13 — Vulnerabilidade real encontrada e corrigida: `anon` conseguia forjar XP via RPC direta

**O que aconteceu:** `resolve_pending_battle` (T-022) recebe os valores de "cumprimento" (`p_fulfillment_difficulty`, `p_fulfillment_minutes`) como **argumentos**, não relendo da tabela. Isso é necessário para o design de trigger, mas significa que qualquer um com `EXECUTE` nessa função pode passar qualquer valor e forjar XP. Eu revoguei `EXECUTE` de `public` e `authenticated` na mesma migration que criou a função — mas **esqueci do papel `anon`**, que o Supabase concede `EXECUTE` em toda função nova por padrão (confirmado consultando `information_schema.routine_privileges`).
**Como descobri:** testei deliberadamente uma chamada forjada via `curl` contra `/rest/v1/rpc/resolve_pending_battle` usando só a `anon` key, esperando um erro de permissão — e recebi `204` (sucesso). Se eu não tivesse testado esse caminho especificamente, essa falha teria ido para produção.
**Correção:** migration separada (`20261013185117_revoke_anon_resolve_pending_battle.sql`) revogando `EXECUTE` de `anon` também. Testei de novo após a correção: `401`, `"permission denied for function resolve_pending_battle"`.
**Lição registrada para qualquer função `SECURITY DEFINER` futura que não seja `returns trigger`:** sempre revogar de **`public`, `authenticated` E `anon`** explicitamente (não basta revogar de `public` assumindo que cobre os outros papéis — grants default do Supabase por papel não seguem necessariamente a cadeia de herança de `PUBLIC`), e **sempre testar com `curl` usando a `anon key` sem autenticação** antes de considerar uma função privilegiada seura. Funções `returns trigger` são naturalmente seguras contra chamada direta (Postgres rejeita a convenção de chamada), então esse risco só existe pra funções com retorno normal chamadas por triggers via `perform`.

## 2026-10-13 — Resolução de batalha em SQL/PLpgSQL duplica a lógica de `engine.ts`, não reutiliza via Edge Function

**Decisão:** `resolve_pending_battle` reimplementa em SQL as mesmas fórmulas de `src/features/battles/engine.ts` (XP por dificuldade/minuto, multiplicador de time), em vez de uma Edge Function (Deno) chamando o motor TypeScript real.
**Motivo:** este projeto não tem nenhuma Edge Function implantada ainda; configurar esse runtime (Deno, `supabase functions deploy`, testes próprios) seria um salto de infraestrutura maior que o escopo do T-022. Um trigger `SECURITY DEFINER` em PL/pgSQL é suficiente para a garantia transacional exigida (RNF-006) e já segue o padrão estabelecido em T-013/T-016.
**Risco aceito:** as fórmulas agora existem em **dois lugares** (TS para preview client-side de "compromissos viáveis" antes de começar; SQL para a resolução autoritativa) e podem divergir se alguém atualizar um sem o outro. `docs/GAME_RULES.md` é o árbitro — qualquer mudança de fórmula precisa atualizar os três (doc, `engine.ts`, migration SQL) juntos.
**Quando reconsiderar:** se o motor ganhar lógica significativamente mais complexa (tipos elementais, múltiplos bônus combinados), migrar para uma Edge Function que importa `engine.ts` diretamente elimina essa duplicação — vale revisitar nessa hora.

## 2026-10-13 — Trigger de resolução de batalha nunca pode bloquear a conclusão da tarefa/sessão

**Decisão:** `resolve_battle_on_task_completed`/`resolve_battle_on_focus_session_completed` envolvem a chamada a `resolve_pending_battle` num bloco `BEGIN...EXCEPTION WHEN OTHERS THEN...END`, engolindo qualquer erro (só emite um `RAISE WARNING`, não propaga).
**Motivo:** como os triggers rodam na **mesma transação** da `UPDATE` que os disparou, uma exceção não tratada aqui reverteria a conclusão da tarefa/sessão inteira — violando diretamente o princípio não-negociável "a produtividade nunca depende de vencer uma batalha" (RF-021, seção 5.1 do Plan.md). Um bug na lógica de batalha nunca pode impedir que uma tarefa real seja marcada como concluída.
**Validado:** a lógica foi revisada para não ter nenhum caminho óbvio de exceção dado que as constraints do banco já impedem os estados inconsistentes que poderiam causá-la; não forcei uma falha deliberada para testar isso (exigiria burlar constraints de propósito), então fica registrado como verificado por revisão de código, não por injeção de falha.

## 2026-10-13 — T-023 integrado só na tela de Foco, não em Tarefas

**Decisão:** o fluxo de encontro/batalha (`EncounterCard` → iniciar sessão + criar batalha → `ActiveSessionPanel` com indicador secundário → `BattleResultSection` ao confirmar) foi conectado apenas na `FocusPage`. A `TasksPage` continua sem nenhuma opção de aceitar um encontro ao concluir uma tarefa.
**Motivo:** sessões de foco têm um gate natural de "antes de começar" (o botão Iniciar), que é exatamente onde RF-022 exige mostrar o compromisso. Tarefas são criadas e concluídas em momentos não planejados (RF-009: conclusão de um clique) — encaixar "escolher um encontro" nesse fluxo exigiria um redesenho da UX de tarefas que não estava no escopo combinado para este task.
**Implicação:** `EncounterCard`/`BattleSequence`/`BattleResultCard` já são genéricos (`commitmentType: 'task' | 'focusSession'`) e os testes já cobrem o caminho `task` isoladamente — plugar isso em `TasksPage` no futuro é majoritariamente só wiring, não motor novo. A cópia de `EncounterCard`'s botão de pular ("Focar sem encontro") é específica de foco; precisará de uma prop de label ao reutilizar em tarefas.

## 2026-10-13 — Gerador de encontro aleatório é um placeholder até o T-028 (campanha)

**Decisão:** `generateRandomEncounter()` sorteia tipo (ponderado) e dificuldade (1–5) sem nenhuma noção de região/rota/progressão — é puramente aleatório, gerado no cliente, efêmero (não persiste até o usuário aceitar).
**Motivo:** o sistema de campanha/rotas (T-028) não existe; "o motor determina o próximo encontro válido" (seção 5.2 do Plan.md) pressupõe dados de rota que ainda não foram modelados. Um gerador aleatório simples é suficiente para exercitar a cadeia completa (card → aceitar → resolver → resultado) sem fingir uma progressão que não existe.
**Implicação:** quando o T-028 existir, `generateRandomEncounter` é substituído por uma função que consulta `campaign_nodes`/`encounter_tables` — a assinatura (`() => Encounter`) e tudo que a consome (`EncounterCard`, `FocusPage`) não precisam mudar.

## 2026-10-13 — "Mostrar adversário e time de maneira secundária" (T-018) finalmente cumprido, só para foco

**Decisão:** enquanto uma sessão de foco ativa tem uma batalha vinculada, a `FocusPage` mostra uma linha discreta ("Encontro: ... — compromisso: ...") abaixo do `ActiveSessionPanel`, sem nenhuma animação nem elemento chamativo durante o foco em si (T-023: "não rodar animação... durante foco").
**Motivo:** esse era um item do checklist do T-018 que eu tinha deixado explicitamente pendente por falta de dados de batalha; agora que `battles` existe, dá pra cumprir.

## 2026-10-13 — Catálogo de espécies (T-024): escopo curado de 17 espécies, evolução hardcoded

**Decisão:** `species_catalog` tem só os 3 iniciais de Sinnoh (Turtwig, Chimchar, Piplup) + suas linhas evolutivas completas, mais 3 linhas comuns de rota inicial (Starly, Bidoof, Shinx) — 17 espécies no total, não o Pokédex completo. As relações de evolução (`evolves_to_pokedex_number`, `evolution_min_level`) foram **digitadas manualmente** em `scripts/import-species-catalog.ts` a partir de fatos reais dos jogos (Diamond/Pearl/Platinum), não derivadas do endpoint `evolution-chain` da PokéAPI.
**Motivo:** T-004/T-024 pedem definir "quais espécies... entram no MVP" — um recorte pequeno e deliberado é suficiente pra iniciais + primeiros encontros, sem ambição de Pokédex completa agora. Parsear o grafo de `evolution-chain` da PokéAPI é não-trivial (estrutura aninhada, múltiplos ramos) e não compensa pra um lote tão pequeno e estável de fatos já conhecidos.
**Validado contra a API real:** o script roda contra `pokeapi.co` de verdade (não dados inventados) — tipos, sprites e official-artwork vieram de lá; só a relação de evolução é conhecimento hardcoded.
**Implicação:** ampliar o catálogo é rodar `npm run catalog:import` de novo com mais entradas em `CURATED_SPECIES`, revisar o SQL gerado, e criar uma nova migration — nunca editar as migrations de seed já aplicadas.

## 2026-10-13 — Sprites referenciados por URL (CDN da PokéAPI), não re-hospedados

**Decisão:** `species_catalog.sprite_url`/`official_artwork_url` apontam para `raw.githubusercontent.com/PokeAPI/sprites` — não baixamos/re-hospedamos os bytes da imagem no Supabase Storage.
**Motivo:** montar um pipeline de asset storage próprio (upload, CDN, invalidação) seria um salto de infraestrutura fora do escopo do T-024; o CDN da PokéAPI é público, estável e é exatamente a fonte que o Plan.md já indicava usar.
**Mitigação do risco de link quebrado:** `SpeciesSprite` tem fallback real pra um glyph genérico (`onError`), testado explicitamente simulando falha de carregamento de imagem — satisfaz o requisito de "incluir fallback" sem precisar controlar a disponibilidade do CDN de terceiros.

## 2026-10-13 — Atribuição de dados da PokéAPI

**Decisão:** espécies, tipos, nomes e sprites vêm da [PokéAPI](https://pokeapi.co) (dados públicos sobre a franquia Pokémon; Pokémon é marca da Nintendo/Game Freak/Creatures Inc., não da PokéAPI nem deste projeto). Este app é de uso pessoal e privado (RNF-014, seção 1.2 do Plan.md: "o caráter privado não garante isenção de direitos autorais") — os dados/sprites não são redistribuídos como produto próprio, nem usados para fins comerciais.
**Onde fica registrado:** este item do `DECISIONS.md` + os comentários em `scripts/import-species-catalog.ts` e na migration de seed, apontando a fonte e a data da importação.

## 2026-10-13 — Segunda lição sobre grants: `PUBLIC` é diferente de `anon`/`authenticated`

**O que aconteceu:** `capture_from_battle`/`swap_party_positions` (T-025) vieram, na criação, com um grant de `EXECUTE` pro papel `PUBLIC` — distinto dos grants individuais por papel (`anon`, `authenticated`) que vi no T-022. Um `revoke ... from anon` sozinho **não** removeria esse acesso, porque `PUBLIC` é um grant guarda-chuva que se aplica a todo papel independentemente de grants individuais.
**Por que não foi um incidente de verdade:** testei com `curl` usando a `anon` key antes de seguir adiante (lição do T-022 aplicada) — a chamada foi aceita (sem erro de permissão), mas retornou "Batalha não encontrada" sem nenhum efeito, porque as duas funções filtram tudo por `owner_id = auth.uid()`, que é `null` pra uma requisição anônima. Então, diferente do `resolve_pending_battle` (que confiava em parâmetros forjáveis), essas funções são seguras _mesmo com_ `EXECUTE` amplo — mas eu revoguei de `PUBLIC` mesmo assim, por defesa em profundidade e pra não depender só desse raciocínio.
**Lição combinada com a do T-022:** antes de considerar uma função `SECURITY DEFINER` (ou qualquer RPC sensível) seguramente restrita, checar a lista completa de `grantee` em `information_schema.routine_privileges` — não assumir que revogar de `anon`/`authenticated` cobre `PUBLIC`, nem o contrário — e sempre testar com `curl`/anon key como prova final, não só a leitura da tabela de grants.

## 2026-10-13 — Rollback automático do PL/pgSQL evita Pokémon órfão em corrida de captura

**Decisão:** `capture_from_battle` insere em `owned_pokemon` e depois em `captures` dentro do mesmo bloco `begin...exception`; se a segunda inserção falhar por `unique_violation` (a mesma batalha já foi capturada por uma requisição concorrente), o handler de exceção devolve o Pokémon do vencedor da corrida — sem precisar de limpeza manual.
**Por que isso não deixa um Pokémon "fantasma":** no PL/pgSQL, uma `EXCEPTION` associada a um bloco desfaz **todo** o trabalho feito desde o início daquele bloco (como um savepoint implícito), não só a instrução que falhou — então o `insert` em `owned_pokemon` da requisição perdedora é revertido automaticamente junto com o `insert` em `captures` que falhou.
**Validado:** script de verificação (`supabase/verification/t025-capture-and-party.sql`) confirma que capturar a mesma batalha duas vezes retorna o **mesmo** `owned_pokemon.id` e deixa exatamente uma linha em `owned_pokemon`/`captures`.

## 2026-10-13 — Troca de posição no time via RPC, não três chamadas separadas do cliente

**Decisão:** `swap_party_positions` troca as posições de dois Pokémon dentro de uma função `SECURITY INVOKER` (três `UPDATE`s em sequência: libera a posição de A, move B pra posição antiga de A, move A pra posição antiga de B), em vez de três chamadas separadas do cliente JS.
**Motivo:** o índice único parcial em `(owner_id, party_position)` rejeitaria um `UPDATE` que tentasse colocar dois Pokémon na mesma posição, mesmo que momentaneamente — três chamadas de rede separadas do cliente arriscam deixar a troca pela metade se a conexão cair entre uma e outra. Uma função só, com as três etapas na mesma transação implícita, é atômica.
**Por que `SECURITY INVOKER`, não `DEFINER`:** RLS em `owned_pokemon` já restringe cada `UPDATE` ao próprio dono (`owner_id = auth.uid()`); não há nada sensível o suficiente aqui pra justificar rodar como um papel privilegiado — ao contrário de `resolve_pending_battle`/`capture_from_battle`, que decidem crédito de XP/criação de Pokémon.
**Validado:** script de verificação confirma que trocar dois Pokémon de posição (incluindo box↔time) produz o resultado esperado sem violar a constraint de posição única.

## 2026-10-13 — Lacuna real encontrada no início do T-026: RLS não restringe colunas, só linhas

**O que aconteceu:** a política de `UPDATE` em `owned_pokemon` (T-025) só verifica `owner_id = auth.uid()` — isso restringe **quais linhas**, não **quais colunas**. Como o grant padrão de `UPDATE` do Supabase cobre a tabela inteira, um usuário autenticado podia, legalmente, dar `PATCH` no próprio Pokémon e mudar `level`, `xp` ou `pokedex_number` pra qualquer valor, contornando todo o sistema de recompensa que o T-026 estava construindo.
**Como descobri:** percebi isso ao planejar a RPC de evolução — se o cliente já pudesse escrever `pokedex_number` livremente, a RPC toda seria decorativa. Confirmei consultando `information_schema.column_privileges`: `anon` e `authenticated` tinham `UPDATE` em **todas** as colunas, não só `party_position`.
**Correção:** `revoke update on owned_pokemon from authenticated, anon; grant update (party_position, nickname) on owned_pokemon to authenticated;` — agora só essas duas colunas são editáveis direto pelo cliente; `level`/`xp`/`pokedex_number`/`pending_evolution_to_pokedex_number` só mudam via função `SECURITY DEFINER`.
**Validado com papel real, não só com `postgres`:** testei com `SET ROLE authenticated` (não bastava testar como `postgres`, que ignora grants de coluna) — confirmei que `party_position` continua editável e `level` é rejeitado com `insufficient_privilege`.
**Lição combinada com as de T-022/T-025:** RLS (linhas), grants de função (`EXECUTE`) e grants de coluna (`UPDATE (colunas)`) são **três mecanismos independentes** no Postgres — nenhum cobre os outros dois. Qualquer tabela nova com colunas "resultado"/"pontuação" precisa ser revisada nos três eixos, não só no de RLS.

## 2026-10-13 — Curva de XP "medium fast" (nível³), versionada

**Decisão:** `totalXpForLevel(level) = level³` (mesma curva "medium fast" dos jogos de Pokémon), implementada em paralelo em `src/features/pokemon/xp.ts` (TS, pra UI) e `total_xp_for_level()` (SQL, pra trigger) — mesma duplicação já documentada para o motor de batalha. Versionada via `XP_CURVE_VERSION = 1` no TS, mencionada aqui.
**Motivo:** curva bem conhecida, fácil de calcular nos dois lados sem tabela de lookup. "Versionada" aqui significa: se a fórmula mudar depois, bump da constante + decisão nova aqui — não uma tabela `game_settings` ainda (mesma decisão já tomada para as constantes de batalha).
**Nota de aritmética:** a função SQL usa multiplicação exata (`level::bigint * level::bigint * level::bigint`), não o operador `^` do Postgres — `^` promove pra `double precision`, e evitei qualquer ambiguidade de arredondamento mesmo que inofensiva nos níveis 1–100.

## 2026-10-13 — Evolução em múltiplos estágios: o pendente é sempre o alvo mais avançado elegível, recalculado do zero

**Decisão:** o trigger de level-up recalcula a cadeia de evolução inteira a partir da espécie **atual** (`pokedex_number`, que só muda quando `confirm_evolution` é chamado) a cada vez que o nível muda — nunca incrementa o campo pendente de forma incremental. Um salto grande de XP (ex.: nível 5 → 40) grava direto o estágio final elegível (Torterra), pulando o estágio intermediário (Grotle) no campo pendente — mas um salto pequeno (nível 5 → 31, abaixo do limiar de Torterra) corretamente fica pendente em Grotle, não em Torterra.
**Por que recalcular do zero em vez de só avançar:** garante que o campo pendente reflita sempre a verdade atual, mesmo que o usuário não confirme evoluções por um tempo e continue ganhando XP — não haveria como "perder" uma atualização de estágio.
**Pendência sem solução de trade/pedra:** nenhuma das 17 espécies do catálogo evolui por troca ou pedra (todas são por nível), então essa lacuna do checklist do T-026 ("alternativas explícitas a trocas/itens impossíveis") não teve um caso real pra resolver ainda. Política decidida preventivamente: se uma espécie assim entrar no catálogo no futuro, `evolves_to_pokedex_number` fica `null` pra ela (sem evolução automática) até uma decisão explícita documentada aqui — nunca fingir um requisito de nível que não existe de verdade no jogo original.

## 2026-10-13 — Evolução é só confirmável pelo cliente, nunca escolhida

**Decisão:** `confirm_evolution(id)` só aplica o `pending_evolution_to_pokedex_number` que o trigger já decidiu; não existe nenhuma via pela qual o cliente escolha ou force um alvo de evolução diferente. `EvolutionPrompt` no frontend só tem "Evoluir agora"/"Depois" — nenhum seletor de espécie.
**Motivo:** consistente com a restrição de colunas acima — `pokedex_number` nunca é editável direto pelo cliente, então mesmo a confirmação de evolução passa por uma função que só move um valor já decidido, nunca aceita um novo.
**"Pulado e retomado":** "Depois" só esconde o aviso localmente neste componente (estado React); a flag `pending_evolution_to_pokedex_number` continua na linha do banco, então reabrir a tela de Equipe mostra o aviso de novo — não há como perder essa evolução pendente por navegar pra outro lugar.

## 2026-10-13 — `BASE_FOCUS_MINUTES_PER_DIFFICULTY` reduzido de 15 para 1 minuto

**Decisão:** o mínimo de foco exigido pro encontro mais fácil (selvagem, dificuldade 1) caiu de 15 min para 1 min. Pedido explícito do usuário ao testar o T-026 — 15 min reais por teste de batalha/captura tornava o ciclo de desenvolvimento/uso diário impraticavelmente lento.
**O que NÃO muda:** `FOCUS_XP_PER_MINUTE` continua 1.5 — uma sessão normal de 25–60 min rende exatamente o mesmo XP de antes. A constante alterada é só o **mínimo pra qualificar** o encontro mais fácil, não a recompensa por tempo real investido. `TASK_XP_PER_DIFFICULTY` e as constantes de time não mudaram.
**Onde foi atualizado:** `src/features/battles/engine.ts` (a constante + comentário com a data/motivo), `docs/GAME_RULES.md` (fórmula, teto de 5 min em vez de 75, e os dois exemplos verificáveis que dependiam do valor antigo), `engine.test.ts` e `FocusPage.test.tsx` (expectativas numéricas).
**Nenhuma migration necessária:** `BASE_FOCUS_MINUTES_PER_DIFFICULTY` só existe no lado cliente (`getViableCommitments`, chamado ao montar o `EncounterCard`) — o valor final já calculado é gravado em `battles.commitment_min_duration_minutes` na criação; a resolução no banco (`resolve_pending_battle`) só compara contra o que já foi salvo, nunca recalcula a fórmula.
**Pendência de teste:** dei um Chimchar (nível 5, 125 XP, slot 1 do time) direto via SQL pro usuário testar time/evolução sem precisar passar pela captura de novo — não é uma captura real, é um dado de teste.

## 2026-10-13 — Pokémon inicial concedido manualmente, sem fluxo de onboarding

**Decisão:** o usuário recebeu um Chimchar diretamente via `insert` no banco, não pela captura normal — porque não existe nenhum fluxo de escolha de inicial ainda (T-029, Fase 5, não construído).
**Motivo:** o usuário pediu explicitamente ("preciso que você me dê algum pokémon pra testar"), e sem um Pokémon nenhuma feature de time/evolução pode ser testada manualmente.
**Implicação:** isso não é uma captura real (não existe linha em `captures`, não passou pelo `capture_from_battle`) — é só um dado de teste. Quando o T-029 existir, ele vai lidar com a escolha real do inicial; esse Chimchar manual não precisa ser removido nem migrado, é só mais um Pokémon na coleção do usuário como outro qualquer.

## 2026-10-13 — Curva de XP validada por simulação, não só por fórmula

**Decisão:** depois que o teste manual do T-026 pareceu "lento" (nível 13→14 exigindo 547 XP, levando a crer que havia um bug), investiguei e confirmei que **não havia bug** — o ganho real por batalha estava correto (2197→2207 em 3 batalhas pequenas). O problema era de expectativa, não de código: sessões de 1-3 min (ajustadas só pra teste rápido) rendem pouquíssimo XP, e a curva cúbica tem saltos grandes entre níveis.
**Validação feita:** escrevi simulações de uso realista (`balance-simulation.test.ts`) com um perfil moderado (2 tarefas + 1 sessão de 30 min/dia, nada de sessões de 1 min) — 7 dias ≈ nível 9, 30 dias ≈ nível 15, 90 dias ≈ nível 22. Isso parece uma progressão razoável pra um app de produtividade de uso diário real; a curva **não foi alterada**.
**Lição:** antes de decidir "a curva está errada" a partir de um teste manual, simular o uso realista primeiro — testes manuais rápidos (sessões de 1 min, poucas iterações) não são representativos do ritmo real de acumulação de XP.

## 2026-10-13 — Anti-fracionamento de tarefas (T-027): retornos decrescentes diários, não um limite rígido

**Decisão:** as primeiras 5 tarefas recompensadas no dia rendem XP cheio; a partir da 6ª, metade (`TASK_XP_DIMINISHED_MULTIPLIER = 0.5`). Não é um corte total (zero XP) nem um limite de quantidade de tarefas que pode ser concluída — só o bônus de XP diminui.
**Motivo:** um corte rígido ("só as 5 primeiras tarefas contam") puniria dias genuinamente produtivos com mais de 5 tarefas reais; retornos decrescentes desincentivam especificamente o **fracionamento artificial** (quebrar uma tarefa grande em várias pequenas, ou spammar tarefas triviais) sem penalizar produtividade real. Sessões de foco não precisam dessa proteção — o XP já é linear nos minutos reais, fracionar uma sessão longa em várias curtas rende o mesmo total.
**Implementado em dois lugares:** `applyDailyTaskDiminishingReturns()` em TypeScript (pura, recebe a contagem como parâmetro, testável sem banco) e replicada em `resolve_pending_battle` (SQL, onde a contagem real de tarefas recompensadas hoje é calculada) — mesma duplicação já aceita para as outras fórmulas do motor.
**Validado contra o banco real:** script que completa 6 tarefas triviais em sequência confirma 20 XP para as 5 primeiras, 10 XP pra sexta — `supabase/verification/t027-task-anti-fractionation.sql`, zero resíduo.
**Pendência conhecida:** como `TasksPage` ainda não oferece vincular um encontro a uma tarefa (decisão do T-023), esse caminho de recompensa — e, portanto, esse mecanismo anti-abuso — não é alcançável pela UI real ainda. Fica validado e pronto para quando essa integração existir.

## 2026-10-13 — Campanha declarativa (T-028, cobrindo também o T-004): conteúdo em TS, enforcement no banco

**Decisão:** o conteúdo da campanha é escrito em `src/features/journey/content/` (um arquivo por região, tipado e validado por Zod), vira SQL por `npm run campaign:seed` e chega ao banco só por migration de seed revisada — mesmo fluxo do catálogo de espécies. Em runtime o app lê as tabelas (`campaign_regions`, `campaign_nodes`, `campaign_node_prerequisites`), não o arquivo TS.
**Motivo:** uma única fonte em runtime — a mesma que os triggers usam pra validar — evita a UI mostrar um nó que o banco rejeita. O arquivo TS é só a forma de autoria, onde dá pra validar o conteúdo antes de ele existir no banco.
**Validação de conteúdo:** `validateCampaignRegion` acusa id duplicado, link quebrado, pré-requisito que vem depois na ordem da história, nó inalcançável (inclui ciclos), encontro incompatível com o tipo do nó e nó repetível que não é rota. O script de seed se recusa a gerar SQL se houver qualquer problema, e um teste garante que o conteúdo de Sinnoh versionado passa.
**Narrativa (T-004):** nomes de lugares e personagens seguem os marcos dos jogos; todo texto é original e curto, sem diálogo copiado.
**Risco aceito:** editar o conteúdo TS sem gerar uma nova migration deixa arquivo e banco divergentes — nada detecta isso automaticamente. `contentVersion` (gravado em `campaign_regions.content_version`) é o que permite conferir à mão.

## 2026-10-13 — Desbloqueio da campanha é derivado, e aplicado por trigger em `battles`

**Decisão:** não existe um ponteiro "nó atual" salvo. Um nó está desbloqueado quando todos os pré-requisitos têm `completed_at` em `campaign_node_progress`; o "próximo encontro" é o primeiro nó disponível na ordem da história (ou a última rota repetível, quando a história acaba). O cliente calcula isso só pra exibir (`journey/domain.ts`); quem decide é o trigger `enforce_campaign_node_on_battle`, que recusa batalha em nó bloqueado ou já concluído (não repetível), sobrescreve tipo/dificuldade do encontro com os do nó e recusa compromisso abaixo do mínimo do nó.
**Motivo:** estado derivado não dessincroniza; e sem o trigger o cliente poderia declarar uma batalha de ginásio num nó bloqueado, ou com compromisso de 1 minuto, e avançar a campanha.
**Progresso:** gravado por um trigger `after update` em `battles` (vitória em batalha com nó), na mesma transação da resolução — batalha vencida e progresso registrado andam juntos ou não acontecem. O cliente não tem grant de escrita nas tabelas de campanha (revogado no nível de grant, além do RLS).
**Mínimo do compromisso duplica uma fórmula:** o trigger repete a redução por time de `computeEffectiveDifficulty` (1 ponto a cada 10 níveis médios, piso 1; 1 minuto de foco por ponto). Se `TEAM_REDUCTION_PER_LEVELS` ou `BASE_FOCUS_MINUTES_PER_DIFFICULTY` mudarem em `engine.ts`, o trigger precisa de migration junto.
**`battles.campaign_node_id` é opcional:** uma batalha sem nó continua válida e rende XP como antes, só não move a campanha. Tornar obrigatório quebraria as linhas antigas e não fecha nenhum abuso (XP depende do que foi cumprido, não do encontro).
**Validado contra o banco real:** `supabase/verification/t028-campaign-unlock.sql` — 9 cenários (nó bloqueado, sobrescrita do encontro, conclusão, repetição, rota repetível, compromisso abaixo do mínimo, retirada sem progresso, redução por time, escrita negada ao papel `authenticated`). Esse script mexe no progresso real do usuário, então roda tudo numa subtransação que é sempre revertida, em vez de limpar linha a linha. `anon` recebe 401 nas quatro tabelas via `curl`.

## 2026-10-13 — Gerador de encontro aleatório removido; Foco usa o objetivo da campanha

**Decisão:** `encounter-generator.ts` (placeholder do T-023) foi apagado. A tela de Foco mostra o encontro do objetivo atual da campanha; se a campanha não carregar, cai no formulário de foco simples, sem encontro.
**Consequência:** o encontro não muda ao recarregar a página (é função do progresso salvo).
**Limitações conhecidas:** (1) o card ainda mostra o compromisso sem a redução por time (`NO_PARTY`), então pode pedir mais do que o banco exigiria — nunca menos; (2) não dá pra escolher em qual nó desbloqueado lutar, é sempre o objetivo; (3) a espécie selvagem ainda é sorteada do catálogo inteiro, sem tabela por rota (T-030); (4) vencer o ginásio conclui o nó mas ainda não dá insígnia (T-031).

## 2026-10-13 — Sinnoh completa no seed (conteúdo v2): o enredo inteiro do Platinum, linear

**Decisão:** a pedido do usuário, o conteúdo passou de 8 para 96 etapas, cobrindo o Platinum inteiro na ordem do jogo: 8 ginásios (Roark, Gardenia, Fantina, Maylene, Crasher Wake, Byron, Candice, Volkner), arco da Equipe Galáctica, Distortion World e Giratina, Liga (Elite dos Quatro e Cynthia) e o pós-jogo de Stark Mountain. Os 8 ids do seed v1 foram mantidos, então progresso já existente continua valendo.
**História linear:** cada etapa exige a anterior (helper `chain` em `sinnoh.ts`). Áreas que no jogo são opcionais (Wayward Cave, Fuego Ironworks, Iron Island, Rota 212) entram como etapas obrigatórias, porque a tela de Foco sempre escolhe a primeira etapa disponível — uma etapa opcional viraria objetivo de qualquer jeito. O schema já aceita grafo (`requires` é uma lista); o que falta para ramificar é uma forma de o usuário escolher a etapa.
**Elite dos Quatro, Campeã e chefes da Equipe Galáctica são etapas `story` com encontro `trainer`**, não `gym` — `gym` fica reservado para o que vai render insígnia no T-031. Lendários são etapas `story` com encontro `milestone`; ainda não há captura de lendário.
**Ritmo:** 161 vitórias do início ao fim do pós-jogo; dificuldade sobe de 1 para 5 ao longo dos capítulos. Com o mínimo de foco atual (1 minuto por ponto de dificuldade), o que limita o ritmo é quantas sessões o usuário faz, não a duração exigida. Não foi simulado; ajustar `requiredVictories` no conteúdo se ficar rápido ou lento demais no uso real.

## 2026-10-13 — Escolha do inicial (T-029): operação única garantida pela chave primária de `game_progress`

**Decisão:** a escolha fica em `game_progress` (uma linha por jogador, `owner_id` como chave primária) e só é gravada pela RPC `choose_starter(p_pokedex_number)`. A função recebe apenas a espécie; dono, nível (5), XP (125) e posição no time são decididos no banco. Registrar a escolha e criar o Pokémon acontecem na mesma transação.
**Por que a chave primária:** clique duplo, segundo dispositivo ou retry depois de queda de conexão caem todos no mesmo erro `23505`, antes de qualquer Pokémon ser criado. Não existe caminho para trocar de inicial: o cliente não tem grant de escrita na tabela.
**Onboarding não bloqueia nada:** `StarterOnboarding` é um cartão no topo de Dashboard, Equipe e Jornada enquanto não houver escolha. Tarefas e Foco funcionam igual sem inicial (batalha vencida sem time só deixa o XP no ledger, como já era). O cartão não aparece na tela de Foco de propósito, para não competir com a sessão.
**`23505` não é mostrado como erro:** significa que a escolha já existe (feita em outro lugar); o cartão relê o estado do servidor e some.
**Validado contra o banco real:** `supabase/verification/t029-starter-selection.sql` — sem usuário, espécie não inicial, escolha válida, segunda escolha (mesma e outra espécie) e escrita direta negada; tudo em subtransação revertida. `anon` recebe 401 na RPC via `curl`.
**Reinício da conta do usuário:** a pedido dele ("recomeçar do zero"), o Monferno de teste (nível 14, concedido manualmente) e o progresso da jornada (1 vitória em Twinleaf Town) foram apagados direto no banco, para ele passar pela escolha real. Batalhas e `reward_events` antigos foram mantidos como histórico; tarefas e sessões de foco não foram tocadas.
**Pendências:** não há tela de introdução narrativa além do texto do cartão; o inicial não está ligado a nenhuma etapa da campanha (dá para vencer encontros antes de escolher).

## 2026-10-13 — Catálogo ampliado para a Pokédex inteira do Platinum (210 espécies), evolução vinda da PokéAPI

**Decisão:** `scripts/import-species-catalog.ts` deixou de ter uma lista manual de 17 espécies e passou a importar a Pokédex regional do Platinum (`extended-sinnoh` na PokéAPI): nome, tipos, sprites, se é lendário/mítico (`is_legendary`, coluna nova) e a evolução, lida do grafo de evolução da própria API. O script também gera `src/features/journey/content/species-index.ts`, usado pelo validador de conteúdo.
**Motivo:** tabelas de encontro por rota (T-030) com só 17 espécies colocariam Starly, Bidoof e Shinx em todas as rotas de Sinnoh. A lista manual de evoluções não escala para 210.
**Regras de evolução adotadas (o jogo só conhece "evolui no nível N"):** (1) cada espécie evolui para a primeira evolução listada pela PokéAPI que também esteja na Pokédex — linhas ramificadas ficam com um único alvo fixo (Eevee → Vaporeon, Kirlia → Gardevoir, Snorunt → Glalie; Gallade, Froslass e as outras formas de Eevee existem no catálogo mas não são alcançáveis por evolução); (2) evolução por nível mantém o nível real; (3) evolução por pedra, troca, amizade, item ou local recebe um nível substituto: 25 para espécie na base da linha, 40 para as demais, e nunca menos de 10 níveis depois da evolução anterior (Rhydon → Rhyperior fica no 52).
**Consequência:** os tipos vêm da PokéAPI atual, então incluem Fada (Clefairy, Ralts, Mr. Mime...), que não existia no Platinum. Os valores das 17 espécies antigas não mudaram.
**Página Equipe:** o catálogo agora lista 210 sprites; as imagens passaram a carregar sob demanda (`loading="lazy"`). Continuam vindo do CDN da PokéAPI.

## 2026-10-13 — Encontros por rota (T-030): gerados e guardados no servidor antes do compromisso

**Decisão:** o próximo encontro é uma linha em `encounters`, criada pela RPC `get_or_create_encounter()` (sem argumentos): o servidor decide em qual etapa ele acontece (mesma regra de `pickObjective`) e, se for selvagem, sorteia espécie e nível da tabela daquela etapa (`campaign_node_wild_encounters`, peso por espécie). Existe no máximo um encontro aberto por jogador (índice único parcial). A batalha referencia o encontro (`battles.encounter_id`) e herda dele etapa, tipo, dificuldade, espécie e nível.
**Não rerrola:** pedir o encontro de novo (recarregar, outro dispositivo) devolve a mesma linha. Ele só é consumido quando uma batalha contra ele é **vencida**; retirada ou sessão cancelada deixam o mesmo encontro aberto, então abandonar uma sessão não compra um novo sorteio.
**Espécie nunca vem do cliente:** o trigger de `battles` zera `wild_species_pokedex_number`/`wild_level` enviados e preenche a partir do encontro (ou sorteia da tabela da etapa, para batalha que só informa a etapa). `resolve_pending_battle` deixou de sortear do catálogo inteiro na vitória; batalha selvagem sem etapa de campanha não tem o que capturar. É isso que garante "nenhum encontro fora da região".
**Captura no nível do encontro:** `capture_from_battle` cria o Pokémon no nível sorteado, com o XP correspondente (antes era sempre nível 5 com 0 XP).
**Lendários:** o validador de conteúdo recusa espécie lendária/mítica em qualquer tabela selvagem; eles aparecem só como marcos de história, sem captura por enquanto.
**Tabelas de Sinnoh:** 31 rotas/cavernas, 195 linhas, escritas de memória como aproximação do Platinum — não foram conferidas contra dados do jogo e só usam espécies do catálogo.
**Validado contra o banco real:** `supabase/verification/t030-route-encounters.sql` — distribuição de 4000 sorteios na Rota 201 dentro de 4 pontos dos pesos, todos os nós selvagens sorteando só da própria tabela, encontro estável em pedidos repetidos, espécie enviada pelo cliente descartada, retirada sem consumo nem captura, captura no nível certo, encontro consumido recusado, escrita e sorteio direto negados ao papel `authenticated`. `anon` recebe 401.
**Lição dos próprios testes:** dentro de uma única consulta o Postgres avaliou `roll_wild_encounter('...')` uma vez e reaproveitou a linha — 4000 "sorteios" idênticos. O teste passou a chamar a função uma vez por iteração de laço. O teste do T-029 também foi corrigido: contava iniciais de nível 5 no banco inteiro e quebrou assim que o usuário escolheu o inicial de verdade.
**Limitações:** a tela mostra o encontro só no Foco; não há tabela de treinadores (encontros `trainer` não têm time definido); o encontro aberto fica preso à etapa-objetivo, sem escolha de rota.

## 2026-10-14 — Insígnias (T-031): creditadas pelo trigger de resolução, uma por ginásio, ligadas à batalha vencedora

**Decisão:** a tabela `badges` tem chave primária `(owner_id, node_id)` e guarda o `battle_id` da vitória. A linha é inserida pelo mesmo trigger que registra o progresso da campanha (`record_campaign_progress_on_battle_resolved`), quando a vitória conclui uma etapa cujo conteúdo define `badge_name`. O cliente só lê.
**Por que no mesmo trigger:** vitória, insígnia e desbloqueio da etapa seguinte ficam na mesma transação — não existe estado em que o ginásio está vencido sem insígnia, ou o capítulo seguinte liberado sem ela. Se a transação falhar (rede, erro), nada disso acontece e a batalha continua pendente.
**Crédito único:** repetir a batalha é recusado (etapa de ginásio não é repetível) e, no caso de duas batalhas pendentes contra o mesmo ginásio vencidas em seguida (dois dispositivos), a chave primária deixa passar só a primeira; a segunda ainda conta como vitória e rende XP, mas não gera outra insígnia.
**Não dá para pular ginásio:** já era consequência dos pré-requisitos do T-028 (a história é linear); o T-031 só acrescentou o teste explícito.
**Insígnia é conteúdo:** o nome fica em `campaign_nodes.badge_name`, vindo de `sinnoh.ts`. O validador exige insígnia em toda etapa `gym`, proíbe nas demais e recusa nome repetido.
**Validado contra o banco real:** `supabase/verification/t031-gym-badges.sql` — ginásio fechado para jogador novo, capítulo seguinte bloqueado sem a insígnia, retirada sem insígnia, duas vitórias simultâneas com uma insígnia só (ligada à primeira), revanche recusada, capítulo seguinte liberado, etapa sem insígnia não altera a contagem, escrita negada ao papel `authenticated`. `anon` recebe 401.

## 2026-10-14 — Cenas narrativas (T-031): texto no conteúdo, "já vista" guardado só no dispositivo

**Decisão:** 42 etapas ganharam uma cena curta (`scene_intro`, e `scene_outro` quando faz sentido), escritas em `src/features/journey/content/sinnoh-scenes.ts` e semeadas em `campaign_nodes`. A introdução aparece na tela de Foco antes do card do encontro, uma fala por vez, com "Pular cena"; o desfecho aparece no resultado da batalha quando a etapa é concluída. Na Jornada, toda etapa desbloqueada tem "Rever cena".
**"Já vista" fica em `localStorage`, não no banco:** só decide se a cena toca sozinha. O pior caso (outro dispositivo, armazenamento limpo) é ver a mesma cena de novo, que se pula com um clique; não justifica tabela e escrita no servidor.
**Texto original:** os acontecimentos seguem o Platinum; nenhuma fala é citação do jogo.
**Camadas:** `battles` não importa `journey`. O card de resultado ganhou um espaço (`children` / `renderEpilogue`) que a página de Foco preenche com `VictoryEpilogue`; líder e recompensa chegam ao `EncounterCard` como texto simples.
**Limitações:** as cenas só aparecem pelo Foco (Tarefas ainda não têm encontro); o desfecho de uma etapa com mais de uma vitória só aparece na vitória que a conclui; líderes ainda não têm time de Pokémon definido; as insígnias aparecem só na Jornada (o Dashboard é o T-032).

## 2026-10-14 — Dashboard (T-032): seções independentes que leem o mesmo cache das páginas

**Decisão:** o Dashboard é composto por quatro seções em `src/pages/dashboard/` (Foco, Tarefas, Equipe, Jornada), cada uma usando os mesmos hooks — e portanto as mesmas chaves de cache — das páginas completas. Nenhuma consulta nova foi criada para o Dashboard: Tarefas usa `useTasks({ status: 'pending' })`, a mesma entrada da aba padrão da página Tarefas; Equipe usa `useOwnedPokemon` e o catálogo inteiro (um request, em cache por 24h) em vez de um lookup por Pokémon.
**Consequência:** ir do Dashboard para uma página (ou voltar) dentro do `staleTime` não dispara request, e concluir uma tarefa no Dashboard atualiza lista e contagens na hora pelo patch otimista que as mutations de tarefa já faziam — a invalidação continua restrita ao domínio `tasks`.
**Cada seção carrega e falha sozinha:** `WidgetCard` mostra skeleton no primeiro carregamento e, em erro, a mensagem amigável com "Tentar de novo"; as outras seções seguem funcionando.
**Tarefas prioritárias (`pickPriorityTasks`):** as de hoje, depois as atrasadas (mais antigas primeiro), depois as sem data; mais difíceis primeiro dentro de cada grupo; no máximo 5, com "+ N em Tarefas". Tarefas futuras não entram.
**Ordem no celular:** Foco, Tarefas, Equipe, Jornada — iniciar foco fica acima da dobra. Em telas largas a lista de tarefas ocupa a coluna esquerda.
**Offline:** aviso baseado em `navigator.onLine`. É só um indício (estar "online" não garante que a API responde) e o texto não promete que alterações feitas offline serão salvas.
**Layout testado por E2E com API simulada:** `tests/e2e/dashboard-layout.spec.ts` abre o Dashboard em 360, 768 e 1920 px com 60 tarefas de título longo e um time de 6, e verifica que não há rolagem horizontal e que as ações cabem na tela. Usa uma sessão falsa e intercepta todo request ao host do Supabase — nunca toca o projeto real — então roda também no CI. Conferi as capturas de 360 e 1920 px manualmente.
**Limitações:** não há prefetch nem medição de requests (T-034); o design visual segue o padrão provisório (T-033); as tarefas do Dashboard continuam sem encontro vinculado.

## 2026-10-14 — Design system (T-033): tokens semânticos no Tailwind e classes de componente em CSS

**Decisão:** `src/styles/index.css` define os tokens em `@theme` (cores semânticas como `canvas`, `surface`, `line`, `ink`, `ink-muted`, `accent`, `danger`, `warning`; raios `control`/`card`; sombra `card`; fonte do sistema) e, em `@layer components`, as classes `btn` (+ `btn-primary`/`secondary`/`outline`/`ghost`, `btn-sm`/`btn-lg`), `input`, `card`, `link` e `page-title`. Os componentes não usam mais passos crus da paleta (`slate-800`, `emerald-500`...): um codemod trocou todos, em 39 arquivos.
**Por que classes CSS e não componentes React para botão/card/input:** o mesmo estilo vale para `<button>`, `<Link>` e `<NavLink>`, e a troca foi mecânica, sem mexer em props, refs ou testes. Componentes React ficaram só onde há comportamento: `ProgressBar` e `Skeleton` em `src/shared/ui/`. Não foi adotado shadcn/ui (citado no Plan.md): o app não tem modal, menu ou combobox que justifique a dependência.
**Foco visível global:** uma regra `:focus-visible` na camada base substitui os `focus-visible:ring-*` espalhados. Alguns controles (Editar, Arquivar, Sair, navegação) não tinham indicador nenhum; agora todos têm.
**Contraste:** texto secundário que usava `slate-500` (cerca de 4:1 sobre o fundo, abaixo do AA para texto pequeno) passou para `ink-muted` (`slate-400`, cerca de 7:1). Os valores no comentário do CSS são estimativas a partir da paleta; não rodei uma ferramenta de auditoria.
**Movimento:** a preferência "Reduzir movimento" é aplicada num único lugar (`RootLayout`): um atributo `data-reduce-motion` desliga transições/animações CSS e um `MotionConfig` faz o mesmo para componentes Motion; com a preferência desligada, ambos seguem o `prefers-reduced-motion` do sistema. Animação nova só em dois pontos: o preenchimento das barras de progresso (XP, jornada) e a insígnia conquistada no resultado da batalha.
**Sprites:** `SpeciesSprite` passou a preferir o sprite em pixel art, ampliado com `image-rendering: pixelated`; antes usava a arte oficial (uma pintura) com esse mesmo filtro, o que a deixava serrilhada. A arte oficial virou reserva, sem o filtro.
**Navegação:** barra fixa no topo, com o item ativo destacado e conteúdo limitado a uma largura máxima.
**Verificação:** o E2E com API simulada agora também abre Tarefas, Foco, Equipe, Jornada e Configurações em 360 px e confere que não há rolagem lateral. Olhei capturas de Foco, Equipe e Configurações nesse tamanho; com os dados reais do usuário não foi testado.
**Limitações:** sem tema claro; sem ícones (continuam emojis); a tela de login e as cenas de batalha só receberam os tokens, não um redesenho.

## 2026-10-14 — Card de encontro passa a usar o nível real do time

**Decisão:** a tela de Foco calcula o nível médio do time ativo (`computePartyAverageLevel`) e o passa ao card de encontro, em vez do `NO_PARTY` fixo. O compromisso exibido já vem com a redução por time (1 ponto a cada 10 níveis médios).
**Motivo:** o card dizia "você ainda não tem Pokémon capturados" mesmo com o time cheio, e pedia um compromisso maior que o que o banco exigiria. O trigger do banco usa a mesma média e a mesma fórmula, então o que o card mostra é aceito.
**Ainda pendente:** o bônus de XP por time (`v_team_multiplier` em `resolve_pending_battle`) continua fixo em 1.

## 2026-10-14 — Sprites animados (GIF) no time ativo

**Decisão:** o catálogo ganhou `animated_sprite_url`, importado da PokéAPI (`sprites.versions.generation-v.black-white.animated`). É o único conjunto animado em pixel art que a API tem; apesar de ser dos jogos Black/White, cobre as 210 espécies da Pokédex do Platinum. `SpeciesSprite` aceita `animated` e é usado assim no time ativo (página Equipe e Dashboard) e no Pokémon selvagem do próximo encontro (card de encontro da tela de Foco e card Foco do Dashboard, ambos a 96 px); box, catálogo e escolha do inicial continuam com o sprite estático.
**Reduzir movimento:** um GIF não pode ser pausado por CSS, então com a preferência do app ou do sistema ligada o componente mostra o sprite estático.
**Reserva em cadeia:** se o GIF falhar ao carregar, cai para o sprite estático, depois para a arte oficial, depois para o glifo genérico.
**Tamanho fixo:** os GIFs não são quadrados e o reset do Tailwind (`img { height: auto }`) deixava cada um com uma altura, desalinhando a fileira; a imagem agora tem largura e altura explícitas com `object-contain`. No Dashboard o sprite do time passou de 48 para 96 px (o mesmo do próximo encontro), em 3 colunas no celular e em telas largas e 6 no tablet, para caber sem estourar o card.
**Custo:** cada GIF tem de 20 a 110 kB e continua vindo do CDN da PokéAPI no GitHub; só os do time ativo (até 6) são carregados.

## 2026-10-14 — Gargalos de navegação e dados (T-034): medição antes/depois no build de produção

**Como foi medido:** `npm run build && npm run perf:measure` (`scripts/measure-navigation.ts`) abre o build de produção num Chromium, com sessão falsa e a API do Supabase simulada com 150 ms de atraso por resposta. Não toca o projeto real e é repetível. "Shell" é o tempo até o título da página; "conteúdo" é quando a última resposta da API chegou; "profundidade" é quantas requisições tiveram de acontecer em sequência. O "antes" é o commit `70fa49d`, construído numa worktree à parte e medido com o mesmo script.

Carga a frio (navegador novo, direto na URL):

| Rota        | JS antes → depois (kB) | Requisições antes → depois | Conteúdo antes → depois (ms) | Profundidade antes → depois |
| ----------- | ---------------------- | -------------------------- | ---------------------------- | --------------------------- |
| `/`         | 829 → 669              | 13 → 13                    | 501 → 516                    | 2 → 2                       |
| `/tasks`    | 829 → 652              | 2 → 2                      | 296 → 284                    | 1 → 1                       |
| `/focus`    | 829 → 670              | 9 → 9                      | 484 → 443                    | 2 → 2                       |
| `/team`     | 829 → 653              | 10 → 4                     | 514 → 277                    | 3 → 1                       |
| `/journey`  | 829 → 653              | 7 → 6                      | 293 → 278                    | 1 → 1                       |
| `/settings` | 829 → 645              | 1 → 1                      | 289 → 260                    | 1 → 1                       |

Navegando dentro do app a partir do Dashboard: antes e depois, Tarefas, Foco, Jornada e Configurações não fazem nenhuma requisição (tudo já em cache), e voltar a qualquer página também não. A exceção era Equipe, que na primeira visita fazia 5 consultas de espécie (uma por Pokémon); agora faz 1 (o catálogo, para a grade da Pokédex).

**O que mudou:**

- **Consulta por Pokémon (N+1):** `getSpeciesByPokedexNumber` agrupa as buscas pedidas no mesmo instante numa única requisição `in (...)`; e o hook não faz requisição nenhuma quando o catálogo inteiro já está em cache ou a caminho (página Equipe).
- **Catálogo inteiro sem necessidade:** o cartão de escolha do inicial só busca o catálogo (210 espécies) enquanto não há inicial; antes Dashboard e Jornada o baixavam sempre. O card Equipe do Dashboard busca só as espécies do time.
- **Bundle por rota:** cada página virou um chunk carregado sob demanda (`src/app/page-loaders.ts`), e a navegação pré-carrega o código da página ao passar o mouse ou focar o link — só o código, nunca os dados.
- **Biblioteca Motion fora do bundle:** era usada para uma única animação (a insígnia) e para ler a preferência de movimento reduzido, ao custo de cerca de 130 kB. A insígnia virou uma animação CSS (`animate-pop`) e a preferência é lida por um hook próprio (`useReducedMotion`). O pacote continua no `package.json`, sem uso — remover é uma decisão do usuário.
- **Dado desatualizado corrigido:** ao confirmar uma sessão com batalha, o cache de `owned_pokemon` não era invalidado, então nível/XP do time podiam aparecer velhos por até 1 minuto.
- **Listas que só crescem:** tarefas concluídas e arquivadas passaram a vir limitadas às 200 mais recentes (por `updated_at`), com aviso quando o limite é atingido. Pendentes continuam completas.

**O que não melhorou, e por quê:**

- O Dashboard continua com 13 requisições e o mesmo tempo: ele agrega quatro domínios, todas em paralelo. A diferença está no tamanho de uma delas (5 espécies em vez de 210), que a simulação com catálogo pequeno não mostra.
- Foco e Dashboard continuam com profundidade 2: a espécie do Pokémon selvagem só é conhecida depois que o encontro chega. Depois da primeira vez fica em cache por 24h.
- Os cerca de 650 kB restantes são bibliotecas usadas em toda rota: Supabase (~250 kB), React + Router + TanStack Query (~320 kB) e Zod (~85 kB, por validar as preferências no layout raiz).

**Limites da medição:** API simulada com atraso fixo e dados pequenos; não mede o Supabase real, rede móvel nem um celular de verdade (o item "comparar em celular real/throttling" do plano não foi feito). Não usei o profiler do React: com as listas limitadas (5 no Dashboard, 200 no histórico) não vi motivo para memoização.

**Lição do próprio processo:** a primeira comparação antes/depois saiu idêntica porque o `vite preview` da execução anterior continuou vivo no Windows e serviu o build errado. O script passou a subir o preview dentro do próprio processo e fechá-lo no fim.

## 2026-10-14 — Histórico (T-035): uma visão única no banco, totais calculados da mesma fonte

**Decisão:** a página Histórico lê uma view, `history_entries`, que une tarefas concluídas, sessões de foco, batalhas vencidas, capturas, evoluções, insígnias e a escolha do inicial numa linha do tempo só (uma requisição por janela de datas). Os totais de hoje / 7 dias / 30 dias / total vêm da RPC `get_history_summary()`, que agrega **a mesma view** — os números e as entradas não têm como divergir.
**Segurança:** a view é `security_invoker`, então o RLS de cada tabela de origem continua valendo; a RPC roda como o chamador. `anon` recebe 401 em ambas.
**Sem streak:** dias sem atividade simplesmente não aparecem, não há contagem de sequência nem comparação com período anterior. "7 dias" e "30 dias" são janelas rolantes; "hoje" começa à meia-noite no fuso do perfil.
**Filtro sem requisição:** o filtro por tipo é aplicado no cliente sobre a janela já carregada (30 dias, ampliável de 30 em 30). Só "Ver mais 30 dias" busca de novo.
**Sempre atualizado em vez de invalidado:** o histórico é alimentado por meia dúzia de mutations espalhadas pelo app; em vez de ensinar cada uma a invalidá-lo, as duas consultas têm `staleTime: 0` e são refeitas ao abrir a página, mantendo os dados anteriores na tela.
**Evoluções passaram a ser registradas:** `confirm_evolution` só reescrevia a linha do Pokémon; agora também grava em `evolution_events`. Evoluções anteriores a esta migration não aparecem no histórico (não havia registro).
**Configurações:** o som ao terminar a sessão, que só existia como caixa na tela de Foco, ganhou uma caixa em Configurações, junto de timers, movimento reduzido e fuso.
**Validado contra o banco real:** `supabase/verification/t035-history-and-retention.sql` — título/dificuldade gravados na conclusão, limpeza apagando só o que deve, ledger sobrevivendo à limpeza, total geral batendo com as quatro tabelas de origem (eventos, sessões, vitórias, XP), virada do dia no fuso do perfil (duas sessões a um minuto da meia-noite local, só uma conta como hoje) e permissões do papel `authenticated`. Tudo revertido.

## 2026-10-14 — Tarefas concluídas e arquivadas são apagadas após 90 dias

**Decisão (pedido do usuário):** a função `purge_old_tasks()` apaga tarefas concluídas há mais de 90 dias e arquivadas há mais de 90 dias, agendada pelo `pg_cron` todo dia às 03:17 UTC. Tarefas pendentes nunca são apagadas, por mais antigas que sejam.
**O histórico não perde nada:** o registro de conclusão (`productivity_events`) passou a guardar título e dificuldade da tarefa no momento da conclusão, então o diário continua mostrando "Concluiu: …" depois que a tarefa some. Batalhas resolvidas e XP também ficam.
**Restrição ajustada:** `battles` exigia que todo compromisso de tarefa tivesse `task_id`; como a coluna é `ON DELETE SET NULL`, apagar uma tarefa com batalha violaria a restrição. A nova (`battles_task_link_check`) aceita `task_id` nulo quando a batalha já está resolvida. Batalhas ainda pendentes de uma tarefa apagada são removidas junto, pois não poderiam mais ser resolvidas.
**Consequência para o usuário:** uma tarefa concluída só pode ser reaberta dentro de 90 dias. As telas de Tarefas (abas Concluídas/Arquivadas) e de Histórico avisam do prazo.
**O prazo vive em dois lugares:** o valor que vale é o padrão da função SQL; `TASK_RETENTION_DAYS` no cliente é só o texto exibido. Mudar um exige mudar o outro.
**Limpeza nunca chamável pelo cliente:** a função apaga de todos os donos, então o `EXECUTE` foi revogado de `public`, `anon` e `authenticated`.

## 2026-10-14 — Resíduo de scripts de verificação antigos removido do ledger real

**O que aconteceu:** ao criar o histórico apareceram 6 registros de "tarefa concluída" sem tarefa e 3 recompensas de XP (140 XP) sem batalha. Eram sobras dos scripts de verificação do T-022, T-025 e T-026, que apagavam as tarefas e batalhas de teste mas não os registros derivados delas. Apareceriam no histórico do usuário como atividade que ele não fez.
**Ação:** apagados exatamente esses 9 registros (órfãos e anteriores a 2026-10-14). O XP não tinha ido para nenhum Pokémon do usuário: os Pokémon de teste daqueles scripts já tinham sido removidos.
**Pendência:** esses três scripts antigos continuam com a limpeza linha a linha e deixariam o mesmo resíduo se rodados de novo. Os scripts a partir do T-028 usam uma subtransação sempre revertida e não têm esse problema; os antigos deveriam ser convertidos antes de qualquer nova execução.

## 2026-10-14 — Pacote `motion` removido

**Decisão (confirmada pelo usuário):** depois do T-034 o pacote estava instalado sem uso; foi desinstalado. A animação da insígnia é CSS e a preferência de movimento reduzido usa um hook próprio.

## 2026-10-14 — Testes de domínio e integração (T-036): o que faltava era o lado do banco

**Ponto de partida:** os módulos de regra pura já tinham 98% de linhas e 93% de ramos cobertos. As lacunas reais eram três: (1) os scripts de verificação antigos deixavam resíduo e não havia como rodar todos; (2) nada garantia que as fórmulas em SQL continuavam iguais às do TypeScript; (3) os caminhos tortos (reabrir, abandonar, trocar o time, repetir) não tinham teste no banco.

**`npm run db:verify`:** roda os 12 scripts de `supabase/verification/` mais uma verificação gerada de paridade e imprime PASS/FAIL por script, saindo com erro se algum falhar. Não está no CI porque precisa do CLI do Supabase logado e ligado ao projeto real.

**Todos os scripts agora revertem tudo:** os seis anteriores ao T-028 limpavam linha a linha (e três deles deixavam eventos e recompensas órfãos); foram convertidos para o padrão "subtransação sempre revertida". Cada um começa de um estado conhecido (time vazio, sem recompensas do dia, sem sessão ativa) dentro da própria transação, então o resultado não depende do que a conta real tem. O do T-025 também foi atualizado: testava captura em batalha selvagem sem etapa de campanha, comportamento que o T-030 removeu de propósito.

**Paridade TypeScript ↔ SQL por um fixture único:** `tests/fixtures/rule-parity.json` lista saídas esperadas das regras — compromisso mínimo para 40 combinações de dificuldade × time, curva de XP em 8 níveis, XP de tarefa (cheio e reduzido) e de foco. `src/features/battles/rule-parity.test.ts` confere o motor TypeScript contra ele (roda no CI); `db:verify` gera SQL a partir do mesmo arquivo e confere os triggers e funções reais. Mudar uma regra de um lado só quebra um dos dois antes de gravar recompensa errada. O fixture é escrito à mão: é uma terceira cópia da regra, mas é a que permite comparar as outras duas.
**Provado que detecta:** alterei um valor do fixture de propósito (sessão de 10 min → 99 XP); o teste unitário e o `db:verify` falharam, este com "a 10-minute session paid 15 XP, fixture says 99". Valor restaurado em seguida.

**Caminhos tortos (`t036-robustness.sql`):** concluir → reabrir → concluir de novo paga a batalha uma vez só e não soma vitória; uma tarefa não aceita segunda batalha; a mesma conclusão repetida (retry) não cria evento nem recompensa; sessão cancelada deixa a batalha pendente, sem XP e sem trocar o encontro; sessão mais curta que o compromisso é retirada; o XP vai para quem está no time **na resolução**, não na aceitação.

**RNG determinístico:** o script de encontros fixa a semente (`setseed`) antes dos sorteios, então passa ou falha igual em toda execução.

**Cobertura como regra:** `npm run test:coverage` mede só os módulos de regra (domínios, motor, XP, agendamento, validação de conteúdo, esquemas) e exige 95% de linhas/declarações/funções e 90% de ramos. O CI passou a rodar esse comando no lugar de `npm run test`. Componentes de UI ficam de fora de propósito: são testados por comportamento.

**O que continua sem teste automatizado em ambiente isolado:** não existe banco de teste separado; os testes de banco rodam contra o projeto real (revertendo). RLS com um **segundo usuário** ainda não foi testado — fica para o T-038.

## 2026-10-14 — E2E dos fluxos essenciais (T-037): navegador real, backend simulado com estado

**Decisão:** os seis fluxos do plano rodam em `tests/e2e/essential-flows.spec.ts` contra `tests/support/fake-backend.ts`, um substituto da API do Supabase que **guarda estado** durante o teste: o que o app grava é lido de volta. Ele fala PostgREST o bastante para este app (filtros `eq`/`in`/`gte`, ordenação, limite, insert, update condicional, resposta de objeto único, RPCs) e reimplementa em poucas linhas as regras de servidor de que os fluxos dependem (uma sessão ativa, resolução da batalha na conclusão, XP para o time, uma captura por batalha).
**Por que não contra o banco real:** não há ambiente de teste separado, e um E2E autenticado real gravaria tarefas, batalhas e XP de teste no histórico do usuário. Com o fake, os testes rodam no CI e nunca tocam o projeto.
**O que isso prova e o que não prova:** prova que o **frontend** conduz corretamente um backend bem-comportado — persistência após recarregar, cronômetro, repetição após falha, navegação. Não prova que os triggers, RPCs e o RLS reais se comportam assim; isso é o `npm run db:verify`. Um E2E autenticado contra um Supabase de verdade continua pendente de um projeto de staging.
**Fluxos cobertos:** login → criar tarefa → concluir → recarregar e continuar concluída; sessão de foco → confirmar → batalha → recompensa única → captura; recarregar no meio da sessão sem zerar o cronômetro; resposta perdida na confirmação seguida de nova tentativa, sem XP em dobro; navegação entre páginas sem recarregar o documento e com dados coerentes; o mesmo caminho em 360 px com toque.
**Tempo:** os testes de foco usam o relógio falso do Playwright (`page.clock`) para avançar o minuto da sessão.

## 2026-10-14 — Bug real encontrado pelo E2E: o resultado da batalha não aparecia após confirmar a sessão

**Sintoma:** num navegador de verdade, clicar em "Confirmar conclusão" voltava direto para o card do próximo encontro. A sessão era concluída e a batalha resolvida e paga no servidor, mas a tela de vitória (XP, captura, insígnia, cena final) nunca era mostrada — e sem ela não havia como capturar o Pokémon daquela batalha.
**Causa:** a página de Foco era avisada por um callback passado a `mutate()`. O `onSuccess` do hook roda antes e atualiza o cache da sessão ativa para "nenhuma", o que desmonta o painel do cronômetro; o TanStack Query descarta callbacks de `mutate()` de um componente já desmontado.
**Correção:** o aviso passou a ser um callback do próprio hook (`useConfirmFocusSession(onConfirmed)`), executado antes de o cache ser atualizado. Callbacks de hook sempre rodam.
**Por que os testes unitários não pegaram:** em jsdom com repositórios simulados a ordem dos eventos é outra e o teste passava. Só o navegador real mostrou.
**Não investigado:** desde quando o defeito existe. O usuário viu essa tela funcionando na época do T-026, então começou depois; não fiz a bisseção.
