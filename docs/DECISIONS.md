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
