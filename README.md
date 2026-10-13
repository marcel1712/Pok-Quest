# PokéQuest

Aplicativo web pessoal de produtividade gamificado com jornada Pokémon. Veja `Plan.md` para a especificação completa de requisitos, arquitetura e backlog.

## Stack

React + Vite + TypeScript (strict), Tailwind CSS, React Router, TanStack Query, Zustand, Zod, Motion, Supabase (Auth + PostgreSQL + RLS).

## Requisitos

- Node.js `^22.13.0` ou `>=24` (ver `EBADENGINE` warnings se usar outra versão)

## Setup

```bash
npm install
cp .env.example .env   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## Scripts

| Script                 | Descrição                                                         |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | servidor de desenvolvimento                                       |
| `npm run build`        | typecheck + build de produção                                     |
| `npm run lint`         | ESLint                                                            |
| `npm run format`       | Prettier (escreve)                                                |
| `npm run format:check` | Prettier (somente verifica)                                       |
| `npm run typecheck`    | TypeScript sem emitir arquivos                                    |
| `npm run test`         | Vitest (execução única)                                           |
| `npm run test:watch`   | Vitest (modo watch)                                               |
| `npm run test:e2e`     | Playwright (sobe o dev server automaticamente)                    |
| `npm run preview`      | servir o build de produção localmente                             |
| `npm run db:push`      | aplica migrations locais no projeto Supabase linkado              |
| `npm run db:types`     | regenera `src/shared/types/database.ts` a partir do schema remoto |

## Banco de dados (Supabase)

Projeto único (dev = prod, app pessoal de um usuário). CLI já linkado via `supabase link --project-ref <ref>`.

```bash
npx supabase migration new <nome>   # cria uma nova migration
npm run db:push                     # aplica migrations pendentes no remoto
npm run db:types                    # atualiza os tipos TS do schema
```

Migrations ficam em `supabase/migrations/`, versionadas no Git. Nenhuma credencial fica no repositório — apenas em `.env` (ignorado).

## Estrutura

```text
src/
├── app/        # providers, router, layout raiz
├── pages/      # composição das rotas
├── features/   # domínios (auth, tasks, focus, battles, pokemon, journey, rewards, settings)
└── shared/     # ui, lib, hooks, types reutilizáveis
```

Regra de dependência: `pages → features → shared`.

## Testes e CI

Ver `docs/QA.md` para convenções completas. Resumo: GitHub Actions (`.github/workflows/ci.yml`) roda lint, typecheck, Vitest, build e um smoke E2E não-autenticado em todo push/PR, sem usar credenciais reais. E2E autenticado roda apenas local (`npm run test:e2e`) com o `.env` real, por enquanto.
