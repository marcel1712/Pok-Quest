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
BASE_FOCUS_MINUTES_PER_DIFFICULTY = 15  // minutos de foco por ponto de dificuldade efetiva

getViableCommitments(encounter, party):
  d = effectiveDifficulty(encounter, party)
  return [
    { type: 'task',         minDifficulty: d },
    { type: 'focusSession', minDurationMinutes: d * BASE_FOCUS_MINUTES_PER_DIFFICULTY },
  ]
```

Com `difficulty` no máximo 5 e redução máxima por time, o maior `minDurationMinutes` possível é `5 * 15 = 75` minutos — bem abaixo do teto de 120 min de `focus_sessions.planned_duration_seconds`, então nunca "exige Pomodoros de 2 horas" (princípio 5.1.5).

## Exemplos verificáveis

| Cenário                | Encontro          | Time           | Compromisso viável (tarefa)     | Fulfillment                         | Resultado  | XP  |
| ---------------------- | ----------------- | -------------- | ------------------------------- | ----------------------------------- | ---------- | --- |
| Iniciante              | wild, dif. 1      | nível médio 0  | dificuldade ≥ 1                 | tarefa dif. 1                       | victory    | 20  |
| Time forte vs. ginásio | gymLeader, dif. 5 | nível médio 50 | dificuldade ≥ 1 (reduzido de 5) | tarefa dif. 1                       | victory    | 20  |
| Tarefa difícil         | trainer, dif. 3   | nível médio 0  | dificuldade ≥ 3                 | tarefa dif. 5                       | victory    | 100 |
| Sessão curta demais    | trainer, dif. 3   | nível médio 0  | foco ≥ 45 min                   | sessão de 25 min confirmada         | withdrawal | 0   |
| Foco abortado          | wild, dif. 1      | nível médio 0  | foco ≥ 15 min                   | sessão de 20 min **não confirmada** | withdrawal | 0   |

Esses exemplos são portados 1:1 para `engine.test.ts`.

## Prevenção de exploração

- O XP de bônus depende da `CommitmentFulfillment`, que só existe depois que a tarefa/sessão real já foi concluída pelo pipeline existente (T-011/T-019) — não há como chamar o motor sem uma conclusão real por trás.
- `resolveBattle` é uma função pura, sem efeito colateral: não decide por si só se uma tarefa foi concluída ou se uma sessão foi confirmada, apenas recebe o fato consumado. A prevenção de XP duplicado continua sendo responsabilidade do ledger `productivity_events` (idempotente desde o T-013); o T-022 vai decidir como amarrar "um resultado de batalha" a "um evento de produtividade" sem permitir recálculo do mesmo evento mais de uma vez.
- Reabrir uma tarefa e concluí-la de novo gera um novo evento de produtividade (decisão já registrada em `docs/DECISIONS.md`) e, consequentemente, pode gerar um novo resultado de batalha — isso é aceitável porque é um novo "ato" real, não uma repetição da mesma requisição.

## O que fica fora do T-021

- Não existe ainda `battles`/`battle_commitments` persistidos (essa é uma decisão explícita do T-016: Pomodoro funciona sem a camada de RPG). O motor é só funções puras em memória por enquanto.
- Não existe catálogo de Pokémon/tipos/vantagem elemental (T-024) — `PartySnapshot` é deliberadamente simplificado a `averageLevel`, sem tipos nem matchups.
- `TASK_XP_PER_DIFFICULTY`, `FOCUS_XP_PER_MINUTE`, etc. são constantes TypeScript, não uma tabela `game_settings` versionada no banco — ver `docs/DECISIONS.md`.
