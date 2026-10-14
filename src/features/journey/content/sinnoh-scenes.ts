import type { SceneContent } from './schema.ts'

// Short scenes for Sinnoh's main story beats, keyed by node slug: `intro` plays before
// the encounter, `outro` after the node is completed. All original text — the events
// follow Pokémon Platinum, the lines do not quote it.

export const SINNOH_SCENES: Record<string, SceneContent> = {
  'twinleaf-town': {
    intro: [
      'A televisão fala de um Pokémon vermelho visto num lago distante.',
      'Barry entra correndo: "Vamos pro lago! Quem chegar por último paga multa!"',
    ],
    outro: ['A porta de casa fica para trás. A Rota 201 começa logo ali.'],
  },
  'rival-route-201': {
    intro: [
      'Barry: "Agora que cada um tem um Pokémon, só existe uma coisa a fazer."',
      'Barry: "Batalha! Agora! Sem enrolar!"',
    ],
    outro: ['Barry: "Tá, essa não valeu. Vou treinar e você vai ver!"'],
  },
  'lake-verity': {
    intro: [
      'Um homem de cabelo azul encara a água sem piscar.',
      '"O tempo flui. O espaço se expande. Um dia, ambos serão meus."',
    ],
    outro: ['Ele passa por você sem dizer mais nada.'],
  },
  'sandgem-town': {
    intro: [
      'Professor Rowan: "Vejo que você e seu Pokémon já se entendem."',
      'Professor Rowan: "Leve esta Pokédex. Quero que ela conheça toda Sinnoh."',
    ],
    outro: ['A Pokédex está vazia. Por enquanto.'],
  },
  'rival-route-203': {
    intro: ['Barry: "Ei! Quantos você já capturou? Deixa eu ver o quanto você melhorou!"'],
    outro: ['Barry: "Hmpf. Vou pegar a insígnia de Oreburgh antes de você, de qualquer jeito."'],
  },
  'oreburgh-gym': {
    intro: [
      'Roark tira o capacete de minerador e limpa o pó das mãos.',
      'Roark: "Sou novo como líder, mas minhas pedras não quebram fácil. Mostre do que é feito!"',
    ],
    outro: ['Roark: "Perdi para alguém sem nenhuma insígnia... Esta agora é sua, com mérito."'],
  },
  'jubilife-galactic': {
    intro: [
      'Capanga: "Professor, entregue a pesquisa. É pelo bem da Equipe Galáctica."',
      'Professor Rowan: "Vocês falam demais. Crianças, deem uma lição neles."',
    ],
    outro: ['Os dois fogem prometendo voltar. Rowan nem levanta a sobrancelha.'],
  },
  'valley-windworks': {
    intro: [
      'Mars: "Uma criança conseguiu entrar? Que gracinha."',
      'Mars: "Precisamos da energia desta usina. Você não vai atrapalhar."',
    ],
    outro: ['Mars: "Perdi, mas já temos o que viemos buscar. Até a próxima."'],
  },
  'eterna-gym': {
    intro: [
      'Gardenia aparece entre as árvores do próprio ginásio, sorrindo.',
      'Gardenia: "Senti que você era forte desde a floresta. Não me decepcione!"',
    ],
    outro: ['Gardenia: "Incrível! Fique com a insígnia — você fez meu jardim tremer."'],
  },
  'galactic-eterna-building': {
    intro: [
      'Jupiter: "Viemos estudar a estátua de Eterna. Os Pokémon que pegamos são um detalhe."',
      'Jupiter: "Se os quer de volta, venha buscar."',
    ],
    outro: ['Jupiter: "Fique com eles. O chefe está interessado em coisas bem maiores."'],
  },
  'mt-coronet-south': {
    intro: [
      'O homem do lago está parado diante de uma parede de pedra.',
      '"Dizem que Sinnoh nasceu nesta montanha. Um mundo novo também poderia nascer aqui."',
    ],
    outro: ['Ele segue pela escuridão como quem conhece o caminho.'],
  },
  'hearthome-gym': {
    intro: [
      'As luzes se apagam. Uma voz ecoa pelo salão.',
      'Fantina: "Bienvenue! Vim de longe para brilhar em Sinnoh. Dance comigo, mon cher!"',
    ],
    outro: ['Fantina: "Magnifique! Você roubou a cena. A insígnia é toda sua."'],
  },
  'rival-hearthome': {
    intro: ['Barry: "Você também pegou a insígnia daqui? Então prova que mereceu!"'],
    outro: ['Barry: "Argh! Tá bom, tá bom. Veilstone é a próxima. Eu chego primeiro!"'],
  },
  'veilstone-gym': {
    intro: [
      'Maylene termina uma série de golpes no ar e se curva.',
      'Maylene: "Não sei bem o que é ser líder. Só sei lutar com tudo o que tenho."',
    ],
    outro: ['Maylene: "Você foi mais firme do que eu. Por favor, aceite a insígnia."'],
  },
  'galactic-warehouse': {
    intro: [
      'Assistente: "Eles levaram a minha Pokédex! Você me ajuda?"',
      'Dois capangas guardam a porta do armazém, entediados.',
    ],
    outro: ['A Pokédex volta para o dono. O armazém, porém, está cheio de caixas estranhas.'],
  },
  'pastoria-gym': {
    intro: [
      'Um homem mascarado salta na piscina e emerge gritando.',
      'Crasher Wake: "Eu sou a onda que derruba tudo! Venha, desafiante!"',
    ],
    outro: ['Crasher Wake: "Hahaha! Fui varrido pela sua maré! Tome a insígnia!"'],
  },
  'rival-pastoria': {
    intro: ['Barry: "Achou que eu ia deixar você ir embora sem uma batalha? Nem sonhando!"'],
    outro: ['Barry: "Como você fica mais forte tão rápido?! Eu não vou ficar pra trás!"'],
  },
  'celestic-town': {
    intro: [
      'O homem do lago finalmente diz o próprio nome.',
      'Cyrus: "Sou Cyrus. As emoções tornam este mundo incompleto. Vou refazê-lo sem elas."',
    ],
    outro: ['Cyrus: "Interessante. Você luta com sentimento — e é exatamente isso que o limita."'],
  },
  'rival-canalave': {
    intro: ['Barry: "Parado aí! Essa ponte tem pedágio, e o pedágio é uma batalha!"'],
    outro: ['Barry: "O líder daqui é o pai do Roark. Vai lá, eu já tenho a minha insígnia."'],
  },
  'canalave-gym': {
    intro: [
      'Byron crava a pá no chão de aço.',
      'Byron: "Então foi você que venceu meu filho. Vamos ver se atravessa a minha defesa!"',
    ],
    outro: ['Byron: "Hahaha! Minha muralha caiu. Leve a insígnia, você a conquistou."'],
  },
  'canalave-library': {
    intro: [
      'Professor Rowan: "Três Pokémon vivem nos três lagos. Dizem que guardam conhecimento, emoção e vontade."',
      'Antes que ele termine, as estantes começam a tremer.',
    ],
    outro: ['A explosão veio do sul. O Lago Valor.'],
  },
  'lake-valor': {
    intro: [
      'Onde havia um lago, só resta lama e Magikarp se debatendo.',
      'Saturn: "Chegou tarde. O guardião daqui já está a caminho de Veilstone."',
    ],
    outro: ['Saturn: "Você é forte, admito. Mas os outros lagos já estão sendo tratados."'],
  },
  'lake-verity-galactic': {
    intro: ['Mars: "Você de novo? Desta vez não estou com pressa. Vamos acertar as contas."'],
    outro: ['Mars: "De novo... Não importa. Já levamos o que queríamos deste lago também."'],
  },
  'snowpoint-gym': {
    intro: [
      'Candice ajeita o casaco amarrado na cintura.',
      'Candice: "Foco é tudo — na moda, no amor e nas batalhas. Vou te mostrar o meu!"',
    ],
    outro: ['Candice: "Uau, que concentração! A insígnia é sua. Agora corra para o lago!"'],
  },
  'lake-acuity': {
    intro: [
      'Barry está de joelhos na neve, olhando para o chão.',
      'Jupiter: "Seu amigo tentou. Não foi o bastante. O último guardião é nosso."',
    ],
    outro: ['Barry: "Eu não consegui fazer nada... Preciso ficar mais forte. Muito mais."'],
  },
  'galactic-hq-cyrus': {
    intro: [
      'Cyrus: "Você veio até aqui por três Pokémon? Sentimento outra vez."',
      'Cyrus: "Já extraí deles o que precisava. Pode tentar me deter, se isso o consola."',
    ],
    outro: ['Cyrus: "Leve esta Master Ball. Eu não preciso de ferramentas tão ordinárias."'],
  },
  'galactic-hq-saturn': {
    intro: ['Saturn: "O chefe já subiu o Monte Coronet. Minha ordem é só ganhar tempo."'],
    outro: ['As máquinas se abrem. Uxie, Mesprit e Azelf desaparecem num clarão.'],
  },
  'spear-pillar': {
    intro: [
      'Mars: "Ninguém passa." Jupiter: "O novo mundo começa hoje."',
      'Barry chega ofegante: "Desculpa a demora! Essa a gente faz junto!"',
    ],
    outro: [
      'Atrás delas, Cyrus desperta Dialga e Palkia. Então uma sombra se abre no chão e o engole.',
    ],
  },
  'distortion-world': {
    intro: [
      'Cynthia: "Este é o outro lado do nosso mundo. Tempo e espaço não valem aqui."',
      'Cynthia: "Se Cyrus ferir este lugar, o nosso mundo desmorona junto. Vamos."',
    ],
    outro: ['As plataformas se alinham. No fim do caminho, Cyrus espera.'],
  },
  'distortion-world-cyrus': {
    intro: [
      'Cyrus: "Um mundo sem espírito. Era isto que eu buscava, e uma sombra me roubou."',
      'Cyrus: "Depois de você, derrubo a sombra."',
    ],
    outro: ['Cyrus: "Por que o seu espírito não se curva? ...Vou encontrar a resposta sozinho."'],
  },
  giratina: {
    intro: ['O chão se desfaz. Seis asas negras cobrem o que aqui serve de céu.'],
    outro: ['Giratina recua para a escuridão, e a passagem de volta se abre.'],
  },
  'sunyshore-gym': {
    intro: [
      'Volkner desce do farol sem pressa.',
      'Volkner: "Faz tempo que ninguém me faz suar. Diga que você é diferente."',
    ],
    outro: [
      'Volkner: "...Isso foi divertido de verdade. Leve a última insígnia e vá para a Liga."',
    ],
  },
  'rival-pokemon-league': {
    intro: ['Barry: "Antes da Elite, eu! Tudo o que treinei desde o lago está aqui!"'],
    outro: ['Barry: "Perdi... mas foi a melhor batalha da minha vida. Vai lá e ganha tudo!"'],
  },
  'elite-four-aaron': {
    intro: ['Aaron: "Bem-vindo à Liga! Meus insetos e eu estamos em perfeita sintonia."'],
    outro: ['Aaron: "Fui derrotado, mas foi lindo. Siga em frente!"'],
  },
  'elite-four-bertha': {
    intro: ['Bertha: "Ora, que jovem simpático. Vamos ver se a terra treme com você."'],
    outro: ['Bertha: "Muito bem, querido. A próxima sala está bem mais quente."'],
  },
  'elite-four-flint': {
    intro: ['Flint: "Finalmente alguém com fogo nos olhos! Queime comigo!"'],
    outro: ['Flint: "Virei cinza... Vai, o Lucian está esperando."'],
  },
  'elite-four-lucian': {
    intro: ['Lucian: "Um momento, estou no fim do capítulo. ...Pronto. Podemos começar."'],
    outro: ['Lucian: "Uma leitura que eu não previ. A Campeã está atrás daquela porta."'],
  },
  'champion-cynthia': {
    intro: [
      'Cynthia: "Do lago até aqui, vi você crescer a cada passo."',
      'Cynthia: "Como Campeã da Liga de Sinnoh, aceito o seu desafio!"',
    ],
    outro: ['Cynthia: "Você e seus Pokémon são um só. Sinnoh tem um novo campeão."'],
  },
  'fight-area': {
    intro: ['Barry: "Olha quem tá aí! Flint e Volkner! Você fica comigo — dois contra dois!"'],
    outro: ['Volkner: "Nada mal." Flint: "Nada mal?! Isso foi fantástico!"'],
  },
  'stark-mountain-galactic': {
    intro: [
      'Charon: "Com a pedra do vulcão, a Equipe Galáctica renasce — sob o meu comando."',
      'Mars e Jupiter trocam um olhar cansado e sacam as Poké Balls.',
    ],
    outro: ['Mars: "Chega. Sem Cyrus, isto não é mais a Equipe Galáctica." As duas vão embora.'],
  },
  heatran: {
    intro: ['A pedra voltou ao lugar, mas a cratera continua rugindo. Algo se move na lava.'],
    outro: ['Heatran afunda de volta no magma, e a montanha se acalma.'],
  },
  'spear-pillar-legends': {
    intro: ['As orbes brilham. O ar no cume dobra sobre si mesmo.'],
    outro: ['O tempo volta a correr e o espaço a se estender, como sempre foi.'],
  },
}
