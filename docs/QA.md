# QA — convenções de teste

## Ferramentas

- **Vitest + React Testing Library** — testes unitários/de componente, co-localizados com o código (`*.test.ts(x)` ao lado do arquivo testado).
- **Playwright** — E2E, em `tests/e2e/*.spec.ts`. Config em `playwright.config.ts` (raiz).
- **`tests/fixtures/`** — dados/fixtures compartilhados entre specs E2E (vazio por enquanto; populado quando o primeiro teste autenticado existir).

## Nomenclatura

- Unitário/componente: `<arquivo>.test.ts` ou `.test.tsx`, mesma pasta do que testa.
- E2E: `<fluxo>.spec.ts` em `tests/e2e/`.
- `describe` nomeia o módulo/fluxo; `it`/`test` descreve o comportamento em linguagem natural ("rejects an obviously wrong login with a visible error"), não a implementação.

## O que mockar (e o que não mockar)

- **Mockar apenas integrações externas** (rede, SDKs de terceiros) quando necessário para isolar um teste unitário.
- **Nunca mockar regras puras de domínio/RPG** (motor de batalha, cálculo de XP, idempotência) — essas regras devem ser testadas com entradas/saídas reais, sem dublê, para que um bug nelas quebre o teste de verdade (ver `T-003`/`T-036` do `Plan.md`).
- RNG permitido em encontros/capturas: usar fixtures/seeds determinísticas, nunca `Math.random()` sem seed nos testes.

## Estratégia de E2E e CI (decisão registrada em `docs/DECISIONS.md`)

Este projeto tem um único ambiente Supabase (dev = produção) — não há banco de teste isolado. Por isso:

- **CI (GitHub Actions, roda em todo push/PR):** lint, typecheck, testes unitários (Vitest) e build — nenhum deles toca o Supabase real. Mais um job de **E2E smoke não-autenticado** (`tests/e2e/smoke.spec.ts`), que roda contra variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` **fictícias** (`ci-placeholder...`) — suficientes para o app inicializar o cliente Supabase sem nunca tentar uma sessão válida. Esse smoke só verifica o redirecionamento para `/login` e o comportamento de erro de credencial inválida.
- **E2E com API simulada (roda no CI):** specs que precisam de uma tela autenticada sem tocar o banco usam uma sessão falsa no `localStorage` e interceptam todo request ao host do Supabase com `page.route` (ver `tests/e2e/dashboard-layout.spec.ts`). Servem para layout e fluxo de tela; não provam nada sobre RLS, triggers ou dados reais.
- **E2E dos fluxos essenciais (roda no CI):** `tests/e2e/essential-flows.spec.ts` usa `tests/support/fake-backend.ts`, um substituto da API **com estado** (o que o app grava é lido de volta), para exercitar login, tarefas, sessão de foco, batalha, captura, recarga no meio da sessão e nova tentativa após resposta perdida. Ao mudar como o app fala com o Supabase (nova tabela, filtro ou RPC num desses fluxos), atualize o fake. Ele cobre o frontend; as regras reais do servidor são do `npm run db:verify`.
- **E2E autenticado (fluxos reais de login, tarefas, etc., alvo do T-037):** não roda no CI por ora, porque exigiria colocar credenciais reais como GitHub Secret e executar contra o banco de produção a cada push. Por enquanto, roda **manualmente**, local, com o `.env` real:
  ```bash
  npm run test:e2e
  ```
- Se/quando um projeto Supabase de staging existir, o job autenticado pode ser promovido para o CI usando esse projeto e Secrets dedicados — não o projeto de produção.

## Testes de banco (`npm run db:verify`)

Regras que só existem no Postgres (triggers, RPCs, RLS, grants) são verificadas por scripts em `supabase/verification/*.sql`, rodados contra o projeto real pelo CLI do Supabase.

- **Todo script roda dentro de uma subtransação que é sempre revertida** (um `raise exception 'TXXX_ROLLBACK'` no fim, capturado no bloco externo). Nada do que ele cria sobrevive, passando ou falhando. Não escreva script que "limpa no final": limpeza esquecida vira dado falso no histórico do usuário.
- Cada script começa colocando a conta num estado conhecido **dentro da transação** (time vazio, sem recompensas do dia, sem sessão ativa), para não depender dos dados reais.
- Para testar grants e RLS como o cliente, use `set local role authenticated` com `request.jwt.claims` definido; como `postgres` tudo passa.
- `npm run db:verify` roda todos e mais a **paridade de regras**: os números de `tests/fixtures/rule-parity.json` têm de ser exatamente o que o banco produz. O mesmo arquivo é conferido contra o motor TypeScript em `rule-parity.test.ts`. Ao mudar uma fórmula, mude `engine.ts`, a função SQL e o fixture juntos.
- Não roda no CI (precisa do CLI logado). Rode antes de commitar qualquer migration que toque regra de recompensa, campanha ou permissão.

## Cobertura

`npm run test:coverage` mede apenas os módulos de regra pura e falha abaixo de 95% (linhas, declarações, funções) ou 90% (ramos). É o que o CI executa. Não há meta de cobertura para componentes de UI.

## Rodando os testes

```bash
npm run test        # unitário/componente (Vitest, execução única)
npm run test:watch  # unitário/componente (watch)
npm run test:coverage # unitário + cobertura dos módulos de regra (o que o CI roda)
npm run db:verify   # scripts de banco + paridade de regras, contra o projeto real (reverte tudo)
npm run test:e2e    # Playwright (sobe o dev server automaticamente na porta 4173)
```
