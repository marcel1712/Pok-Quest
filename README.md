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

| Script | Descrição |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (escreve) |
| `npm run format:check` | Prettier (somente verifica) |
| `npm run typecheck` | TypeScript sem emitir arquivos |
| `npm run test` | Vitest (execução única) |
| `npm run test:watch` | Vitest (modo watch) |
| `npm run preview` | servir o build de produção localmente |

## Estrutura

```text
src/
├── app/        # providers, router, layout raiz
├── pages/      # composição das rotas
├── features/   # domínios (auth, tasks, focus, battles, pokemon, journey, rewards, settings)
└── shared/     # ui, lib, hooks, types reutilizáveis
```

Regra de dependência: `pages → features → shared`.
