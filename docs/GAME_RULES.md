# Regras do jogo — motor de desafios e recompensas (T-003 / T-021)

Especificação formal da matemática do RPG, escrita antes/junto da implementação em `src/features/battles/engine.ts`. Os dois devem ficar sincronizados — qualquer mudança de fórmula aqui precisa refletir no código (e vice-versa).

## Princípio central (não renegociável)

**A produtividade nunca depende de vencer uma batalha.** Concluir uma tarefa ou confirmar uma sessão de foco já gera seu registro em `productivity_events` (T-013/T-019) **independentemente** de qualquer resultado de batalha. O motor descrito aqui calcula um **XP de bônus narrativo** por cima disso — nunca o substitui, nunca pode fazer uma tarefa/sessão já concluída "deixar de valer".

## Tipos

```ts
type EncounterKind = 'wild' | 'trainer' | 'rival' | 'gymLeader' | 'milestone'

type Encounter = {
  kind: EncounterKind
  difficulty: number // 1–5, independente de qualquer tarefa/sessão específica
}

type PartySnapshot = {
  averageLevel: number // 0 se não houver time ainda (T-024/T-025 não existem no momento do T-021)
}

type Commitment =
  { type: 'task'; minDifficulty: number } | { type: 'focusSession'; minDurationMinutes: number }

type CommitmentFulfillment =
  | { type: 'task'; difficulty: number }
  | { type: 'focusSession'; durationMinutes: number; wasConfirmed: boolean }

type BattleOutcome = {
  result: 'victory' | 'withdrawal'
  xpAwarded: number
  teamMultiplierApplied: number
}
```

## Estados de sessão/batalha

A batalha em si não tem estados próprios de persistência no T-021 (é só uma função pura). Os estados relevantes já existem em outras partes do sistema:

- **Tarefa** (`tasks.status`): `pending` → `completed` (ou `archived`). Ver T-011.
- **Sessão de foco** (`focus_sessions.status`): `running` → `paused`/`completed`/`cancelled`, mais a fase derivada `awaiting_confirmation`. Ver T-016.
- **Resultado de batalha**: calculado a partir de uma `CommitmentFulfillment` já consolidada (tarefa concluída ou sessão confirmada) — nunca de um estado "em andamento". Uma sessão cancelada ou uma tarefa nunca concluída simplesmente **não produz** uma `CommitmentFulfillment`; não existe "derrota" persistida, só a ausência de vitória (`withdrawal`, sem penalidade).

## Condição de vitória (RF-022)

**Compromisso cumprido = vitória garantida, sempre.** Antes de começar a atividade, o jogo mostra o `Commitment` necessário (gerado por `getViableCommitments`). Se a `CommitmentFulfillment` final satisfizer esse `Commitment` exato, o resultado é **sempre** `victory` — nenhum sorteio, nenhuma chance de perder por acaso. Se a atividade for cancelada, abandonada, ou a fulfillment não bater com o commitment prometido, o resultado é `withdrawal`: XP de bônus = 0, mas **nenhuma penalidade permanente** (a tarefa/sessão em si, se tiver sido concluída de verdade, já gerou seu evento de produtividade de qualquer forma).

```
isCommitmentSatisfied(commitment, fulfillment):
  task        → fulfillment.difficulty >= commitment.minDifficulty
  focusSession→ fulfillment.wasConfirmed AND fulfillment.durationMinutes >= commitment.minDurationMinutes
  (tipos diferentes nunca satisfazem)
```

## Fórmula de XP de bônus (parametrizada)

```
TASK_XP_PER_DIFFICULTY   = 20   // XP bônus por ponto de dificuldade (1–5) de uma tarefa
FOCUS_XP_PER_MINUTE       = 1.5  // XP bônus por minuto planejado de foco

baseXp(fulfillment):
  task         → fulfillment.difficulty * TASK_XP_PER_DIFFICULTY
  focusSession → fulfillment.durationMinutes * FOCUS_XP_PER_MINUTE
```

### Tarefa significativa supera Pomodoro simples

Com essas constantes: tarefa dificuldade 2 (padrão) = 40 XP > Pomodoro de 25 min = 37,5 XP. Tarefa dificuldade 3 = 60 XP, bem acima de qualquer preset comum (25–60 min = 37,5–90 XP, mas presets típicos ficam entre 25–45 min = 37,5–67,5 XP). Dificuldade 1 (tarefa trivial) fica abaixo de propósito — "significativa" se refere a tarefas com dificuldade real, não a qualquer tarefa.

## Influência do time (RF-027) — nunca gera derrota surpresa

```
TEAM_BONUS_PER_LEVEL = 0.01  // +1% de XP por nível médio do time
MAX_TEAM_BONUS        = 0.5   // teto de +50%

teamMultiplier(party) = 1 + min(MAX_TEAM_BONUS, max(0, party.averageLevel) * TEAM_BONUS_PER_LEVEL)
```

O multiplicador nunca é menor que 1 — um time fraco ou inexistente (`averageLevel = 0`) não penaliza, só deixa de bonificar.

### Redução do esforço mínimo exigido

```
TEAM_REDUCTION_PER_LEVELS = 10  // 1 ponto de dificuldade reduzido a cada 10 de nível médio

effectiveDifficulty(encounter, party):
  maxReduction = encounter.difficulty - 1          // nunca reduz abaixo de 1
  reduction    = min(maxReduction, floor(max(0, party.averageLevel) / TEAM_REDUCTION_PER_LEVELS))
  return encounter.difficulty - reduction
```

Um time forte **reduz** o que é exigido (nunca aumenta); a dificuldade mínima nunca cai abaixo de 1 (sempre existe uma forma viável de vencer).

## Compromissos viáveis (RF-020, RF-026)

```
BASE_FOCUS_MINUTES_PER_DIFFICULTY = 1  // minutos de foco por ponto de dificuldade efetiva
                                        // (era 15 — reduzido em 2026-10-13, ver docs/DECISIONS.md)

getViableCommitments(encounter, party):
  d = effectiveDifficulty(encounter, party)
  return [
    { type: 'task',         minDifficulty: d },
    { type: 'focusSession', minDurationMinutes: d * BASE_FOCUS_MINUTES_PER_DIFFICULTY },
  ]
```

Com `difficulty` no máximo 5 e redução máxima por time, o maior `minDurationMinutes` possível é `5 * 1 = 5` minutos — bem abaixo do teto de 120 min de `focus_sessions.planned_duration_seconds`, então nunca "exige Pomodoros de 2 horas" (princípio 5.1.5). Isso é só o **mínimo pra qualificar** o encontro mais fácil: uma sessão normal de 25–60 min continua rendendo o XP correspondente aos minutos reais (não ao mínimo).

## Exemplos verificáveis

| Cenário                | Encontro          | Time           | Compromisso viável (tarefa)     | Fulfillment                         | Resultado  | XP  |
| ---------------------- | ----------------- | -------------- | ------------------------------- | ----------------------------------- | ---------- | --- |
| Iniciante              | wild, dif. 1      | nível médio 0  | dificuldade ≥ 1                 | tarefa dif. 1                       | victory    | 20  |
| Time forte vs. ginásio | gymLeader, dif. 5 | nível médio 50 | dificuldade ≥ 1 (reduzido de 5) | tarefa dif. 1                       | victory    | 20  |
| Tarefa difícil         | trainer, dif. 3   | nível médio 0  | dificuldade ≥ 3                 | tarefa dif. 5                       | victory    | 100 |
| Sessão curta demais    | trainer, dif. 3   | nível médio 0  | foco ≥ 3 min                    | sessão de 2 min confirmada          | withdrawal | 0   |
| Foco abortado          | wild, dif. 1      | nível médio 0  | foco ≥ 1 min                    | sessão de 20 min **não confirmada** | withdrawal | 0   |

Esses exemplos são portados 1:1 para `engine.test.ts`.

## Prevenção de exploração

- O XP de bônus depende da `CommitmentFulfillment`, que só existe depois que a tarefa/sessão real já foi concluída pelo pipeline existente (T-011/T-019) — não há como chamar o motor sem uma conclusão real por trás.
- `resolveBattle` é uma função pura, sem efeito colateral: não decide por si só se uma tarefa foi concluída ou se uma sessão foi confirmada, apenas recebe o fato consumado. A prevenção de XP duplicado é responsabilidade do ledger `productivity_events`/`reward_events` (idempotente desde o T-013; amarrado a "um resultado de batalha" desde o T-022).
- Reabrir uma tarefa e concluí-la de novo gera um novo evento de produtividade (decisão já registrada em `docs/DECISIONS.md`) e, consequentemente, pode gerar um novo resultado de batalha — isso é aceitável porque é um novo "ato" real, não uma repetição da mesma requisição.

### Anti-fracionamento de tarefas (T-027)

```
TASK_XP_FULL_REWARD_COUNT_PER_DAY = 5    // primeiras 5 tarefas recompensadas no dia, XP cheio
TASK_XP_DIMINISHED_MULTIPLIER     = 0.5  // a partir da 6ª, metade do XP

applyDailyTaskDiminishingReturns(baseXp, tarefasRecompensadasHoje):
  return tarefasRecompensadasHoje >= TASK_XP_FULL_REWARD_COUNT_PER_DAY
    ? baseXp * TASK_XP_DIMINISHED_MULTIPLIER
    : baseXp
```

**Só tarefas, nunca sessões de foco.** O XP de uma sessão de foco já é linear nos minutos reais (`duração * FOCUS_XP_PER_MINUTE`) — fracionar uma sessão de 30 min em três de 10 min rende exatamente o mesmo total, não há nada a explorar. Tarefas pagam um valor fixo por conclusão independente do esforço real, então são o único lugar onde espalhar trabalho em tarefas artificiais/triviais paga mais do que devia, sem esse mecanismo.

**Contagem:** quantos eventos de recompensa com `source_type='battle'` e `commitment_type='task'` já foram creditados hoje (granularidade de dia UTC, não o fuso do perfil — simplificação aceita pra esse controle anti-abuso específico, diferente da exigência mais estrita do RNF-013 pra agrupamentos visíveis ao usuário). Calculada só no trigger SQL (`resolve_pending_battle`), já que depende de estado; a função pura do TS (`applyDailyTaskDiminishingReturns`) recebe essa contagem como parâmetro, não a calcula.

**Exemplo:** 5 tarefas dificuldade 1 em um dia = 5×20 = 100 XP, igual a uma única tarefa dificuldade 5 (5×20=100) — nenhuma penalidade por fazer tarefas pequenas legítimas. Uma 6ª tarefa no mesmo dia rende só 10 XP (metade), não 20 — tentar fracionar além disso rende cada vez menos por unidade.

## Simulação de uso realista (T-027)

`src/features/battles/balance-simulation.test.ts` simula um perfil moderado (2 tarefas dificuldade 2 + uma sessão de foco de 30 min por dia, sem fracionamento, XP todo pra um único Pokémon — dividir entre até 6 deixaria o nível individual proporcionalmente mais lento, uma consequência aceita e documentada em `docs/DECISIONS.md`):

| Horizonte | XP total aproximado | Nível alcançado |
| --------- | ------------------- | --------------- |
| 7 dias    | ~875                | ~9              |
| 30 dias   | ~3.750              | ~15             |
| 90 dias   | ~11.250             | ~22             |

Nenhum desses fica parado no nível inicial, e 90 dias de uso real não chega nem perto do teto (100) — nem precisa, porque o jogo não tem "fim" definido ainda (Fase 5+). Um dia sem nenhuma atividade soma 0 XP, nunca negativo — sem penalidade por ausência (CA do T-027).

## Campanha (T-028)

A campanha é uma lista ordenada de **nós** (cidade/história, rota, rival, ginásio). Cada nó define um encontro (tipo + dificuldade), quantas vitórias são necessárias para concluí-lo, se pode ser repetido depois de concluído e de quais nós depende. O motor de batalha não conhece a campanha: o nó apenas indica contra qual encontro a batalha acontece.

- **Desbloqueio:** um nó fica disponível quando todos os seus pré-requisitos estão concluídos.
- **Próximo encontro:** o primeiro nó disponível na ordem da história; quando não há mais nenhum, a última rota repetível.
- **Progresso:** só uma vitória conta. Retirada não soma nem subtrai nada, e nenhum progresso regride por inatividade.
- **Repetição:** apenas rotas são repetíveis. Rival, ginásio e marcos de história não aceitam nova batalha depois de concluídos.
- **Compromisso mínimo:** o compromisso declarado não pode ser menor que a dificuldade efetiva do nó (mesma redução por time descrita acima).

- **Encontro selvagem:** cada rota tem uma tabela de espécies com faixa de nível e peso. A chance de uma espécie é o peso dela dividido pela soma dos pesos da tabela; o nível é sorteado uniformemente na faixa. O encontro é sorteado uma vez, guardado, e só é trocado depois de uma vitória. Lendários nunca entram em tabela.
- **Captura:** o Pokémon capturado chega no nível em que foi encontrado.

Tudo isso é aplicado no banco (`enforce_campaign_node_on_battle` e `record_campaign_progress_on_battle_resolved`). As tabelas ficam em `src/features/journey/content/sinnoh-wild.ts`. O conteúdo atual está em `src/features/journey/content/sinnoh.ts`.

## O que fica fora do T-021

- Não existe ainda `battles`/`battle_commitments` persistidos (essa é uma decisão explícita do T-016: Pomodoro funciona sem a camada de RPG). O motor é só funções puras em memória por enquanto.
- Não existe catálogo de Pokémon/tipos/vantagem elemental (T-024) — `PartySnapshot` é deliberadamente simplificado a `averageLevel`, sem tipos nem matchups.
- `TASK_XP_PER_DIFFICULTY`, `FOCUS_XP_PER_MINUTE`, etc. são constantes TypeScript, não uma tabela `game_settings` versionada no banco — ver `docs/DECISIONS.md`. `REWARD_RULES_VERSION` (hoje `1`) é um marcador de "essas constantes mudaram" pra humanos, não uma trava de código — eventos de recompensa já gravam seu `amount` final, então uma mudança de constante nunca corrompe recompensas passadas (T-027).
- `TasksPage` ainda não oferece nenhum jeito de vincular um encontro a uma tarefa (decisão do T-023) — então, na prática hoje, o caminho de recompensa de tarefa só é alcançável via dados de teste direto no banco, não pela UI real. O anti-fracionamento e as simulações deste documento já cobrem esse caminho preventivamente, pra quando essa integração existir.

## Evolução sem nível (catálogo)

O jogo só evolui por nível. Para espécies que nos jogos originais evoluem por pedra, troca, amizade, item ou local, o catálogo usa um nível substituto: **25** se a espécie é a base da linha evolutiva, **40** nos demais casos, e nunca menos de 10 níveis depois da evolução que a originou. Linhas ramificadas têm um único destino (a primeira evolução listada pela PokéAPI que esteja na Pokédex do Platinum). Os valores são gerados por `scripts/import-species-catalog.ts`.
