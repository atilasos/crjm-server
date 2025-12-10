---
name: servidor-campeonato-jogos
overview: Implementar um servidor Bun em TypeScript que gere campeonatos de dupla eliminação para cada jogo, expõe API/WebSocket para os clientes existentes e fornece uma página web de gestão para o professor.
todos:
  - id: setup-server-project
    content: Criar projeto Bun/TypeScript para o servidor com HTTP + WebSocket básicos
    status: pending
  - id: implement-tournament-model
    content: Implementar modelos de dados e lógica de double elimination (Tournament, Match, Player, GameSession)
    status: pending
  - id: implement-game-engines
    content: Criar adaptadores GameEngine para Gatos & Cães e Dominório reutilizando a lógica existente
    status: pending
  - id: implement-websocket-protocol
    content: Implementar endpoint /ws com o protocolo de mensagens cliente-servidor compatível com o frontend atual
    status: pending
  - id: implement-admin-api-and-ui
    content: Criar endpoints REST /admin/api e página /admin para gestão dos campeonatos
    status: pending
  - id: extend-to-more-games
    content: Adicionar suporte a Quelhas, Produto, Atari Go e Nex via novos GameEngine adapters
    status: pending
  - id: add-export-import-and-hardening
    content: Adicionar funcionalidades de export/import de estado e reforçar tratamento de erros e reconexões
    status: pending
---

# Plano para servidor de campeonato (Bun + TypeScript)

## 1. Objetivos e requisitos gerais

- **Objetivo principal**: Servidor que gere campeonatos de dupla eliminação, um por jogo, controlando:
- inscrições de jogadores (via cliente já existente);
- emparelhamentos e bracket (winners/losers + final com regra de dupla eliminação);
- séries "melhor de 3" com alternância de quem começa;
- execução das partidas usando a lógica oficial de cada jogo;
- comunicação em tempo real com os clientes (jogadores) via WebSocket;
- página de gestão para o professor: criar/iniciar/terminar campeonatos, acompanhar bracket e partidas.
- **Escopo inicial**:
- Suporte completo para pelo menos 2 jogos (por exemplo `gatos-caes` e `dominorio`).
- Armazenamento em memória (sem base de dados) suficiente para um campeonato em tempo real.
- Capacidade de correr na rede interna da escola (um IP que os alunos introduzem no frontend).

## 2. Arquitetura de alto nível

- **Stack**:
- Runtime: Bun
- Linguagem: TypeScript (ESM)
- Servidor HTTP + WebSocket: APIs nativas de Bun ou um microframework leve.
- **Módulos principais**:
- `core/tournament`:
  - Modelos de dados (`Tournament`, `Player`, `Match`, `BracketType`, `TournamentPhase`, etc.).
  - Lógica de criação e atualização da bracket de dupla eliminação.
  - Gestão de séries melhor de 3 (tracking de jogos individuais).
- `core/game-engine`:
  - Adaptadores para cada jogo (`gatos-caes`, `dominorio`, …) encapsulando:
  - criação de estado inicial;
  - validação de jogadas;
  - aplicação de jogadas;
  - verificação de fim de jogo e vencedor.
- `server/websocket`:
  - Gestão de ligações dos jogadores (mapa conexão ↔ jogador).
  - Implementação do protocolo de mensagens já usado pelo frontend
(`join_tournament`, `ready_for_match`, `submit_move`, `tournament_state_update`, `match_assigned`, etc.).
- `server/http`:
  - API REST simples para a página de gestão (professor).
  - Servir ficheiros estáticos (frontend de administração) a partir de `public/admin` ou similar.
- `admin-ui`:
  - Single-page app simples (pode ser HTML+JS básico ou React minimal) para o professor:
  - lista de campeonatos ativos/terminados;
  - criar campeonato para um `gameId`;
  - ver jogadores inscritos;
  - iniciar/pausar/terminar campeonato;
  - ver bracket (vista simplificada) e estado das partidas.

## 3. Modelo de dados do campeonato

- **Entidades principais** (em TypeScript):
- `GameId = 'gatos-caes' | 'dominorio' | 'quelhas' | 'produto' | 'atari-go' | 'nex'` (sincronizado com o cliente).
- `Player`: `{ id: string; name: string; classId?: string; }`.
- `BracketType = 'winners' | 'losers'`.
- `Match`:
  - `id`, `round`, `bracket`, `player1`, `player2`;
  - `score: { player1Wins: number; player2Wins: number; }`;
  - `bestOf: number` (3 por defeito);
  - `currentGame: number` (1..bestOf);
  - `whoStartsCurrentGame: 'player1' | 'player2' | null`;
  - `phase: 'waiting' | 'playing' | 'finished'`;
  - `winnerId: string | null`.
- `Tournament`:
  - `id`, `gameId`, `phase: 'registration' | 'running' | 'finished'`;
  - `players: Player[]`;
  - `winnersMatches: Match[]`;
  - `losersMatches: Match[]`;
  - `grandFinal: Match | null` (vencedor winners vs vencedor losers);
  - `grandFinalReset: Match | null` (opcional, se o vencedor da losers ganhar a primeira final);
  - `championId: string | null`.
- `GameSession` (estado de uma partida concreta dentro de um `Match`):
  - `id`, `tournamentId`, `matchId`, `gameNumber`;
  - `gameId`;
  - `state`: estrutura específica do jogo (por exemplo `GatosCaesState`).
- **Armazenamento**:
- Em memória: mapas `tournaments: Map<string, Tournament>` e `sessions: Map<string, GameSession>`.
- Opcional: export/import de estado para ficheiro JSON (backup manual para o professor).

## 4. Algoritmo de dupla eliminação

- **Criação da bracket inicial (winners)**:
- Recebe lista de jogadores inscritos.
- Baralha aleatoriamente (ou futura opção para seed manual).
- Cria `Match` de winners round 1 emparelhando aos pares; se número ímpar, atribuir bye (vitória automática).
- **Fluxo por ronda**:
- Para cada `Match` de winners/losers numa ronda:
  - Quando um `Match` termina, atualizar:
  - vencedor → próxima posição na winners/losers de acordo com tabela de bracket;
  - perdedor → losers (se estava em winners) ou eliminado (se já estava em losers).
- Para simplificar a implementação inicial:
  - Usar uma biblioteca existente de double-elimination ou implementar algoritmo baseado em índices (array de posições).
  - Representar a bracket de forma genérica (por exemplo, lista de rondas, cada ronda lista de `Match` com referências a matches anteriores).
- **Final e reset**:
- Quando restar 1 jogador na winners e 1 na losers:
  - criar `grandFinal` com eles.
- Se o jogador vindo da winners perder a final e ainda não tiver derrota anterior:
  - criar `grandFinalReset` (nova final entre os dois, "decider").
- Campeão é quem ganhar o último `Match` disputado.

## 5. Integração com lógica dos jogos

- **Objetivo**: o servidor é a fonte de verdade do estado do tabuleiro e das regras.
- **Abstração `GameEngine`**:
- Interface comum:
  - `createInitialState(startingPlayer: 'player1' | 'player2'): GameSpecificState`;
  - `validateMove(state, move): boolean`;
  - `applyMove(state, move): GameSpecificState` (não mutável, retorna cópia atualizada);
  - `isGameOver(state): boolean`;
  - `getWinner(state): 'player1' | 'player2' | 'draw' | null`;
  - `serializeState(state): unknown` (para mandar para o cliente);
  - `deserializeState(payload: unknown): GameSpecificState` (se necessário).
- Implementar adaptadores por jogo (pelo menos):
  - `GatosCaesEngine` usando `logic.ts` atual (reaproveitar funções de cálculo de jogadas e colocação de peças).
  - `DominorioEngine` usando `logic.ts` respetivo.
- Cada `GameSession` guarda referência ao `GameEngine` correto com base em `gameId`.

## 6. Protocolo WebSocket (compatível com o cliente atual)

- **Canal único de WebSocket**: `/ws`.
- **Identificação de sessão**:
- Na ligação, gerar `connectionId` interno.
- Após `join_tournament`, associar `connectionId → playerId → tournamentId`.
- **Mensagens do cliente → servidor** (JSON):
- `join_tournament`:
  - `{ type: 'join_tournament', gameId, playerName, classId? }`.
  - Cria (ou reutiliza) campeonato para aquele `gameId` e adiciona jogador.
  - Resposta: `welcome` com estado inicial do campeonato.
- `ready_for_match`:
  - `{ type: 'ready_for_match', matchId }`.
  - Marca o jogador como pronto; quando ambos estão prontos, o servidor inicia o `GameSession`.
- `submit_move`:
  - `{ type: 'submit_move', matchId, gameNumber, move }`.
  - Servidor valida o movimento via `GameEngine`; se inválido, devolve `error`.
  - Se válido, aplica, atualiza estado, verifica fim do jogo e, se necessário, fim do `Match`.
- `leave_tournament`:
  - Remove jogador do campeonato (decisão de como tratar matches em curso: derrota por falta ou anulação).
- **Mensagens do servidor → cliente**:
- `welcome` com `playerId` e `tournamentState`.
- `tournament_state_update` com o novo `TournamentState`.
- `match_assigned` com `match` e `yourRole`.
- `game_start` com `matchId`, `gameNumber`, `youStart`, `initialState`.
- `game_state_update` com `matchId`, `gameNumber`, `gameState`, `yourTurn`, `lastMove?`.
- `game_end` com `matchId`, `gameNumber`, `winnerId`, `finalState`.
- `match_end` com `matchId`, `winnerId`, `finalScore`, `youWon`, `nextBracket`.
- `tournament_end` com `championId`, `championName`, `finalStandings` (opcionalmente, top 4 ou top 8).
- `error` com `code`, `message`.
- `info` com mensagens gerais.

## 7. Fluxo de uma partida (melhor de 3)

- **Criação do `Match`**:
- `bestOf = 3`, `currentGame = 1`.
- `whoStartsCurrentGame = 'player1'` no jogo 1.
- **Jogo 1**:
- Servidor cria `GameSession` com `GameEngine.createInitialState('player1')`.
- Envia `game_start` para ambos com `youStart` apropriado e `initialState`.
- Processa `submit_move` alternando turnos até `isGameOver`.
- Em `game_end`, atualiza `score` do `Match`.
- **Jogo 2**:
- `currentGame = 2`, `whoStartsCurrentGame = 'player2'`.
- Repetir processo com startingPlayer invertido.
- **Jogo 3 (se necessário)**:
- `currentGame = 3`, voltar a `whoStartsCurrentGame = 'player1'`.
- **Fim do `Match`**:
- Quando um jogador atinge `ceil(bestOf/2)` vitórias, marcar `phase = 'finished'` e atualizar bracket.

## 8. Página de gestão do professor (admin UI)

- **Objetivo**: interface web simples, disponível em `/admin`, para gerir campeonatos.
- **Funcionalidades mínimas**:
- Lista de campeonatos existentes (por `gameId`), com estado (`registration`, `running`, `finished`).
- Criar novo campeonato manualmente (permite ter vários por jogo, se desejado) ou reutilizar único por `gameId`.
- Ver jogadores inscritos num campeonato; opcionalmente, remover/inativar.
- Botões:
  - "Abrir inscrições" (fase `registration`).
  - "Iniciar campeonato" (mudança para `running`, geração da bracket inicial, notificação aos jogadores).
  - "Forçar próxima ronda" ou "avançar" (se for útil para debugging/controlo manual).
  - "Terminar campeonato" (colocar fase `finished`, sem mais jogos).
- Visualização simplificada da bracket:
  - Para cada ronda winners/losers, lista de matches com nomes dos jogadores e estado.
- Visualização de partidas em curso:
  - Lista de matches `phase='playing'` com link/expansão para ver:
  - resultado parcial na série (vitórias 1/2/3);
  - estado atual do jogo (snapshot enviado pelo servidor – leitura apenas).
- **Tecnologia sugerida**:
- Build simples com React+Vite ou mesmo HTML+Alpine/Vanilla JS, compilado a ficheiros estáticos.
- Comunicação com o servidor via:
  - HTTP REST para operações administrativas;
  - WebSocket read-only (opcional) para ver atualizações em tempo real.

## 9. Endpoints HTTP para administração

- **Base URL**: `/admin/api`.
- **Possíveis endpoints**:
- `GET /admin/api/tournaments` → lista de torneios com `id`, `gameId`, `phase`.
- `POST /admin/api/tournaments` → cria novo torneio:
  - body: `{ gameId: GameId, label?: string }`.
  - resposta: objeto `Tournament` resumido.
- `GET /admin/api/tournaments/:id` → detalhes completos do torneio (inclui matches e jogadores).
- `POST /admin/api/tournaments/:id/start` → muda `phase` de `registration` para `running` e cria bracket.
- `POST /admin/api/tournaments/:id/finish` → força término do torneio.
- `POST /admin/api/tournaments/:id/reset` (opcional para debugging) → limpa tudo e volta ao início.
- `POST /admin/api/tournaments/:id/export` → devolve JSON com estado completo.
- `POST /admin/api/tournaments/import` → importa JSON previamente guardado (restaura estado).

## 10. Gestão de erros e robustez

- **Validações principais**:
- Garantir que `submit_move` só é aceite se:
  - o `match` existir e estiver `playing`;
  - o `player` que enviou está associado àquele `match`;
  - é a vez desse jogador;
  - a jogada é válida segundo o `GameEngine`.
- Tratar desconexões de jogadores:
  - marcam-se como "offline"; permite reconectar via `join_tournament` com mesmo `playerId` se guardado num token simples.
  - em ambiente escolar inicial, pode ser suficiente forçar derrota por falta se não voltar a tempo.
- **Logs**:
- Logging simples em consola com prefixos por módulo (`[WS]`, `[HTTP]`, `[TOURNAMENT]`).

## 11. Passos de implementação sugeridos

- **Passo 1: esqueleto do servidor**
- Criar projeto Bun/TypeScript separado.
- Configurar servidor HTTP básico e endpoint `/ws` para WebSocket.
- Adicionar rota estática `/admin` que serve um `index.html` placeholder.
- **Passo 2: modelos de dados e lógica de torneio**
- Implementar interfaces `Player`, `Match`, `Tournament`, `GameSession`.
- Implementar módulo de dupla eliminação (criação de bracket e progressão de vencedores/perdedores).
- **Passo 3: integrações com `GameEngine`**
- Implementar `GatosCaesEngine` e `DominorioEngine` com base no código dos jogos.
- Criar mapa `gameEngines: Record<GameId, GameEngine>`.
- **Passo 4: implementação do WebSocket**
- Implementar parsing de mensagens do cliente e envio das mensagens do protocolo.
- Gerir mapa de conexões e associação a jogadores.
- Testar fluxo completo de uma partida (melhor de 3) com um só `Match` e 2 clientes de teste.
- **Passo 5: página de gestão (admin UI)**
- Implementar UI básica em `/admin` consumindo os endpoints REST.
- Mostrar lista de torneios, botão para iniciar, ver bracket e estado.
- **Passo 6: refino e extensões**
- Adicionar suporte para mais jogos (Quelhas, Produto, Atari Go, Nex) implementando os respetivos `GameEngine`s.
- Melhorar visualização da bracket (por exemplo, layout em árvore).
- Adicionar export/import de estado para backup.

## 12. Considerações futuras

- **Persistência**:
- Se for necessário manter histórico (por exemplo, para vários dias ou anos), planear integração futura com base de dados ligeira (SQLite/Postgres).
- **Multi-escola / multi-servidor**:
- O design atual assume uma escola/servidor, mas o modelo de dados permite separar torneios por `id` e agrupá-los num campo `schoolId` mais tarde.
- **Autenticação de professor**:
- Para uso em produção mais aberto (fora da rede interna), adicionar autenticação simples para `/admin` (palavra-passe, por exemplo).