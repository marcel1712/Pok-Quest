# PokéQuest — Requisitos, arquitetura e backlog de implementação

> **Versão:** 1.0 — especificação inicial para execução com Claude Code  
> **Status:** planejamento; nenhuma tarefa está marcada como concluída  
> **Produto:** aplicativo web pessoal de produtividade gamificado com jornada Pokémon  
> **Prioridades:** **P0** = mínimo produto utilizável; **P1** = experiência Pokémon completa da primeira região; **P2** = melhorias futuras  
> **Princípio norteador:** a produtividade vem primeiro; a fantasia de Pokémon motiva, não obriga nem pune.

---

## 1. Visão do produto

O **PokéQuest** é um aplicativo web privado, de **usuário único**, utilizável no computador e no celular, que reúne **lista de tarefas**, **Pomodoro** e uma **jornada inspirada em Pokémon**. O usuário cria tarefas reais, conclui sessões de foco e avança por encontros, batalhas automáticas, capturas, evolução e insígnias. A aparência da interface é moderna, com sprites em pixel art e uma apresentação visual de batalhas. Não haverá seleção manual de ataques durante o Pomodoro.

### 1.1 Objetivos

1. Diminuir o atrito de registrar, organizar e concluir tarefas.
2. Transformar esforço real em uma sensação concreta de progresso: inimigos, vitórias, XP, Pokémon e marcos de história.
3. Permitir sessões de foco sem precisar interagir com o jogo.
4. Preservar progresso acumulado em dias ruins: **sem perder HP, XP, níveis ou insígnias por deixar tarefas pendentes**.
5. Manter navegação rápida, inclusive ao retornar a telas já visitadas.
6. Sincronizar informações entre computador e celular, com acesso apenas pela conta autorizada.

### 1.2 Escopo e limites

**Dentro do escopo:** tarefas individuais e recorrentes, categorias simples, dificuldade, calendário básico/visão do dia, Pomodoro, eventos de produtividade, motor de recompensa e batalha automática, time de seis Pokémon, armazenamento dos capturados, evolução, encontros por região, campanha de Sinnoh, dashboard, histórico, dados persistentes e responsividade.

**Fora do MVP:** multiplayer, ranking entre usuários, rede social, chat, marketplace, PvP, mundo aberto controlável, batalha por turnos com escolha manual de golpes, geração automática de roteiros por IA, notificações push garantidas, suporte offline completo, app nativo e microsserviços.

**Conteúdo e direitos:** o caráter privado **não garante isenção de direitos autorais**. Conferir termos da PokéAPI e a procedência/licenças dos sprites; não publicar nem distribuir artes e textos protegidos como se fossem próprios. A campanha pode ser inspirada nos marcos de Sinnoh sem copiar diálogos extensos dos jogos.

---

## 2. Decisões tomadas e pontos a validar

### 2.1 Decidido

| Tema                 | Decisão                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Usuários             | Apenas uma conta autorizada; sem cadastro público                                                               |
| Acesso               | Web responsiva no computador e celular                                                                          |
| Nome                 | **PokéQuest**                                                                                                   |
| Arquitetura          | Repositório único, **frontend modular + backend gerenciado**, sem microsserviços                                |
| Frontend             | React + Vite + TypeScript                                                                                       |
| Navegação            | React Router, sem recarregar a página a cada rota                                                               |
| UI                   | Tailwind CSS + shadcn/ui; visual moderno e sprites pixel art                                                    |
| Estado remoto        | TanStack Query (cache, invalidação e atualizações otimistas quando apropriadas)                                 |
| Estado local         | Zustand para UI e sessão de foco; banco como fonte da verdade                                                   |
| Dados e autenticação | Supabase Auth + PostgreSQL + RLS                                                                                |
| Dados Pokémon        | PokéAPI como fonte, com catálogo/cache próprios para impedir requisições a cada tela                            |
| Animações            | Motion; suportar `prefers-reduced-motion`                                                                       |
| Testes               | Vitest + React Testing Library + Playwright para fluxos críticos                                                |
| Produtividade        | Tarefas devem render mais recompensas do que um Pomodoro comum de esforço equivalente                           |
| Batalhas             | Automáticas; ações reais acionam a resolução                                                                    |
| Experiência          | Sem penalizar dias sem produtividade; conclusão de compromisso anunciado não deve resultar em derrota aleatória |

### 2.2 Propostas **a confirmar** — não tratar como decisões irreversíveis

| Assunto               | Proposta inicial                                                                                                | Onde parametrizar             |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Dificuldade da tarefa | Escala **1–5**, valor padrão 2; campo opcional                                                                  | `product-config` e formulário |
| Tempo do Pomodoro     | Presets **25/30/45/60 min**; pausas 5/10/15                                                                     | Configurações do usuário      |
| Categoria             | Opcional, poucas categorias editáveis (pessoal, faculdade, programação…)                                        | Tabela `categories`           |
| Recorrência           | Dias da semana e frequência diária/semanal, sem regras muito elaboradas                                         | Motor de recorrência          |
| Starter               | Turtwig, Chimchar ou Piplup                                                                                     | Catálogo / onboarding         |
| Campanha              | Sinnoh: rival, rotas, ginásios, equipe antagonista, liga; marcos inspirados nos jogos                           | Dados versionados de campanha |
| Derrota               | Só por sessão abortada/não confirmada ou compromisso não cumprido; permitir tentar de novo sem perda permanente | Motor de batalha              |
| Captura               | Encontro selvagem guiado por área, níveis e raridade; confirmação simples ou captura automática                 | Motor de encontro             |
| Evolução              | Condições compatíveis com espécie, ajustadas para o app sem obrigar trocas externas                             | Motor de evolução             |
| Duração de campanha   | Ritmo ajustável por número de ações/sessões, sem exigir Pomodoros de 2 horas                                    | Balanceamento                 |
| Áudio                 | Desligado por padrão; efeito sonoro opcional                                                                    | Configurações                 |

**Regra para o Claude Code:** sempre que uma decisão aberta bloquear uma tarefa, usar a proposta configurável acima, documentar o pressuposto no `DECISIONS.md` e **não** inventar novas mecânicas sem registrar a escolha.

---

## 3. Requisitos funcionais (RF)

### 3.1 Identidade e sessão

- **RF-001 [P0]** — Permitir login exclusivamente para a conta previamente autorizada.
- **RF-002 [P0]** — Bloquear cadastro público, proteger rotas e dados mesmo que alguém descubra a URL.
- **RF-003 [P0]** — Manter a sessão entre acessos, com logout e recuperação segura de acesso.
- **RF-004 [P0]** — Sincronizar tarefas, foco e progresso entre dispositivos após persistência confirmada.

### 3.2 Tarefas

- **RF-005 [P0]** — Criar tarefa com **título obrigatório** e descrição opcional.
- **RF-006 [P0]** — Editar, concluir, reabrir e arquivar tarefas sem perder histórico.
- **RF-007 [P0]** — Oferecer categoria simples opcional, dificuldade sugerida de 1 a 5 e data opcional.
- **RF-008 [P0]** — Exibir no dashboard tarefas de hoje, pendentes e próximas, com filtros simples.
- **RF-009 [P0]** — Concluir tarefa de forma idempotente: cliques duplicados não geram XP duplo.
- **RF-010 [P1]** — Criar recorrências simples, gerando instâncias sem sobrescrever conclusões anteriores.
- **RF-011 [P1]** — Permitir reagendar e administrar atrasos sem punir o usuário.
- **RF-012 [P1]** — Exibir histórico de tarefas e recompensas recebidas.

### 3.3 Pomodoro

- **RF-013 [P0]** — Iniciar sessão com duração selecionável dentro de limites razoáveis.
- **RF-014 [P0]** — Pausar, retomar, cancelar e finalizar sessão, registrando o resultado.
- **RF-015 [P0]** — Recuperar corretamente o tempo ao atualizar, bloquear ou reabrir a aba, usando timestamps persistidos, não a quantidade de ticks do `setInterval`.
- **RF-016 [P0]** — Diferenciar _tempo decorrido_ de _sessão realmente validada_: solicitar confirmação de conclusão e evitar vitória implícita só porque o relógio zerou.
- **RF-017 [P0]** — Vincular uma sessão a encontro/desafio e opcionalmente a uma tarefa.
- **RF-018 [P1]** — Permitir ciclo de foco e descanso, preferências de duração e histórico agregado.
- **RF-019 [P1]** — Evitar múltiplas sessões simultâneas válidas na mesma conta, inclusive em abas distintas.

### 3.4 Batalha, XP e progressão

- **RF-020 [P0]** — Apresentar um oponente e os Pokémon envolvidos **antes** de iniciar o Pomodoro/desafio.
- **RF-021 [P0]** — Executar batalha **automaticamente** quando o usuário concluir a ação combinada, com animação ou resumo; não exigir golpes manuais.
- **RF-022 [P0]** — Explicitar antes da confirmação o compromisso necessário para vencer; se cumprido, **garantir vitória** (sem derrota aleatória).
- **RF-023 [P0]** — Conceder recompensas coerentes com dificuldade da tarefa, duração de foco, tipo de encontro e composição/nível da equipe, sem crescimento infinito do esforço exigido.
- **RF-024 [P0]** — Registrar vitórias, derrotas/retiradas e recompensas com trilha de eventos; impedir XP duplicado.
- **RF-025 [P1]** — Diferenciar treinadores comuns, rival, encontros selvagens, líderes de ginásio e marcos de história.
- **RF-026 [P1]** — Ajustar desafios por progressão, com teto de duração e alternativas viáveis; não exigir tarefa difícil **e** sessão de várias horas para continuar.
- **RF-027 [P1]** — Mostrar como a força do time modifica facilidade e recompensas, mantendo previsibilidade.

### 3.5 Pokémon e Pokédex

- **RF-028 [P1]** — Escolher Pokémon inicial entre os iniciais de Sinnoh.
- **RF-029 [P1]** — Ter time ativo de até seis Pokémon e box de capturados.
- **RF-030 [P1]** — Exibir espécies, tipos, sprites, níveis, XP, forma, requisitos de evolução e histórico básico.
- **RF-031 [P1]** — Gerar encontros compatíveis com a região/rota desbloqueada, raridade e faixas de nível, sem lendários precoces por sorteio irrestrito.
- **RF-032 [P1]** — Capturar Pokémon conforme regra de encontro definida, sem perder captura por recarga ou requisição duplicada.
- **RF-033 [P1]** — Evoluir Pokémon quando requisitos forem satisfeitos; casos especiais recebem regras adaptadas e documentadas.
- **RF-034 [P1]** — Impedir dados de espécies ausentes de quebrar a UI: prever sprites substitutos e estado de erro.

### 3.6 História, dashboard e preferências

- **RF-035 [P0]** — Dashboard com ações principais, tarefas, Pomodoro, equipe resumida e próximo objetivo.
- **RF-036 [P1]** — Jornada de Sinnoh versionada, com rotas, rival, NPCs, ginásios, insígnias e condições explícitas de desbloqueio.
- **RF-037 [P1]** — Exibir contexto narrativo curto antes/depois de encontros e marcos, sem bloquear a produtividade.
- **RF-038 [P1]** — Persistir progresso de história e permitir retomar após interrupções.
- **RF-039 [P1]** — Histórico com total de sessões, tarefas concluídas, XP e conquistas, sem foco em punições.
- **RF-040 [P1]** — Preferências de duração, sons, animações e movimento reduzido.
- **RF-041 [P1]** — Exportar os dados pessoais em formato legível (JSON; CSV para tarefas/sessões).
- **RF-042 [P2]** — Evoluir para outras regiões e eventos especiais sem reescrever a lógica central.

---

## 4. Requisitos não funcionais (RNF)

- **RNF-001 — Performance:** navegação client-side com feedback visual imediato; sem tela em branco aguardando todos os dados. Meta de UX: transição visual perceptível em ~200 ms em dispositivo razoável; monitorar tempo real, não prometer isso para toda rede.
- **RNF-002 — Cache:** TanStack Query com `staleTime`, invalidação específica, prefetch pontual e estados de carregamento/erro/vazio. Evitar buscar PokéAPI a cada navegação.
- **RNF-003 — Responsividade:** interface utilizável a partir de ~360 px, tablets e desktop; alvos de toque adequados e sem scroll horizontal acidental.
- **RNF-004 — Acessibilidade:** navegação por teclado, semântica, foco visível, contraste legível, labels e alternativa textual às batalhas; respeitar movimento reduzido.
- **RNF-005 — Segurança:** Supabase Auth, RLS em **todas** as tabelas de usuário, política restrita ao UID autorizado; nenhuma chave `service_role` no navegador; segredos apenas no servidor.
- **RNF-006 — Integridade:** conclusão, vitória, XP, captura e avanço de história **transacionais e idempotentes**; o cliente nunca é fonte confiável do próprio XP.
- **RNF-007 — Disponibilidade:** erros de rede claros, retry controlado, persistência robusta e recuperação após queda; modo offline completo não é obrigação do MVP.
- **RNF-008 — Observabilidade:** logs estruturados com identificadores de operação, sem vazar tokens nem conteúdo sensível; erros visíveis e investigáveis.
- **RNF-009 — Qualidade:** TypeScript estrito, ESLint, formatação consistente, testes unitários para domínio e E2E para jornadas essenciais.
- **RNF-010 — Arquitetura:** separação entre UI, casos de uso, regras puras de domínio e acesso a dados; módulos com limites claros.
- **RNF-011 — Escalabilidade apropriada:** projetar para um único usuário, sem superengenharia; schema e funções devem aceitar expansão futura sem ser requisito atual.
- **RNF-012 — Usabilidade:** cadastro rápido de tarefa; ações primárias acessíveis em até poucos toques; animações não impedem concluir tarefas.
- **RNF-013 — Consistência temporal:** armazenar instantes em UTC e converter pela timezone configurada; definir a fronteira do “dia” corretamente.
- **RNF-014 — Licenciamento:** documentar origem/uso das fontes, sprites, nomes e imagens; não assumir que API implica licença comercial ou de redistribuição.
- **RNF-015 — Portabilidade:** migrations versionadas, seed reproduzível, documentação de ambiente, exportação e restauração.
- **RNF-016 — Compatibilidade:** versões recentes dos principais navegadores desktop e mobile; testar principalmente Chrome Android e Safari iOS.
- **RNF-017 — Eficiência:** imagens dimensionadas e lazy-loaded quando adequado; evitar bundles grandes e animações custosas.
- **RNF-018 — Resiliência:** serviços de terceiros indisponíveis não devem impedir acessar tarefas e sessões já salvas.

---

## 5. Regras de negócio e critérios de balanceamento

### 5.1 Princípios não negociáveis

1. **Produtividade não pode depender de ganhar batalha:** tarefas e sessões são registradas independentemente das animações.
2. **Sem punição por ausência:** dias sem atividade não geram dano, perda de XP nem dívida fictícia.
3. **Compromisso cumprido = vitória previsível:** antes de começar, mostrar claramente a condição; sorte pode afetar texto/animação/loot opcional, nunca anular um esforço validado.
4. **Equipe importa, mas não cria bloqueio injusto:** nível/tipos podem reduzir o esforço mínimo exigido, abrir opções ou melhorar bônus, respeitando limites; não gerar derrotas surpresa.
5. **O progresso não exige esforço indefinidamente crescente:** teto de sessão; dificuldade maior significa planejamento, variedade ou marcos, não Pomodoros de horas.
6. **A recompensa de tarefa tende a superar a de Pomodoro:** parametrizar pontuação para evitar exploração por tarefas artificiais ou microtarefas repetidas.
7. **Dados persistentes são fonte da verdade:** animação apenas representa resultado já registrado de forma segura.

### 5.2 Fluxo proposto de batalha

1. Motor determina próximo encontro válido para rota/marco desbloqueado.
2. UI mostra adversário, Pokémon, dificuldade e alternativas de compromisso aceitas.
3. Usuário escolhe um compromisso (ex.: sessão de 30 min, tarefa nível 3, ou combinação **opcional**), com indicação clara de vitória garantida se cumprido.
4. O sistema cria `battle` e `commitment` persistidos, protegidos contra criação duplicada.
5. Usuário conclui a atividade; backend valida sua elegibilidade e conclui resultado **uma vez**.
6. Transação grava resultado, concedendo XP/itens/captura/avanço aplicáveis, com ledger de eventos.
7. UI mostra animação de batalha e depois resumo persistido; refrescar a tela não concede nada novamente.

**Nota de desenho:** não começar implementando dano, golpes e IA de combate completos. Para o MVP, usar **simulação narrativa determinística** que representa o esforço e o time; a profundidade visual pode crescer independentemente das regras de produtividade.

### 5.3 Casos de borda obrigatórios

- Pomodoro ultrapassou o horário enquanto aba estava fechada: recuperar estado e **pedir validação**, não dar vitória automática.
- Sessão interrompida, cancelada, pausada por muito tempo ou sem confirmação: não conceder sucesso automaticamente.
- Tarefa marcada concluída duas vezes, em duas abas ou em dois dispositivos: uma única conclusão e uma única recompensa.
- Falha de rede **depois** da transação e **antes** de o navegador receber resposta: reconsulta pelo identificador idempotente, sem duplicar resultado.
- Tarefa reaberta após ter gerado XP: não gerar XP de novo no mesmo ciclo/instância; definir política de reversão apenas se explicitamente desejada.
- App aberto em dois aparelhos: prevenir Pomodoros ativos simultâneos ou resolver conflito explicitamente.
- Mudança de data/horário, horário de verão e timezone: aplicar regras de data consistentes.
- Sprites ausentes, API indisponível, evolução especial não mapeada e história em final de capítulo: fallback confiável.
- Acesso não autorizado à URL, tabelas, RPCs e funções: nenhuma leitura/mutação de dados privados.

---

## 6. Interfaces e fluxos principais

| Tela/fluxo        | Informações e ações                                                                       | Observações de UX                                 |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Login**         | Entrar com a única conta autorizada                                                       | Sem CTA de cadastro público                       |
| **Dashboard**     | Próxima batalha, Pokémon ativos, tarefas de hoje, botão de novo foco, resumo de progresso | Informação útil acima da decoração                |
| **Tarefas**       | Adicionar título, descrição, categoria, dificuldade, data; concluir, editar, arquivar     | Entrada rápida e filtros discretos                |
| **Foco**          | Timer, compromisso, adversário, party, pausar/cancelar/confirmar                          | Cronômetro legível; não exigir cliques no combate |
| **Resultado**     | Vitória/retirada, XP, níveis, captura/evolução, próximo marco                             | Animação opcional; botão “pular”                  |
| **Equipe e box**  | 6 ativos, capturados, troca de integrantes, detalhes                                      | Fallback de sprite e boa performance              |
| **Jornada**       | Região, rota atual, próximos encontros, insígnias                                         | Narrativa curta e progressão compreensível        |
| **Histórico**     | Atividades realizadas, horas focadas, XP e vitórias                                       | Não punir dias sem atividade                      |
| **Configurações** | Preferências de tempo, som, movimento, conta, exportar                                    | Opções mínimas no MVP                             |

**Direção visual:** interface contemporânea e limpa; cores/tipografia próprias, cards com hierarquia clara e efeitos pontuais; sprites pixel art renderizados sem borrão quando apropriado (`image-rendering: pixelated`); batalha visualmente envolvente sem transformar a navegação em um jogo pesado.

---

## 7. Arquitetura técnica de referência

### 7.1 Stack

- **Frontend:** React + Vite + TypeScript (`strict: true`).
- **Rotas:** React Router com code splitting/lazy loading por páginas quando houver benefício real.
- **UI:** Tailwind CSS, shadcn/ui, Motion e ícones consistentes.
- **Comunicação/dados:** Supabase JS SDK, TanStack Query para consultas e cache.
- **Estado efêmero:** Zustand somente para estado de UI e controles locais; **não** replicar o banco inteiro na store.
- **Persistência:** Supabase PostgreSQL com migrations SQL, índices, restrições e RLS.
- **Regras sensíveis:** PostgreSQL RPC e/ou Supabase Edge Functions; conclusão/recompensas no lado confiável e transacional.
- **Conteúdo externo:** PokéAPI para importar catálogo inicial/atualizações; runtime do app lê cache próprio.
- **Validação:** Zod para entradas; validação equivalente no servidor e constraints no banco.
- **Qualidade:** ESLint, Prettier, Vitest, Testing Library, Playwright e GitHub Actions (ou CI equivalente).
- **Publicação:** frontend estático em Vercel e backend Supabase. Não incluir Prisma sem necessidade: o SDK + SQL migrations já atendem ao desenho escolhido.

### 7.2 Estrutura inicial sugerida

```text
pokequest/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── GAME_RULES.md
│   └── QA.md
├── public/
├── src/
│   ├── app/                 # providers, router, layout, bootstrap
│   ├── pages/               # composição das rotas
│   ├── features/
│   │   ├── auth/
│   │   ├── tasks/
│   │   ├── focus/
│   │   ├── battles/
│   │   ├── pokemon/
│   │   ├── journey/
│   │   ├── rewards/
│   │   └── settings/
│   ├── shared/
│   │   ├── ui/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── types/
│   └── styles/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
├── tests/
│   ├── e2e/
│   └── fixtures/
├── .env.example
└── package.json
```

**Regras de dependência:** `pages → features → shared`; módulo não modifica diretamente tabelas privadas de outro domínio sem passar por caso de uso definido; regras puras do jogo desacopladas de React e do Supabase; acesso privilegiado só no servidor.

### 7.3 Entidades de dados sugeridas

| Entidade                | Campos principais / responsabilidade                                              |
| ----------------------- | --------------------------------------------------------------------------------- |
| `profiles`              | `id` (UID autorizado), timezone, configurações                                    |
| `categories`            | categoria personalizada, ordem e cor opcional                                     |
| `tasks`                 | id, owner_id, título, descrição, categoria, dificuldade, data, status, timestamps |
| `task_recurrence_rules` | frequência/dias, timezone, data início/fim, status                                |
| `task_occurrences`      | instâncias de recorrência por data, status, conclusão única                       |
| `focus_sessions`        | início, duração planejada, pausas, estado, confirmação, fim, idempotency_key      |
| `species_catalog`       | ID Pokédex, nome, tipos, sprites, evoluções, metadados versão/cache               |
| `owned_pokemon`         | espécime do usuário, espécie, nível, XP, apelido, posição no time, data captura   |
| `game_progress`         | região, rota/marco atual, starter escolhido, estado                               |
| `campaign_nodes`        | estrutura versionada de jornada e pré-requisitos                                  |
| `encounter_tables`      | espécies por local, nível, pesos/raridades, restrições                            |
| `battles`               | adversário, contexto, compromisso escolhido, estado e resultado                   |
| `battle_commitments`    | ação vinculada, duração/dificuldade prometida e elegibilidade                     |
| `reward_events`         | **ledger** imutável, fonte, tipo, valor, beneficiário, chave idempotente          |
| `captures`              | encontro, espécie capturada, evento associado, estado único                       |
| `badges`                | insígnia, marco e data                                                            |
| `game_settings`         | parâmetros versionados de XP, dificuldade e regras                                |

**Não implementar tabelas cegamente:** primeiro validar cardinalidades, relações e quais dados são realmente necessários para a primeira fatia vertical. Preferir migrations incrementais. Usar `uuid`, foreign keys, `check constraints`, índices em `owner_id`, status/datas relevantes e índices únicos de idempotência. Evitar duas fontes da verdade para o mesmo progresso.

### 7.4 Segurança e consistência

- Habilitar RLS em todas as tabelas com dados privados; restringir por `auth.uid()` e UID autorizado; testar acesso anônimo e de outro usuário.
- Não permitir que o frontend escreva diretamente em `reward_events`, XP consolidado, `badges` ou estado de vitória.
- Usar RPC transacional para “concluir ação → resolver batalha → creditar recompensa → avançar marco”; em casos complexos, Edge Function orquestra e chama RPC atômica.
- Para RPC `SECURITY DEFINER`, controlar permissões (`EXECUTE`), validar UID e configurar `search_path` seguro; revisar segurança de todas as funções.
- Idempotency keys geradas por operação, índices únicos e retorno do resultado anterior quando requisição for repetida.
- Chaves públicas/anon podem estar no navegador **somente** se RLS estiver correta; segredos e `service_role` jamais no bundle frontend.
- Não armazenar tokens em logs; reduzir PII ao mínimo; ativar backups/exportação antes de depender do app diariamente.

---

## 8. Backlog de implementação com checklist por tarefa

**Convenções:** cada tarefa tem prioridade, dependências, checklist e **critério de aceite (CA)**. “Concluída” significa código implementado, testado e documentado — não apenas uma tela visual. Realizar tarefas em **fatias verticais** para garantir uso real antes de sofisticar animações.

### Fase 0 — Planejamento verificável

#### T-001 [P0] Consolidar decisões de produto

**Depende de:** nenhuma

- [ ] Criar `docs/PRD.md` com objetivos, público único, módulos e escopo.
- [ ] Criar `docs/DECISIONS.md` registrando escolhas, data e trade-offs.
- [ ] Identificar regras propostas ainda não aprovadas: captura, evolução, derrota, dificuldade e duração.
- [ ] Declarar explicitamente que tarefas e Pomodoro funcionam mesmo sem batalhas.
- [ ] Delimitar MVP, P1 e P2; evitar construir toda Sinnoh antes de validar produtividade.
- [ ] Transformar cada RF/RNF em referência rastreável no backlog.
      **CA:** uma IA consegue distinguir fatos decididos de hipóteses configuráveis.

#### T-002 [P0] Prototipar fluxos e hierarquia da UI

**Depende de:** T-001

- [ ] Desenhar fluxo Dashboard → Nova tarefa → Concluir → Recompensa.
- [ ] Desenhar fluxo Dashboard → Novo foco → Encontro → Timer → Confirmar → Batalha.
- [ ] Desenhar versões mobile e desktop das telas principais.
- [ ] Priorizar ações de produtividade; não esconder “Nova tarefa” sob elementos decorativos.
- [ ] Definir comportamento de loading, erro, vazio e sem conexão em cada rota.
- [ ] Definir sistema visual mínimo (tipografia, espaçamentos, cores, densidade e sprites).
      **CA:** protótipos dos fluxos principais incluem todos os estados críticos e navegação clara.

#### T-003 [P0] Especificar matemática do RPG antes de codificar

**Depende de:** T-001

- [ ] Criar `docs/GAME_RULES.md` com estados de batalha e sessão.
- [ ] Formalizar condições de vitória **visíveis antes** do compromisso.
- [ ] Definir fórmula inicial parametrizada de recompensa para tarefa 1–5 e foco 25–60 min.
- [ ] Garantir que recompensa de tarefa significativa normalmente supere Pomodoro simples.
- [ ] Definir influência do time sem derrotas arbitrárias, limite de esforço e política de retirada.
- [ ] Definir prevenção de exploração por conclusão/reabertura/repetição.
- [ ] Escrever exemplos verificáveis: iniciante, time forte, ginásio, foco abortado.
      **CA:** motor implementável com entradas e saídas testáveis, sem depender da interface.

#### T-004 [P0] Definir dados de campanha e política de assets

**Depende de:** T-001

- [ ] Estabelecer início em Sinnoh e starter selecionável (proposta).
- [ ] Planejar quais espécies, sprites e inimigos entram no MVP; incluir fallback.
- [ ] Definir formato JSON/TS para rotas, NPCs, encontros e pré-requisitos.
- [ ] Registrar proveniência e condições de uso de sprites/dados da PokéAPI.
- [ ] Decidir como lidar com narrativa inspirada nos jogos sem copiar diálogos extensos.
- [ ] Separar conteúdo de campanha da lógica de motor.
      **CA:** conteúdo pode ser ajustado sem editar lógica de batalha.

### Fase 1 — Fundação, dados e segurança

#### T-005 [P0] Inicializar repositório e ferramentas

**Depende de:** T-001

- [ ] Criar Vite React + TypeScript com `strict` e aliases de importação.
- [ ] Configurar ESLint, Prettier, scripts `dev`, `build`, `lint`, `typecheck`, `test`.
- [ ] Adicionar Tailwind CSS, shadcn/ui, React Router e providers-base.
- [ ] Adicionar TanStack Query, Zustand, Zod, Motion e Supabase SDK.
- [ ] Preparar `.gitignore`, `.env.example`, `README.md` e padrões de commits.
- [ ] Executar build/teste inicial limpo e conferir ausência de segredos no Git.
      **CA:** clone novo roda localmente seguindo README, com lint/typecheck/build aprovados.

#### T-006 [P0] Implementar layout, rotas e estados compartilhados

**Depende de:** T-005, T-002

- [ ] Criar shell responsiva, cabeçalho e navegação mobile/desktop.
- [ ] Implementar rotas de Dashboard, Tarefas, Foco, Equipe, Jornada e Configurações.
- [ ] Criar componentes de loading, erro, vazio e feedback de sucesso.
- [ ] Navegar via React Router (`Link`/`navigate`), sem `window.location.href` para rotas internas.
- [ ] Separar boundaries de erro e lazy loading sem flash de tela branca.
- [ ] Adicionar foco visível, labels, teclado e navegação acessível.
      **CA:** trocar rotas não recarrega o documento; shell permanece estável em mobile e desktop.

#### T-007 [P0] Criar projeto Supabase e migrações iniciais

**Depende de:** T-005

- [ ] Criar ambientes de desenvolvimento e produção ou estratégia explícita de isolamento.
- [ ] Configurar Supabase CLI, migrations versionadas e seed mínimo.
- [ ] Criar `profiles`, `categories`, `tasks` e constraints/índices iniciais.
- [ ] Registrar timezone padrão configurável e política de timestamps UTC.
- [ ] Gerar tipos TypeScript do schema para uso no frontend.
- [ ] Documentar variáveis de ambiente e procedimento de reset local seguro.
      **CA:** banco novo reproduz schema a partir das migrations, sem cliques manuais ocultos.

#### T-008 [P0] Restringir autenticação à conta única

**Depende de:** T-007

- [ ] Criar apenas a conta autorizada e desabilitar cadastro público na configuração do projeto.
- [ ] Implementar tela de login e logout com tratamento de sessão expirada.
- [ ] Criar guards de rota para experiências autenticadas.
- [ ] Restringir RLS por UID autorizado e proprietário em todas as tabelas privadas.
- [ ] Confirmar políticas de INSERT/SELECT/UPDATE/DELETE e restrições de FK.
- [ ] Testar acesso anônimo e segunda conta não autorizada, inclusive por chamada direta à API.
- [ ] Garantir ausência de `service_role` e outros segredos no frontend.
      **CA:** usuário não autorizado não lê nem altera dados mesmo usando API diretamente.

#### T-009 [P0] Criar infraestrutura de acesso a dados e cache

**Depende de:** T-007, T-008

- [ ] Centralizar cliente Supabase, mensagens de erro e tratamento de sessão.
- [ ] Criar query keys tipadas por domínio e hooks de consulta/mutação.
- [ ] Configurar `staleTime`, retry moderado e refetch seletivo.
- [ ] Criar estratégia de invalidação após mutações, sem limpar cache inteiro.
- [ ] Definir estados de loading sem bloquear o shell; preservar dados anteriores quando seguro.
- [ ] Medir requests no DevTools: rota reaberta não faz cascata desnecessária.
      **CA:** tela visitada novamente abre com dados em cache e sincronização de fundo correta.

#### T-010 [P0] Preparar testes, CI e convenções

**Depende de:** T-005

- [ ] Configurar Vitest e React Testing Library com setup comum.
- [ ] Configurar Playwright e fixture de autenticação para ambiente de teste.
- [ ] Criar pipeline CI com lint, typecheck, testes e build.
- [ ] Estabelecer mocks apenas para integrações, não para regras puras de RPG.
- [ ] Documentar padrão de testes e formato de nomes/fixtures.
- [ ] Adicionar ao menos um teste de componente, um de domínio e um smoke E2E.
      **CA:** toda alteração pode ser verificada automaticamente antes de merge/deploy.

### Fase 2 — Produtividade utilizável (primeira fatia vertical)

#### T-011 [P0] Construir domínio e CRUD de tarefas

**Depende de:** T-007, T-009

- [ ] Modelar título obrigatório, descrição opcional, dificuldade, categoria e data.
- [ ] Validar entradas com Zod e constraints no banco; limitar tamanhos de texto.
- [ ] Implementar criar/listar/editar/concluir/reabrir/arquivar.
- [ ] Separar casos de uso da UI e repositório Supabase.
- [ ] Guardar timestamps e dono; validar atualização apenas de registro autorizado.
- [ ] Criar testes para dados inválidos, tarefa inexistente e transições de estado.
      **CA:** CRUD persiste corretamente após refresh e em outro dispositivo.

#### T-012 [P0] Criar experiência de tarefas rápida e clara

**Depende de:** T-006, T-011

- [ ] Criar formulário “Nova tarefa” com título em destaque e campos secundários discretos.
- [ ] Permitir conclusão por ação rápida com feedback imediato.
- [ ] Exibir seções Hoje / Pendentes / Futuras e filtros básicos.
- [ ] Implementar edição, confirmação de arquivamento e mensagens acessíveis.
- [ ] Aplicar atualização otimista com rollback em erro de rede.
- [ ] Testar teclado, telas pequenas, texto longo, lista vazia e muitas tarefas.
      **CA:** cadastrar e concluir tarefa habitual exige poucos cliques e não bloqueia navegação.

#### T-013 [P0] Implementar conclusão idempotente e eventos de produtividade

**Depende de:** T-011

- [ ] Criar identificador estável para cada ato de conclusão.
- [ ] Criar registro único de `productivity_event` ou equivalente antes de créditos de XP.
- [ ] Impedir que dois cliques/abas gerem conclusões e recompensas duplicadas.
- [ ] Documentar regra de reabrir/reconcluir a mesma instância.
- [ ] Criar testes concorrentes e de retry.
- [ ] Expor resultado confiável para futura integração com motor de recompensa.
      **CA:** operação repetida retorna mesma conclusão, sem eventos duplicados.

#### T-014 [P1] Recorrências sem apagar histórico

**Depende de:** T-011, T-013

- [ ] Criar regras diárias/semanais e seleção de dias da semana.
- [ ] Gerar instâncias por data com chave única de recorrência + dia.
- [ ] Definir timezone e idempotência na geração de instâncias.
- [ ] Permitir editar série versus ocorrência individual com UX explícita.
- [ ] Tratar tarefa perdida sem penalidade e sem mutação retroativa do histórico.
- [ ] Testar virada de dia, múltiplas abas, edição e exclusão de série.
      **CA:** tarefa recorrente reaparece nos dias corretos sem reemitir recompensa antiga.

#### T-015 [P1] Histórico e métricas de tarefas

**Depende de:** T-013

- [ ] Criar histórico pesquisável/filtrável por data, categoria e estado.
- [ ] Calcular totais de tarefas concluídas sem contar duplicatas.
- [ ] Exibir progresso sem métricas punitivas por dias zerados.
- [ ] Diferenciar tarefa arquivada de concluída.
- [ ] Tratar período vazio, paginação e loading.
      **CA:** contagens batem com registros persistidos e não oscilam por re-fetch.

### Fase 3 — Pomodoro confiável

#### T-016 [P0] Modelar máquina de estados do foco

**Depende de:** T-007, T-003

- [ ] Definir estados `idle`, `running`, `paused`, `awaiting_confirmation`, `completed`, `cancelled`.
- [ ] Formalizar transições permitidas e regras de timestamp.
- [ ] Criar schema de sessão com duração planejada, pausas e idempotency key.
- [ ] Adicionar restrição de sessão ativa por usuário quando aplicável.
- [ ] Implementar cálculo puro de tempo restante a partir de timestamps.
- [ ] Testar travamentos, intervalos fora do foco e relógio local alterado.
      **CA:** estado recuperado após refresh corresponde ao estado persistido, sem XP indevido.

#### T-017 [P0] Implementar controles e persistência do timer

**Depende de:** T-016, T-009

- [ ] Criar operações start/pause/resume/cancel/confirm no servidor quando relevantes.
- [ ] Persistir início/fim previsto e alterações relevantes de estado.
- [ ] Renderizar segundos localmente sem enviar request por segundo.
- [ ] Restaurar sessão ativa ao entrar em outra rota ou reabrir o navegador.
- [ ] Resolver conflito entre duas abas/dispositivos e mostrar o estado verdadeiro.
- [ ] Solicitar confirmação ao terminar o tempo antes de marcar foco bem-sucedido.
      **CA:** timer continua temporalmente correto após aba em background e reload.

#### T-018 [P0] Criar tela de foco e UX de interrupções

**Depende de:** T-006, T-017

- [ ] Exibir duração, progresso, compromisso e ações prioritárias.
- [ ] Mostrar adversário e time de maneira secundária ao foco.
- [ ] Criar estados de pausa, interrupção, cancelamento e confirmação.
- [ ] Implementar feedback opcional de término; documentar limitações de alarmes web em background.
- [ ] Reduzir movimento e permitir ocultar elementos distraidores.
- [ ] Testar mobile com tela bloqueada, perda de rede e retorno tardio.
      **CA:** usuário entende o estado do foco e não precisa manter tela ativa para preservar horário.

#### T-019 [P0] Integrar conclusão de foco com evento único

**Depende de:** T-013, T-017

- [ ] Registrar conclusão apenas após validação do compromisso e confirmação.
- [ ] Associar sessão ao identificador da atividade/batalha.
- [ ] Garantir evento idempotente por sessão.
- [ ] Proibir reward em sessão cancelada ou ainda não confirmada.
- [ ] Testar requisição duplicada e desconexão após commit.
      **CA:** cada sessão elegível gera, no máximo, um evento confirmado.

#### T-020 [P1] Preferências, descanso e estatísticas de foco

**Depende de:** T-018, T-019

- [ ] Criar presets configuráveis com limites seguros de duração.
- [ ] Adicionar descanso curto/longo sem transformar pausa em obrigação.
- [ ] Exibir foco realizado por dia/semana e sessões confirmadas.
- [ ] Garantir timezone correto em gráficos e agrupamentos.
- [ ] Respeitar preferências de som e movimento reduzido.
- [ ] Testar mudança de duração entre sessões e resumo histórico.
      **CA:** configurações persistem entre dispositivos e métricas usam apenas sessões válidas.

### Fase 4 — Vertical slice de RPG e Pokémon

#### T-021 [P0] Criar motor puro de desafios e vitórias

**Depende de:** T-003, T-019

- [ ] Modelar tipos `Encounter`, `Commitment`, `PartySnapshot`, `BattleOutcome`.
- [ ] Implementar função determinística de dificuldade/elegibilidade.
- [ ] Expor compromissos viáveis antes do início, com limites de duração.
- [ ] Considerar força do time com regra auditável e sem surpresa negativa.
- [ ] Tratar atividade não concluída como retirada/derrota sem penalidade permanente.
- [ ] Testar matrizes de caso: iniciante, forte, tarefa difícil, sessão curta, ginásio.
      **CA:** cumprir um compromisso validado sempre produz vitória esperada; engine testável sem React.

#### T-022 [P0] Implementar transação segura de conclusão e recompensa

**Depende de:** T-013, T-019, T-021

- [ ] Criar migrations para batalhas, compromissos e ledger de recompensa.
- [ ] Escrever RPC/Edge Function validando conta, origem da ação e compromisso.
- [ ] Em uma transação, concluir resultado e inserir eventos de recompensa únicos.
- [ ] Restringir escrita direta em resultados/XP pela RLS e grants.
- [ ] Retornar resultado anterior quando houver retry com mesma idempotency key.
- [ ] Testar concorrência, falha parcial, refresh durante animação e operações forjadas.
      **CA:** progresso nunca fica parcialmente creditado e frontend não consegue criar XP arbitrário.

#### T-023 [P0] Construir encontro e batalha automática visual

**Depende de:** T-006, T-021, T-022

- [ ] Criar card pré-batalha com treinador, sprites, nível, equipe e compromisso.
- [ ] Criar sequência visual automática curta: encontro → ações simuladas → resultado.
- [ ] Mostrar recompensa e justificativa da vitória a partir de resultado salvo.
- [ ] Permitir **pular animação** e respeitar movimento reduzido.
- [ ] Não rodar animação ou cálculo de combate pesado durante foco.
- [ ] Tratar sprite indisponível, retry, tela pequena e reabertura de batalha já resolvida.
      **CA:** batalha concluída é visualmente interessante, mas nunca bloqueia produtividade nem credita XP duplicado.

#### T-024 [P1] Importar e armazenar catálogo Pokémon e sprites

**Depende de:** T-004, T-007

- [ ] Definir espécies necessárias para starter, primeiros encontros e primeiros NPCs.
- [ ] Criar script de importação versionado da PokéAPI com tratamento de rate limit/erro.
- [ ] Normalizar tipos, sprites, evolução, nomes e dados usados pelo jogo.
- [ ] Implementar cache/fallback e política de atualização do catálogo.
- [ ] Proibir fetch da PokéAPI em cada renderização ou troca de tela.
- [ ] Verificar atribuição e uso apropriado de assets e dados.
      **CA:** UI abre equipe e encontros com catálogo local mesmo se PokéAPI estiver indisponível.

#### T-025 [P1] Implementar captura, coleção, party e box

**Depende de:** T-022, T-024

- [ ] Criar `owned_pokemon`, `captures` e índices únicos por encontro quando adequado.
- [ ] Modelar captura como transação derivada de encontro elegível.
- [ ] Oferecer party de até seis e box sem limite arbitrário baixo.
- [ ] Implementar troca de equipe com validação de posição duplicada.
- [ ] Exibir detalhes, tipos, nível, XP e sprites com fallback.
- [ ] Testar simultaneidade entre duas abas, captura repetida, equipe cheia e troca de posição.
      **CA:** capturas e mudanças de equipe persistem corretamente e respeitam limite de seis.

#### T-026 [P1] Implementar nível, XP e evolução

**Depende de:** T-022, T-024, T-025

- [ ] Definir curva de XP versionada e distribuição entre Pokémon ativos.
- [ ] Aplicar XP no servidor a partir do ledger, nunca por mutação arbitrária do cliente.
- [ ] Implementar level-up em lote e suportar múltiplos níveis por recompensa.
- [ ] Mapear condições de evolução e alternativas explícitas a trocas/itens impossíveis.
- [ ] Criar fluxo de evolução visual que possa ser pulado e retomado.
- [ ] Testar limite de nível, evolução já realizada, múltiplas recompensas e idempotência.
      **CA:** níveis/evoluções correspondem a eventos persistidos e não divergem após reload.

#### T-027 [P1] Balancear recompensas e anti-exploração

**Depende de:** T-021, T-022, T-026

- [ ] Configurar pontos base de tarefa por dificuldade e Pomodoro por duração.
- [ ] Definir bônus de encontro e time com valores/tetos documentados.
- [ ] Validar que tarefa importante é mais recompensadora que foco simples, sem estimular fracionamento abusivo.
- [ ] Evitar que progresso na campanha exija aumento indefinido do tempo de foco.
- [ ] Criar testes de simulação de 7, 30 e 90 dias com perfis de uso realistas.
- [ ] Registrar versões de regras para facilitar ajustes sem corromper recompensas anteriores.
      **CA:** progressão é motivadora em cenários curtos e longos, sem penalidade por inatividade.

### Fase 5 — Jornada de Sinnoh

#### T-028 [P1] Criar sistema declarativo de campanha

**Depende de:** T-004, T-021, T-024

- [ ] Definir schema de regiões, rotas, encontros, NPCs, rivais, ginásios e pré-requisitos.
- [ ] Criar dados iniciais de Sinnoh com ordem de acontecimentos consistente.
- [ ] Implementar regras de desbloqueio no lado confiável.
- [ ] Desacoplar falas, sprites e encontros da engine.
- [ ] Fornecer validação de conteúdo para links quebrados e nós inacessíveis.
- [ ] Preparar seed versionado, permitindo novas regiões depois.
      **CA:** campanha progride por dados, sem `if/else` espalhados por componentes.

#### T-029 [P1] Implementar onboarding e seleção de starter

**Depende de:** T-025, T-028

- [ ] Criar introdução curta contextualizando a jornada sem bloquear o primeiro uso.
- [ ] Exibir Turtwig, Chimchar e Piplup com sprites e atributos resumidos.
- [ ] Persistir escolha como operação única, proibindo duplicação do starter.
- [ ] Montar time inicial automaticamente.
- [ ] Garantir que tarefas e foco continuem disponíveis mesmo antes da escolha, se necessário.
- [ ] Testar recarga, múltiplos cliques e tentativa de trocar starter após confirmação.
      **CA:** starter e progresso inicial persistem em outro dispositivo sem duplicatas.

#### T-030 [P1] Implementar encontros por rota e raridade

**Depende de:** T-024, T-025, T-028

- [ ] Definir tabelas de espécies por rota, faixas de nível e peso de aparição.
- [ ] Bloquear espécies lendárias/míticas antes dos marcos apropriados.
- [ ] Gerar encontro com identificador único persistido; não rerrolar ao atualizar a página.
- [ ] Separar encontros selvagens, treinadores e eventos de história.
- [ ] Integrar captura na conclusão da batalha e registrar encontro consumido.
- [ ] Testar distribuição de raridade e impossibilidade de encontro fora da região.
      **CA:** espécies encontradas correspondem às tabelas da rota e não mudam arbitrariamente no refresh.

#### T-031 [P1] Ginásios, insígnias e marcos narrativos

**Depende de:** T-022, T-028, T-030

- [ ] Criar marcos principais e condição de liberação dos ginásios.
- [ ] Exibir líderes, desafios e recompensa antes da ação.
- [ ] Creditar insígnia uma única vez, vinculada a vitória válida.
- [ ] Desbloquear próximo capítulo de modo transacional.
- [ ] Criar pequenas cenas narrativas e opção de pular/relê.
- [ ] Testar tentativa de pular ginásio, repetição de batalha e múltiplos dispositivos.
      **CA:** campanha e coleção de insígnias são consistentes e sobrevivem a falha de rede.

### Fase 6 — Dashboard, refinamento e performance

#### T-032 [P0] Dashboard integrado, rápido e responsivo

**Depende de:** T-012, T-018, T-023 (versão inicial pode usar equipe mockada até T-025)

- [ ] Mostrar tarefas prioritárias, criar tarefa, iniciar foco e próximo encontro.
- [ ] Mostrar resumo da equipe sem priorizar decoração sobre ações.
- [ ] Reutilizar dados em cache entre dashboard e páginas detalhadas.
- [ ] Atualizar contagens após mutações com invalidação seletiva.
- [ ] Definir skeletons leves e estados offline/erro.
- [ ] Testar 360 px, 768 px e desktop amplo, inclusive listas grandes.
      **CA:** home permite agir imediatamente e permanece responsiva com dados reais.

#### T-033 [P1] Aplicar design system e microinterações

**Depende de:** T-002, T-032

- [ ] Criar tokens de cores, tipografia, espaçamento, raios e sombras.
- [ ] Padronizar cards, modais, botões, formulários, badges e mensagens.
- [ ] Refinar sprites (escala pixelated) e cenas de batalha sem blur indevido.
- [ ] Aplicar Motion apenas onde melhora significado/feedback.
- [ ] Respeitar `prefers-reduced-motion` e opção de pular cenas.
- [ ] Executar revisão de contraste, hierarquia e consistência visual.
      **CA:** UI coesa e agradável sem prejudicar carregamento, acessibilidade ou legibilidade.

#### T-034 [P0] Corrigir gargalos de navegação e dados

**Depende de:** T-009, T-032

- [ ] Medir clique → shell, shell → conteúdo e requisições por rota em build de produção.
- [ ] Inspecionar waterfall de requests e eliminar dependências sequenciais desnecessárias.
- [ ] Ajustar TanStack Query: cache, stale times, prefetch restrito e invalidations.
- [ ] Evitar renderização de listas grandes sem necessidade; analisar memoização com profiler.
- [ ] Otimizar bundle por rota, imagens e sprites críticos.
- [ ] Comparar primeira visita e revisita em celular real/DevTools throttling.
      **CA:** revisitas usam cache e não mostram loading de vários segundos por consultas redundantes; registrar métricas antes/depois.

#### T-035 [P1] Histórico, painel de conquistas e preferências

**Depende de:** T-015, T-020, T-026, T-031

- [ ] Unificar atividades e recompensas em timeline consistente.
- [ ] Mostrar tempo focado, tarefas concluídas, XP, time e insígnias.
- [ ] Permitir filtrar histórico sem múltiplos fetches pesados.
- [ ] Criar configurações simples para timers, áudio, motion e timezone.
- [ ] Evitar “streak” punitiva como métrica principal.
- [ ] Testar contagens e agrupamentos por data após virada de dia.
      **CA:** todos os números reconciliam com registros de origem e não punem ausência.

### Fase 7 — Robustez, segurança e lançamento

#### T-036 [P0] Testes unitários de domínio e integração

**Depende de:** T-013, T-019, T-022

- [ ] Cobrir regras de tarefas, idempotência, timers e transições de estado.
- [ ] Cobrir motor de compromisso/vitória com tabela de casos e snapshots apenas onde útil.
- [ ] Testar RPC/transações reais em ambiente de teste e políticas RLS.
- [ ] Cobrir reabrir tarefa, sessão abortada, time alterado e retry após falha.
- [ ] Usar fixtures determinísticas para RNG permitido em encontros/capturas.
- [ ] Medir cobertura dos domínios críticos, não perseguir cobertura artificial de UI.
      **CA:** mudanças nas regras de produtividade/recompensa quebram teste antes de corromper dados.

#### T-037 [P0] E2E dos fluxos essenciais

**Depende de:** T-032, T-036

- [ ] E2E: login autorizado → dashboard → criar tarefa → concluir → ver persistência.
- [ ] E2E: iniciar Pomodoro → concluir → confirmar → batalha → recompensa única.
- [ ] E2E: recarregar durante foco e recuperar o cronômetro.
- [ ] E2E: simular erro de rede e retry sem XP duplicado.
- [ ] E2E: navegar tarefas/equipe/dashboard sem full reload nem dados inconsistentes.
- [ ] E2E: testar layout e controles em viewport mobile.
      **CA:** cenários críticos passam em ambiente reprodutível antes de publicar.

#### T-038 [P0] Auditoria de segurança e privacidade

**Depende de:** T-008, T-022

- [ ] Testar todas as tabelas com usuário anônimo e UID não autorizado.
- [ ] Auditar grants de RPC/Edge Functions e `SECURITY DEFINER`.
- [ ] Confirmar que somente backend confiável concede XP, capturas, níveis e insígnias.
- [ ] Verificar segredos em variáveis, source maps, logs e Git histórico.
- [ ] Revisar XSS em textos do usuário e tratamento de conteúdo externo.
- [ ] Documentar recuperação de conta, revogação de sessões e estratégia de backup.
      **CA:** sem caminho óbvio de leitura privada ou mutação de progresso por API pública.

#### T-039 [P0] Preparar deploy e ambientes

**Depende de:** T-037, T-038

- [ ] Configurar hospedagem Vercel para SPA com fallback de rotas (refresh em URL profunda).
- [ ] Configurar URLs/domínios de autenticação e variáveis por ambiente.
- [ ] Aplicar migrations de produção via processo versionado e revisável.
- [ ] Validar CORS/configuração de integrações e não expor chaves privilegiadas.
- [ ] Criar smoke test pós-deploy (login, tarefa, foco, leitura do banco).
- [ ] Documentar rollback de frontend e migrações seguras (forward fix quando necessário).
      **CA:** aplicativo abre por URL direta no computador e no celular, com sessão e dados íntegros.

#### T-040 [P1] Exportação e recuperação dos dados

**Depende de:** T-039

- [ ] Criar exportação JSON abrangendo tarefas, recorrências, sessões, eventos e progresso.
- [ ] Oferecer CSV para tarefas e sessões, com escape correto de campos.
- [ ] Garantir que exportação é restrita à conta autorizada.
- [ ] Documentar processo seguro de backup e restore testado em ambiente separado.
- [ ] Testar versão de esquema e migração futura do formato exportado.
      **CA:** usuário consegue guardar cópia legível dos próprios dados e restaurar com procedimento documentado.

#### T-041 [P1] Testes reais de usabilidade, performance e acessibilidade

**Depende de:** T-039

- [ ] Usar o aplicativo por dias em desktop e celular com tarefas reais.
- [ ] Medir latência real de primeira carga e retorno às telas, inclusive rede lenta.
- [ ] Verificar toque, teclado, leitores de tela básicos e motion reduzido.
- [ ] Testar ausência de rede, aba suspensa, timer longo e troca de dispositivo.
- [ ] Registrar bugs por severidade e corrigir bloqueantes antes do uso diário.
- [ ] Ajustar fluxo de cadastro de tarefa se gerar atrito desnecessário.
      **CA:** a experiência é confiável para uso diário, não apenas para uma demonstração.

### Fase 8 — Melhorias posteriores, não bloquear o MVP

#### T-042 [P2] Eventos especiais e campanhas adicionais

**Depende de:** T-028, T-031

- [ ] Planejar nova região como pacote de dados isolado.
- [ ] Criar migração de campanha sem resetar histórico.
- [ ] Versionar tabelas de encontro e recompensas.
- [ ] Testar conteúdo novo sem regressão em Sinnoh.
      **CA:** adicionar região sem alterar lógica central nem recompensar marcos repetidos.

#### T-043 [P2] Ajuste fino de narrativa e batalhas

**Depende de:** T-023, T-031

- [ ] Criar variações curtas de texto por oponente e fase da história.
- [ ] Animar entrada, confronto e resultado sem impedir pular.
- [ ] Medir impacto de animações no carregamento e FPS no celular.
- [ ] Testar fallback de assets e desligamento de efeitos.
      **CA:** mais imersão visual sem degradar produtividade ou performance.

#### T-044 [P2] Aprimorar descoberta e estratégias de equipe

**Depende de:** T-025, T-027, T-030

- [ ] Adicionar filtros no box por tipo/nível/espécie.
- [ ] Exibir impacto do time na dificuldade prevista do encontro.
- [ ] Balancear raridade e curva de XP com simulações reproduzíveis.
- [ ] Preservar vitória previsível e inexistência de punição por ausência.
      **CA:** escolhas de time acrescentam estratégia sem virar necessidade de grind.

---

## 9. Ordem de implementação recomendada e marcos de entrega

> **Não construir fase inteira em isolamento:** é melhor entregar uma fatia completa utilizável do que todas as telas com dados mockados.

| Marco                       | Entrega real                                                      | Tarefas principais              |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| **M0 — Base segura**        | Login privado, rotas e banco reproduzível                         | 001–010                         |
| **M1 — Produtividade real** | Criar/concluir tarefas com persistência, sem RPG obrigatório      | 011–013, 012                    |
| **M2 — Foco confiável**     | Pomodoro com recuperação após refresh e confirmação               | 016–019                         |
| **M3 — Primeira vitória**   | Uma batalha automática, um compromisso e XP transacional          | 021–023, 032                    |
| **M4 — Primeiro Pokémon**   | Starter, captura, time e evolução                                 | 024–026, 029–030                |
| **M5 — Primeira jornada**   | História estruturada, primeiro líder e insígnia                   | 027–028, 031                    |
| **M6 — Produto confiável**  | Testes, performance, segurança e publicação                       | 034, 036–039                    |
| **M7 — Polimento**          | Recorrências, histórico, configurações, exportação e refinamentos | 014–015, 020, 033, 035, 040–041 |

**MVP prático recomendado:** lançar para uso pessoal até M3 com uma equipe inicial simples e um primeiro encontro. Não esperar a Pokédex toda nem a campanha inteira para começar a usar tarefas e Pomodoro.

---

## 10. Matriz de aceitação ponta a ponta

1. **Tarefa simples:** criar “Estudar cálculo” → dificuldade 3 → concluir → ver status correto após refresh e em outro dispositivo → creditar no máximo uma recompensa.
2. **Foco real:** selecionar 30 min → visualizar treinador/equipe/condição antes de iniciar → mudar de aba → voltar → confirmar conclusão → assistir/pular batalha → ganhar XP uma única vez.
3. **Interrupção:** começar 45 min → cancelar aos 12 → nenhuma vitória nem XP de conclusão; sem perder progresso anterior.
4. **Batalha previsível:** compromisso indicado como suficiente → atividade validada → vitória; time afeta estratégia/bônus de forma explícita, sem derrota aleatória.
5. **Captura:** explorar rota inicial → encontrar espécie permitida → cumprir condição → capturar → aparecer no time ou box → manter estado após refresh.
6. **Ginásio:** desbloquear líder conforme história → cumprir desafio → insígnia única → próximo capítulo liberado; retry não duplica recompensa.
7. **Segurança:** usuário anônimo ou não autorizado tenta chamar API diretamente → negado, inclusive funções de XP.
8. **Performance:** revisitar Tarefas/Equipe/Dashboard → exibir cache rapidamente e atualizar em fundo; sem tela travada por fetch sequencial.
9. **Multi-dispositivo:** alterar uma tarefa no PC → abrir celular → refletir alteração; conflitos de Pomodoro tratados sem duas recompensas.
10. **Resiliência:** falha de rede após registrar vitória → reabrir → estado final correto e sem recompensa duplicada.

---

## 11. Definition of Done (DoD) global

Uma tarefa só pode ser marcada **concluída** quando:

- [ ] O código atende ao RF/RNF e aos critérios de aceite descritos.
- [ ] Está tipado, formatado e passa lint/typecheck/build.
- [ ] Regras de negócio críticas possuem testes unitários/integrados; fluxo alterado possui E2E quando aplicável.
- [ ] Estados de loading, erro, vazio e retry foram considerados.
- [ ] Está responsivo e acessível, sem bloqueio por animação.
- [ ] Segurança/RLS e autorização foram verificadas quando houve mudança de dados.
- [ ] Migrations e seeds são reproduzíveis quando houver mudança de schema.
- [ ] Não há segredos no repositório, nem chamadas externas desnecessárias por navegação.
- [ ] Documentação/decisões pertinentes foram atualizadas.
- [ ] Critério de aceite foi verificado com evidência objetiva (teste, screenshot ou passo manual registrado).

---

## 12. Instruções operacionais para o Claude Code

1. **Leia integralmente** `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` e `docs/GAME_RULES.md` antes de alterar código relevante.
2. **Antes de cada tarefa**, descreva plano curto, arquivos afetados, dependências, riscos e critério de aceite.
3. Execute **uma tarefa ou fatia pequena por vez**; não implemente backlog inteiro em uma única mudança.
4. Prefira código simples, tipagem explícita, funções de domínio puras, contratos claros e abstrações justificadas.
5. Não introduza Next.js, Prisma, Express ou outras tecnologias sem necessidade e aprovação de uma mudança arquitetural.
6. Não invente regras do RPG: leia a configuração; se faltar regra, registre proposta e solicite validação quando a escolha mudar o produto.
7. Toda recompensa deve decorrer de evento de atividade válido e processamento transacional/idempotente no servidor.
8. Antes de marcar checklist, **rode** os testes pertinentes e inspecione resultado; não marque itens por suposição.
9. Ao concluir, entregue resumo dos arquivos alterados, migrations, testes executados, riscos restantes e próxima tarefa recomendada.
10. Se o app ficar visualmente impressionante, mas lento ou difícil de registrar tarefas, a implementação **não está pronta**.

---

## 13. Riscos e decisões que merecem atenção

| Risco                                                 | Mitigação                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Projetar RPG demais antes de existir lista utilizável | Fatiar M1/M2 antes de conteúdo extenso                                              |
| Perder produtividade com animação longa               | Batalha curta, skippable, execução após ação                                        |
| Premiar foco sem foco real                            | Confirmação + timestamp + estados claros; honestidade do usuário é parte do sistema |
| Duplicar XP após retry/conflito de abas               | Ledger, transações, idempotency keys, índices únicos                                |
| Interface lenta como apps anteriores                  | SPA com cache, prefetch pontual, medições em produção e assets locais               |
| Expor banco/progresso pela API pública                | RLS, conta autorizada, grants seguros, nenhuma escrita privilegiada no cliente      |
| PokéAPI fora do ar ou sprites faltando                | Importador/cache, fallback e catálogo local                                         |
| História/conteúdo crescer sem controle                | Dados versionados e módulos, não condições espalhadas                               |
| Ganhar pouco por tarefa e incentivar só timer         | Fórmula configurável, testes de balanceamento e simulações                          |
| Confundir propriedade intelectual com uso privado     | Avaliar licenças e evitar distribuição pública de assets/textos protegidos          |

## 14. Perguntas de produto para fechar futuramente

Estas questões **não impedem iniciar T-001 a T-020**:

1. Captura automática ao vencer encontro selvagem, ou confirmação de captura com chance indicada?
2. Como escolher tarefa versus Pomodoro em um compromisso de batalha sem adicionar burocracia?
3. O time muda o **mínimo necessário**, o bônus de XP, ou ambos?
4. Qual cadência ideal dos marcos de Sinnoh (ações até o primeiro líder e entre ginásios)?
5. Evolução acontece automaticamente ou apresenta opção de adiar?
6. Tarefas concluídas sem batalha geram XP padrão, e batalhas apenas acrescentam bônus?

**Orientação inicial:** manter decisões abertas como parâmetros, testar o loop real de produtividade primeiro e ajustar o RPG com base no uso cotidiano.
