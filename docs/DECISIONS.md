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
