# Deploy

O frontend é um site estático (Vite) hospedado na Vercel; o backend é o projeto Supabase já existente. Há **um único ambiente**: o banco que o site publicado usa é o mesmo do desenvolvimento local.

O que está pronto no repositório e o que só você pode fazer estão separados abaixo. Nada aqui foi executado contra a Vercel: a configuração foi testada localmente, servindo o build de produção com os mesmos cabeçalhos.

## O que o repositório já traz

- **`vercel.json`**
  - `rewrites`: toda rota cai no `index.html`, então abrir ou recarregar `/tasks`, `/focus` etc. direto funciona (a Vercel serve arquivos existentes antes de aplicar o rewrite).
  - Cabeçalhos de segurança em todas as respostas: Content-Security-Policy, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`.
  - Cache: `/assets/*` (nomes com hash) por um ano, imutável; `index.html` sempre revalidado, para um deploy novo aparecer na hora.
- **Content-Security-Policy**: só scripts e estilos do próprio site; imagens do próprio site e de `raw.githubusercontent.com` (sprites); conexões só com o próprio site e `*.supabase.co`; sem `iframe`, sem `object`. Se um dia os sprites mudarem de host, ou entrar outro serviço externo, a política precisa acompanhar.
- **`npm run preview`** serve o build com esses mesmos cabeçalhos (o `vite.config.ts` lê o `vercel.json`).
- **E2E no build de produção**: o projeto `production-build` do Playwright roda os fluxos essenciais contra esse preview e falha se houver qualquer violação de CSP. Roda em `npm run test:e2e` e no CI.
- **`npm run smoke -- <url>`**: smoke test pós-deploy (abaixo).

## Primeiro deploy (uma vez)

1. **Suba o código**: `git push`. O CI precisa passar.
2. **Na Vercel**: _Add New → Project_ → importe o repositório do GitHub. O `vercel.json` já define framework, comando de build e pasta de saída; não mude.
3. **Node.js**: em _Settings → General → Node.js Version_, escolha **22.x** ou mais novo.
4. **Variáveis de ambiente** (_Settings → Environment Variables_, ambiente Production):
   - `VITE_SUPABASE_URL` — a mesma do seu `.env`
   - `VITE_SUPABASE_ANON_KEY` — a mesma do seu `.env`

   São as únicas. A chave `anon` é pública por desenho (ver `docs/SECURITY.md`). **Nunca** cadastre uma chave `service_role` aqui: toda variável `VITE_` vai para o navegador.

5. **Deploy** e anote a URL (`https://<projeto>.vercel.app` ou o seu domínio).
6. **No Supabase** (_Authentication → URL Configuration_): defina **Site URL** como a URL publicada. O login por email e senha funciona sem isso, mas o link do email de **recuperação de senha** usa esse endereço; se ficar no valor antigo, o link aponta para o lugar errado.
7. **Smoke test** (próxima seção).

Não há nada a configurar de CORS: a API do Supabase aceita a chave `anon` de qualquer origem, e quem protege os dados são os grants e o RLS.

### Previews de pull request

A Vercel publica um preview para cada branch/PR. As variáveis acima estão só em Production, então um preview abre mas não consegue falar com o Supabase. Isso é intencional: com ambiente único, um preview conectado gravaria no banco real. Se criar um projeto Supabase de staging, cadastre as variáveis dele no ambiente Preview.

## Smoke test pós-deploy

```bash
npm run smoke -- https://<sua-url>
```

Sem conta, e sem gravar nada, ele confere: rota profunda servida pelo app; cabeçalhos de segurança presentes; arquivos com hash em cache imutável; nenhum source map publicado; HTTPS; formulário de login renderizado em desktop e em 360 px; nenhuma violação de CSP nem erro no console; e que o app alcança o Supabase real (uma senha errada é recusada por ele).

Para incluir as telas autenticadas, passe a sua conta por variáveis de ambiente:

```bash
SMOKE_EMAIL=voce@exemplo.com SMOKE_PASSWORD='sua-senha' npm run smoke -- https://<sua-url>
```

Aí ele entra, abre Dashboard, Tarefas, Foco, Equipe, Jornada, Histórico e Configurações conferindo que cada uma lê do banco sem erro, recarrega numa rota profunda para ver se a sessão persiste, e sai. **Só lê**: não cria tarefa nem inicia sessão. (Abrir Foco pede ao servidor o encontro atual, como o uso normal faz.) A senha é apenas digitada no formulário do site; o script não a imprime nem grava. Prefira não deixá-la no histórico do terminal.

Criar tarefa e rodar uma sessão de foco no site publicado ficam para um teste manual: num ambiente único, automatizar isso gravaria atividade falsa no seu histórico.

Repita em um celular de verdade pelo menos uma vez: o smoke simula a largura da tela, não o aparelho.

## Deploys seguintes

- **Frontend**: `git push` na `main`. A Vercel constrói e publica sozinha.
- **Banco**: migrations **não** são aplicadas pelo deploy. A ordem importa, porque frontend e banco são publicados em momentos diferentes:
  1. Escreva a migration em `supabase/migrations/` e revise.
  2. Rode `npm run db:push` (aplica no projeto real).
  3. Rode `npm run db:types` e `npm run db:verify`.
  4. Só então faça o `git push` do código que depende dela.

  Entre os passos 2 e 4 o site publicado é a versão antiga rodando sobre o banco novo. Por isso migrations devem ser **compatíveis com o código anterior**: adicionar tabela, coluna ou função é seguro; remover ou renomear algo que o código publicado ainda usa quebra o site até o push. Para remover, faça em dois deploys: primeiro o código que deixa de usar, depois a migration que remove.

## Rollback

- **Frontend**: na Vercel, _Deployments_ → escolha o deploy anterior → _Promote to Production_ (ou _Instant Rollback_). Leva segundos e não mexe no banco. Depois corrija na `main`; o próximo push volta a ser o deploy ativo.
- **Banco**: não há "desfazer" de migration, e não há backup automático no plano gratuito (ver `docs/SECURITY.md`). A regra é **corrigir para frente**: uma nova migration que conserte a anterior. Antes de uma migration que apague ou transforme dados do usuário, faça uma cópia manual.
- **Os dois juntos**: se um deploy de frontend dependia de uma migration e precisou voltar, o frontend antigo continua funcionando desde que a migration tenha sido só aditiva — que é o motivo da regra acima.

## Pendências conhecidas

- **Backup**: sem backup automático; o comando manual depende de Docker e não foi testado. Exportação pelo app é o T-040.
- **Sem staging**: todo teste de banco roda no projeto de produção, em transações revertidas.
- **Domínio próprio, MFA e limites de taxa** são configurações de painel (Vercel e Supabase), fora do repositório.
- **HSTS**: a Vercel envia `Strict-Transport-Security` por conta própria em domínios dela; não está no `vercel.json`.
