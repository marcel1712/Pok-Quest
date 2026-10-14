# Segurança e privacidade

Auditoria feita no T-038 (2026-10-14). Este documento diz o que protege os dados, o que foi verificado e como, o que ficou de fora, e o que fazer se algo der errado.

## Modelo

- **Um usuário, uma conta.** Login por email e senha; cadastro público desligado no Supabase (`disable_signup: true`, conferido pelo endpoint público de configurações). Nenhum provedor externo habilitado.
- **A chave no navegador é a `anon`, pública por desenho.** Ela aparece no bundle e isso é esperado. Quem protege os dados não é o sigilo dessa chave, e sim as três camadas abaixo. A chave `service_role` não existe em lugar nenhum deste repositório nem do build.
- **Três camadas independentes no Postgres**, todas necessárias:
  1. **Grants por papel** — o que cada papel pode fazer em cada tabela e função. `anon` não tem nenhum; `authenticated` tem só o que o app usa.
  2. **RLS** — dentro do que o grant permite, só as linhas do próprio usuário.
  3. **Grants por coluna** — em `owned_pokemon`, o cliente só altera `party_position` e `nickname`.
- **Progresso só nasce no servidor.** XP, nível, espécie, capturas, insígnias, progresso de campanha, encontros e o registro de histórico são escritos apenas por funções `SECURITY DEFINER` e triggers. O cliente declara intenções (criar tarefa, iniciar sessão, declarar um compromisso) e confirma o que o servidor já decidiu.

## O que cada papel pode fazer

Saída de `supabase/audit/privileges.sql` depois do endurecimento:

| Tabela                                                                                                                                                       | `anon` | `authenticated`                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------- |
| `tasks`, `categories`                                                                                                                                        | nada   | ler, criar, alterar, apagar (as próprias) |
| `focus_sessions`, `profiles`                                                                                                                                 | nada   | ler, criar, alterar (as próprias)         |
| `battles`                                                                                                                                                    | nada   | ler, criar (as próprias)                  |
| `owned_pokemon`                                                                                                                                              | nada   | ler; alterar só posição no time e apelido |
| `reward_events`, `productivity_events`, `captures`, `badges`, `encounters`, `evolution_events`, `game_progress`, `campaign_node_progress`, `history_entries` | nada   | só ler (as próprias)                      |
| `species_catalog`, `campaign_*` (conteúdo)                                                                                                                   | nada   | só ler                                    |

Funções chamáveis pelo cliente autenticado: `capture_from_battle`, `choose_starter`, `confirm_evolution`, `get_or_create_encounter`, `get_history_summary`, `swap_party_positions`. Todas as outras (resolução de batalha, sorteio de encontro, objetivo da campanha, limpeza de tarefas, curva de XP, funções de trigger) não têm `EXECUTE` para nenhum papel de cliente.

Toda função `SECURITY DEFINER` tem `search_path` vazio.

**Padrão para o futuro:** os privilégios padrão do schema `public` foram alterados — tabelas e funções criadas por novas migrations nascem **sem** acesso para `anon`/`authenticated`. Cada migration precisa conceder explicitamente o que a tabela ou função precisa. Esquecer um `grant` agora quebra a funcionalidade (visível na hora); esquecer um `revoke` não expõe mais nada.

## O que foi verificado

Automatizado, em `supabase/verification/t038-security-audit.sql` (roda com `npm run db:verify`, tudo revertido ao final):

- **Anônimo:** nenhuma tabela ou view de `public` é legível, e nenhuma função não-trigger é executável. O teste percorre o catálogo do banco, então uma tabela nova entra sozinha.
- **Outro usuário autenticado** (uma segunda conta criada dentro da transação e desfeita): não lê, altera nem apaga nenhuma linha da vítima em nenhuma tabela com dono; não lê nem altera o perfil dela; não cria tarefa nem sessão em nome dela; não captura da batalha dela, não confirma a evolução dela, não mexe no time dela; o histórico e o resumo dele não incluem a atividade dela.
- **O próprio dono não forja progresso:** 22 tentativas diretas (inserir XP, alterar nível/XP/espécie, inserir Pokémon lendário, insígnia, captura, progresso de campanha, trocar o Pokémon do encontro, trocar o inicial, marcar batalha como vencida, alterar catálogo e tabelas de rota…) são todas recusadas por falta de permissão. As quatro funções internas não são chamáveis por RPC.
- O teste foi posto à prova: fazendo o "intruso" usar a identidade da vítima, ele falha com `another user can read 5 row(s) of public.tasks`.

Conferido à mão nesta auditoria:

- **Segredos:** `.env` nunca foi versionado; nenhuma chave, token ou senha no histórico do Git nem na árvore de trabalho. O build não gera source maps e só embute as duas variáveis `VITE_` públicas.
- **XSS:** o código não usa `dangerouslySetInnerHTML`, `innerHTML`, `eval` nem URLs `javascript:`. Todo texto do usuário (títulos e descrições de tarefa, apelidos) e todo texto de conteúdo é renderizado como texto pelo React.
- **Conteúdo externo:** as únicas URLs externas são as imagens de sprites, que vêm do catálogo. O catálogo só é escrito por migrations revisadas; o cliente não tem como alterar uma URL.
- **Logs:** o app não escreve nada no console.
- **API:** o esquema OpenAPI do PostgREST não é exposto para a chave `anon`; não há buckets de Storage.

## O que não foi verificado, ou é risco aceito

- **A sessão fica no `localStorage`** (padrão do Supabase). Um XSS, se existisse, poderia lê-la. A mitigação é não haver sink de XSS; uma Content-Security-Policy como segunda barreira fica para o deploy (T-039), porque em desenvolvimento o Vite precisa de script inline.
- **Senha:** o mínimo configurado no projeto é 6 caracteres e não há segundo fator. Para uma conta única, uma senha longa e única é a medida que mais importa; ativar MFA no painel do Supabase é recomendado.
- **Configurações que só existem no painel** (proteção contra senha vazada, limites de taxa, expiração de sessão) não foram inspecionadas — o CLI não as expõe.
- **Sprites por hotlink:** quem hospeda as imagens (GitHub, repositório da PokéAPI) vê o IP e o horário de cada carregamento.
- **Ambiente único:** os testes de segurança rodam no banco de produção, dentro de transações revertidas. Não há ambiente separado.
- **Dependências:** `npm audit` não aponta vulnerabilidades hoje; não há verificação automática contínua.

## Se algo der errado

### Perdi a senha

Cadastro desligado não impede recuperação. No painel do Supabase: **Authentication → Users →** o usuário **→ Send password recovery** (envia email) ou **Reset password** (define uma nova na hora). Não é preciso mexer no banco.

### Suspeita de sessão roubada ou dispositivo perdido

1. No app, **Sair**: o `signOut` do Supabase usa escopo global por padrão e revoga os refresh tokens de **todos** os dispositivos.
2. Troque a senha pelo painel.
3. Um token de acesso já emitido continua válido até expirar (1 hora, `jwt_expiry = 3600`). Para cortar na hora, gere um novo segredo JWT em **Project Settings → API**; isso invalida todas as sessões e **troca a chave `anon`**, então o `.env` e o deploy precisam ser atualizados.

### Suspeita de chave vazada

A chave `anon` é pública; "vazar" não muda nada. Se uma chave `service_role` algum dia for criada e exposta, rotacione-a no painel imediatamente: ela ignora RLS e grants.

### Backup e restauração

- **Não há backup automático garantido:** no plano gratuito do Supabase não existem backups diários. Antes de depender do app no dia a dia, faça cópias manuais ou mude de plano.
- **Cópia manual:** `npx supabase db dump --linked -f backup.sql` (esquema) e `npx supabase db dump --linked --data-only -f backup-data.sql` (dados). O comando usa Docker; **não foi testado neste ambiente**, que não tem Docker.
- **O esquema é reproduzível sem backup:** `supabase/migrations/` recria todas as tabelas, funções, conteúdo de campanha e catálogo num projeto novo com `npm run db:push`. O que só existe no banco são os dados do usuário.
- **Exportação pelo próprio app** (JSON/CSV) e um restore testado em projeto separado são o escopo do T-040.

## Rotina

- Depois de qualquer migration que crie tabela ou função: rode `npx supabase db query --linked -f supabase/audit/privileges.sql` e confira os grants; depois `npm run db:verify`.
- Nunca dar `EXECUTE` a `authenticated` numa função que aceita como argumento algo que deveria ser decidido pelo servidor (dono, XP, espécie, nível).
