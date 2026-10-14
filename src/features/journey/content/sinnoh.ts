import type { CampaignNodeContent, CampaignRegionContent } from './schema.ts'
import { SINNOH_WILD } from './sinnoh-wild.ts'

// The whole Pokémon Platinum storyline, in the games' order: eight badges, the Team
// Galactic arc, the Distortion World, the Pokémon League and the Stark Mountain
// post-game. Place and character names follow the games; every summary is original
// text. After editing, bump `contentVersion`, run `npm run campaign:seed` and put the
// output in a new migration. Never rename an id that already shipped — player progress
// is keyed by it.

type Difficulty = 1 | 2 | 3 | 4 | 5
type Step = Omit<CampaignNodeContent, 'requires'>

const id = (slug: string) => `sinnoh.${slug}`

function route(
  slug: string,
  title: string,
  summary: string,
  difficulty: Difficulty,
  requiredVictories: number,
  encounterKind: 'wild' | 'trainer' = 'wild',
): Step {
  return {
    id: id(slug),
    kind: 'route',
    title,
    summary,
    encounter: { kind: encounterKind, difficulty },
    requiredVictories,
    repeatable: true,
    // A wild route without a table is caught by validateCampaignRegion.
    ...(encounterKind === 'wild' ? { wildEncounters: SINNOH_WILD[slug] ?? [] } : {}),
  }
}

/** A one-off story beat with nobody to fight: a town, a discovery, a legendary. */
function story(slug: string, title: string, summary: string, difficulty: Difficulty): Step {
  return {
    id: id(slug),
    kind: 'story',
    title,
    summary,
    encounter: { kind: 'milestone', difficulty },
    requiredVictories: 1,
    repeatable: false,
  }
}

/** A story battle against trainers (Team Galactic, the Elite Four...). */
function showdown(
  slug: string,
  title: string,
  summary: string,
  difficulty: Difficulty,
  npcName?: string,
  requiredVictories = 1,
): Step {
  return {
    id: id(slug),
    kind: 'story',
    title,
    summary,
    ...(npcName ? { npcName } : {}),
    encounter: { kind: 'trainer', difficulty },
    requiredVictories,
    repeatable: false,
  }
}

function rival(slug: string, title: string, summary: string, difficulty: Difficulty): Step {
  return {
    id: id(slug),
    kind: 'rival',
    title,
    summary,
    npcName: 'Barry',
    encounter: { kind: 'rival', difficulty },
    requiredVictories: 1,
    repeatable: false,
  }
}

function gym(
  slug: string,
  title: string,
  summary: string,
  difficulty: Difficulty,
  npcName: string,
): Step {
  return {
    id: id(slug),
    kind: 'gym',
    title,
    summary,
    npcName,
    encounter: { kind: 'gymLeader', difficulty },
    requiredVictories: 1,
    repeatable: false,
  }
}

/** The story is linear: each step requires the one before it. */
function chain(steps: Step[]): CampaignNodeContent[] {
  return steps.map((step, index) => {
    const previous = steps[index - 1]
    return { ...step, requires: previous ? [previous.id] : [] }
  })
}

export const sinnoh: CampaignRegionContent = {
  id: 'sinnoh',
  name: 'Sinnoh',
  contentVersion: 3,
  nodes: chain([
    // --- Capítulo 1: primeiros passos e a Insígnia do Carvão ---
    story(
      'twinleaf-town',
      'Twinleaf Town',
      'Sua jornada começa em casa. Dê o primeiro passo para sair da cidade.',
      1,
    ),
    route(
      'route-201',
      'Rota 201',
      'Grama alta e os primeiros Pokémon selvagens no caminho para Sandgem.',
      1,
      3,
    ),
    rival(
      'rival-route-201',
      'Primeiro duelo com o rival',
      'Barry está sempre com pressa — e quer testar o Pokémon dele contra o seu.',
      2,
    ),
    story(
      'lake-verity',
      'Lake Verity',
      'Na beira do lago, um homem de olhar frio fala sozinho sobre tempo e espaço.',
      1,
    ),
    story(
      'sandgem-town',
      'Sandgem Town',
      'O Professor Rowan confia a você a Pokédex e uma tarefa: registrar toda Sinnoh.',
      1,
    ),
    route(
      'route-202',
      'Rota 202',
      'O caminho até Jubilife, cheio de treinadores iniciantes e Pokémon novos.',
      1,
      3,
    ),
    showdown(
      'jubilife-city',
      'Jubilife City',
      'A maior cidade até aqui. Os alunos da Escola de Treinadores querem batalhar.',
      1,
      undefined,
      2,
    ),
    rival(
      'rival-route-203',
      'Revanche na Rota 203',
      'Barry treinou desde o último encontro e bloqueia o caminho para Oreburgh.',
      2,
    ),
    route(
      'oreburgh-gate',
      'Oreburgh Gate',
      'Uma caverna curta separa você da cidade mineradora de Oreburgh.',
      1,
      2,
    ),
    route(
      'oreburgh-mine',
      'Oreburgh Mine',
      'O líder do ginásio não está no ginásio: está no fundo da mina, cavando.',
      2,
      2,
    ),
    gym(
      'oreburgh-gym',
      'Ginásio de Oreburgh',
      'Roark, especialista em Pokémon de pedra, guarda a primeira insígnia de Sinnoh.',
      3,
      'Roark',
    ),

    // --- Capítulo 2: a Equipe Galáctica aparece e a Insígnia da Floresta ---
    showdown(
      'jubilife-galactic',
      'Emboscada em Jubilife',
      'Dois capangas de uniforme prateado cercam o Professor Rowan. Hora de ajudar.',
      2,
    ),
    route(
      'route-204',
      'Rota 204',
      'Campos floridos ao norte de Jubilife, cortados por um paredão de pedra.',
      2,
      3,
    ),
    route(
      'ravaged-path',
      'Ravaged Path',
      'Um túnel estreito e úmido atravessa o paredão da Rota 204.',
      2,
      2,
    ),
    story(
      'floaroma-town',
      'Floaroma Town',
      'A cidade das flores. Uma menina pede ajuda: o pai dela está preso na usina.',
      1,
    ),
    showdown(
      'valley-windworks',
      'Valley Windworks',
      'A Equipe Galáctica tomou a usina eólica. A comandante Mars não pretende sair.',
      3,
      'Mars',
    ),
    route(
      'route-205',
      'Rota 205',
      'Pontes de madeira e pescadores no caminho para a floresta de Eterna.',
      2,
      3,
    ),
    route(
      'eterna-forest',
      'Eterna Forest',
      'Uma floresta densa e fácil de se perder. Cheryl pede companhia até a saída.',
      2,
      3,
    ),
    story(
      'eterna-city',
      'Eterna City',
      'Uma cidade antiga, com uma estátua gasta de um Pokémon que ninguém sabe nomear.',
      2,
    ),
    gym(
      'eterna-gym',
      'Ginásio de Eterna',
      'Gardenia cuida de um ginásio que parece um jardim — e os Pokémon de planta dela mordem.',
      3,
      'Gardenia',
    ),
    showdown(
      'galactic-eterna-building',
      'Prédio Galáctico de Eterna',
      'O prédio estranho ao norte da cidade esconde Pokémon roubados e a comandante Jupiter.',
      3,
      'Jupiter',
    ),

    // --- Capítulo 3: Monte Coronet e a Insígnia da Relíquia ---
    route(
      'route-206',
      'Rota 206 — Cycling Road',
      'Uma ladeira longa de bicicleta, com ciclistas querendo batalhar o tempo todo.',
      2,
      3,
      'trainer',
    ),
    route(
      'wayward-cave',
      'Wayward Cave',
      'Uma caverna escura sob a Cycling Road, onde é fácil perder o rumo.',
      2,
      2,
    ),
    route('route-207', 'Rota 207', 'Encostas de terra solta ao pé do Monte Coronet.', 2, 2),
    story(
      'mt-coronet-south',
      'Mt. Coronet',
      'Dentro da montanha, o homem do lago reaparece e fala da origem do mundo.',
      2,
    ),
    route(
      'route-208',
      'Rota 208',
      'Pontes sobre o desfiladeiro e, do outro lado, as luzes de Hearthome.',
      3,
      3,
    ),
    story(
      'hearthome-city',
      'Hearthome City',
      'Cidade de concursos e parques. A líder do ginásio também é estrela dos palcos.',
      2,
    ),
    gym(
      'hearthome-gym',
      'Ginásio de Hearthome',
      'Fantina e seus Pokémon fantasmas transformam a batalha em espetáculo.',
      3,
      'Fantina',
    ),
    rival(
      'rival-hearthome',
      'Barry em Hearthome',
      'Mal você sai do ginásio, Barry esbarra em você exigindo uma batalha.',
      3,
    ),

    // --- Capítulo 4: rumo ao leste e a Insígnia do Seixo ---
    route(
      'route-209',
      'Rota 209',
      'Um rio calmo, uma torre de pedra ao longe e muitos treinadores no caminho.',
      3,
      3,
    ),
    route(
      'lost-tower',
      'Lost Tower',
      'Uma torre silenciosa onde treinadores vêm se despedir de seus Pokémon.',
      3,
      2,
      'trainer',
    ),
    story(
      'solaceon-town',
      'Solaceon Town',
      'Uma vila tranquila com ruínas cobertas de símbolos que parecem letras.',
      2,
    ),
    route(
      'route-210-south',
      'Rota 210 — Sul',
      'Capim alto até um café de beira de estrada. Um bando de Psyduck trava a passagem norte.',
      3,
      2,
    ),
    route(
      'route-215',
      'Rota 215',
      'Chove sem parar nesta rota, e os lutadores que treinam nela não se importam.',
      3,
      3,
      'trainer',
    ),
    story(
      'veilstone-city',
      'Veilstone City',
      'Cidade erguida na rocha, com meteoritos antigos e um prédio enorme da Equipe Galáctica.',
      2,
    ),
    gym(
      'veilstone-gym',
      'Ginásio de Veilstone',
      'Maylene luta descalça e treina mais do que qualquer um. Os Pokémon lutadores dela também.',
      4,
      'Maylene',
    ),
    showdown(
      'galactic-warehouse',
      'Armazém Galáctico',
      'Capangas roubaram a Pokédex do assistente do professor. Vocês dois vão buscá-la.',
      3,
    ),

    // --- Capítulo 5: os pântanos e a Insígnia do Brejo ---
    route(
      'route-214',
      'Rota 214',
      'Uma estrada cercada de mato que desce em direção ao Lago Valor.',
      3,
      3,
    ),
    story(
      'valor-lakefront',
      'Valor Lakefront',
      'A entrada do lago está bloqueada. Há um hotel de luxo e pouca explicação.',
      3,
    ),
    route('route-213', 'Rota 213', 'Praia, mar aberto e nadadores prontos para uma batalha.', 3, 2),
    route(
      'great-marsh',
      'Great Marsh de Pastoria',
      'Um pântano enorme onde vivem Pokémon que não aparecem em nenhum outro lugar.',
      3,
      3,
    ),
    gym(
      'pastoria-gym',
      'Ginásio de Pastoria',
      'Crasher Wake é lutador mascarado, barulhento e mestre dos Pokémon de água.',
      4,
      'Crasher Wake',
    ),
    rival(
      'rival-pastoria',
      'Barry em Pastoria',
      'Barry quer provar que a insígnia dele vale mais do que a sua.',
      3,
    ),
    showdown(
      'galactic-chase',
      'Perseguição até o lago',
      'Um capanga foge de Pastoria falando em bomba. Você o alcança em Valor Lakefront.',
      3,
    ),
    route(
      'route-212',
      'Rota 212',
      'Lama, chuva e, no fim, os jardins de uma mansão cheia de troféus.',
      3,
      3,
    ),
    route(
      'route-210-north',
      'Rota 210 — Norte',
      'Com os Psyduck curados pelo remédio de Cynthia, resta atravessar a neblina.',
      4,
      3,
    ),
    showdown(
      'celestic-town',
      'Celestic Town',
      'Nas ruínas da vila mais antiga de Sinnoh, o chefe da Equipe Galáctica finalmente se apresenta.',
      4,
      'Cyrus',
    ),

    // --- Capítulo 6: a costa oeste e a Insígnia da Mina ---
    route(
      'fuego-ironworks',
      'Fuego Ironworks',
      'Uma siderúrgica escondida rio abaixo, quente o bastante para atrair Pokémon de fogo.',
      3,
      2,
    ),
    route(
      'route-218',
      'Rota 218',
      'Agora dá para atravessar a água a oeste de Jubilife e chegar ao porto.',
      4,
      2,
    ),
    story(
      'canalave-city',
      'Canalave City',
      'Cidade portuária dividida por um canal, com a maior biblioteca de Sinnoh.',
      3,
    ),
    rival(
      'rival-canalave',
      'Barry na ponte de Canalave',
      'Barry espera no meio da ponte. Ninguém passa sem batalhar.',
      4,
    ),
    gym(
      'canalave-gym',
      'Ginásio de Canalave',
      'Byron, pai de Roark, defende o ginásio com uma muralha de Pokémon de aço.',
      4,
      'Byron',
    ),
    route(
      'iron-island',
      'Iron Island',
      'Uma mina abandonada no mar. Riley treina ali e aceita companhia.',
      4,
      3,
      'trainer',
    ),
    story(
      'canalave-library',
      'Biblioteca de Canalave',
      'Entre lendas sobre os três lagos, o chão treme. Algo explodiu no Lago Valor.',
      3,
    ),

    // --- Capítulo 7: os três lagos e a Insígnia do Gelo ---
    showdown(
      'lake-valor',
      'Lake Valor',
      'O lago foi drenado pela explosão. O comandante Saturn ficou para garantir o serviço.',
      4,
      'Saturn',
    ),
    showdown(
      'lake-verity-galactic',
      'Retorno ao Lake Verity',
      'A Equipe Galáctica chegou ao lago perto de casa. Mars quer revanche.',
      4,
      'Mars',
    ),
    route(
      'route-211',
      'Rota 211',
      'Uma trilha de montanha que leva de Eterna de volta ao Monte Coronet.',
      4,
      2,
    ),
    route(
      'mt-coronet-north',
      'Mt. Coronet — travessia norte',
      'Túneis gelados cortam a montanha até o extremo norte de Sinnoh.',
      4,
      3,
    ),
    route('route-216', 'Rota 216', 'Neve até o joelho e Pokémon que só vivem no frio.', 4, 3),
    route(
      'route-217',
      'Rota 217',
      'Uma nevasca permanente. Mal dá para ver a cabana no meio do caminho.',
      4,
      3,
    ),
    story(
      'acuity-lakefront',
      'Acuity Lakefront',
      'A margem do terceiro lago está vigiada. Por enquanto, só resta seguir para a cidade.',
      3,
    ),
    story(
      'snowpoint-city',
      'Snowpoint City',
      'A cidade mais ao norte de Sinnoh, com um templo antigo fechado a visitantes.',
      3,
    ),
    gym(
      'snowpoint-gym',
      'Ginásio de Snowpoint',
      'Candice é pura concentração, e os Pokémon de gelo dela não dão espaço para erro.',
      5,
      'Candice',
    ),
    story(
      'lake-acuity',
      'Lake Acuity',
      'Você chega tarde: Jupiter já levou o guardião do lago e deixou Barry derrotado.',
      4,
    ),

    // --- Capítulo 8: o plano da Equipe Galáctica ---
    showdown(
      'galactic-hq',
      'Sede Galáctica em Veilstone',
      'Corredores, teleportes e capangas em cada sala do quartel-general.',
      4,
      undefined,
      3,
    ),
    showdown(
      'galactic-hq-cyrus',
      'O escritório de Cyrus',
      'Cyrus explica com calma o mundo que pretende criar — e testa você pessoalmente.',
      5,
      'Cyrus',
    ),
    showdown(
      'galactic-hq-saturn',
      'Laboratório Galáctico',
      'Os três guardiões dos lagos estão presos nas máquinas. Saturn guarda a sala.',
      5,
      'Saturn',
    ),
    route(
      'mt-coronet-summit',
      'Mt. Coronet — subida ao cume',
      'Neve, cachoeiras e paredões até o ponto mais alto de Sinnoh.',
      4,
      3,
    ),
    showdown(
      'spear-pillar',
      'Spear Pillar',
      'Entre as colunas do cume, Mars e Jupiter barram o caminho. Barry luta ao seu lado.',
      5,
      'Mars e Jupiter',
    ),
    story(
      'distortion-world',
      'Distortion World',
      'Um mundo ao avesso, onde o chão flutua e a gravidade muda de direção.',
      5,
    ),
    showdown(
      'distortion-world-cyrus',
      'Cyrus no Distortion World',
      'Sem mais ninguém entre vocês, Cyrus defende seu mundo sem emoções pela última vez.',
      5,
      'Cyrus',
    ),
    story(
      'giratina',
      'Giratina',
      'O Pokémon que governa o mundo distorcido avança, furioso com a invasão.',
      5,
    ),
    story(
      'sendoff-spring',
      'Sendoff Spring',
      'De volta ao mundo real, num lago escondido que ninguém sabia que existia.',
      3,
    ),

    // --- Capítulo 9: a Insígnia do Farol e a Liga Pokémon ---
    route('route-222', 'Rota 222', 'Praia e pescadores no trecho final até a cidade do sol.', 4, 3),
    story(
      'sunyshore-city',
      'Sunyshore City',
      'Passarelas solares cobrem a cidade. O líder, entediado, observa tudo do farol.',
      4,
    ),
    gym(
      'sunyshore-gym',
      'Ginásio de Sunyshore',
      'Volkner, o líder mais forte de Sinnoh, só quer um desafiante que valha a pena.',
      5,
      'Volkner',
    ),
    route(
      'route-223',
      'Rota 223',
      'Mar aberto ao norte de Sunyshore, cheio de nadadores e rochedos.',
      4,
      3,
      'trainer',
    ),
    route(
      'victory-road',
      'Victory Road',
      'A última caverna antes da Liga, reservada a quem tem as oito insígnias.',
      5,
      4,
    ),
    rival(
      'rival-pokemon-league',
      'Barry na Liga Pokémon',
      'Barry chegou primeiro, claro. Um último duelo antes da Elite dos Quatro.',
      5,
    ),
    showdown(
      'elite-four-aaron',
      'Elite dos Quatro — Aaron',
      'O primeiro da Elite cresceu entre Pokémon inseto e os leva muito a sério.',
      5,
      'Aaron',
    ),
    showdown(
      'elite-four-bertha',
      'Elite dos Quatro — Bertha',
      'Uma senhora gentil cujos Pokémon de terra não têm nada de gentis.',
      5,
      'Bertha',
    ),
    showdown(
      'elite-four-flint',
      'Elite dos Quatro — Flint',
      'Flint luta como fala: alto, quente e sem pausa.',
      5,
      'Flint',
    ),
    showdown(
      'elite-four-lucian',
      'Elite dos Quatro — Lucian',
      'Lucian fecha o livro que estava lendo. Os Pokémon psíquicos dele já sabem o que fazer.',
      5,
      'Lucian',
    ),
    showdown(
      'champion-cynthia',
      'Campeã Cynthia',
      'Ela ajudou você durante toda a jornada. Agora é o último obstáculo dela.',
      5,
      'Cynthia',
    ),

    // --- Pós-jogo: a ilha do nordeste e Stark Mountain ---
    showdown(
      'fight-area',
      'Fight Area',
      'Mal o barco atraca, Barry puxa você para uma batalha em dupla contra Flint e Volkner.',
      5,
      'Flint e Volkner',
    ),
    route(
      'route-225',
      'Rota 225',
      'Trilhas íngremes e treinadores veteranos na ilha do nordeste.',
      5,
      3,
    ),
    story(
      'survival-area',
      'Survival Area',
      'Um acampamento de treinadores durões. Buck fala de um tesouro no vulcão.',
      4,
    ),
    route(
      'route-227',
      'Rota 227',
      'Cinzas caem do céu no caminho que sobe até Stark Mountain.',
      5,
      3,
    ),
    route(
      'stark-mountain',
      'Stark Mountain',
      'Lava, rochas soltas e Pokémon fortes no interior do vulcão. Buck vai junto.',
      5,
      3,
    ),
    showdown(
      'stark-mountain-galactic',
      'O que restou da Equipe Galáctica',
      'Charon quer despertar o vulcão. Mars e Jupiter o acompanham pela última vez.',
      5,
      'Mars e Jupiter',
    ),
    story('heatran', 'Heatran', 'No fundo da cratera, o Pokémon do vulcão acorda.', 5),
    route(
      'route-229',
      'Rota 229',
      'Mata fechada e treinadores de elite a caminho da Resort Area.',
      5,
      3,
    ),
    story('resort-area', 'Resort Area', 'Vilas à beira-mar e, enfim, um lugar para descansar.', 3),
    rival(
      'rival-survival-area',
      'Barry, mais uma vez',
      'Barry agora treina todo fim de semana na Survival Area e nunca recusa uma revanche.',
      5,
    ),
    story(
      'lake-guardians',
      'Os guardiões dos lagos',
      'Uxie, Mesprit e Azelf voltaram para casa. Cada um aceita um último encontro.',
      5,
    ),
    story(
      'spear-pillar-legends',
      'Dialga e Palkia',
      'De volta ao cume, com as orbes certas, os senhores do tempo e do espaço respondem.',
      5,
    ),
  ]),
}
