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
- **E2E autenticado (fluxos reais de login, tarefas, etc., alvo do T-037):** não roda no CI por ora, porque exigiria colocar credenciais reais como GitHub Secret e executar contra o banco de produção a cada push. Por enquanto, roda **manualmente**, local, com o `.env` real:
  ```bash
  npm run test:e2e
  ```
- Se/quando um projeto Supabase de staging existir, o job autenticado pode ser promovido para o CI usando esse projeto e Secrets dedicados — não o projeto de produção.

## Rodando os testes

```bash
npm run test        # unitário/componente (Vitest, execução única)
npm run test:watch  # unitário/componente (watch)
npm run test:e2e    # Playwright (sobe o dev server automaticamente na porta 4173)
```
