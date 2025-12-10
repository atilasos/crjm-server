# 🏆 Servidor de Campeonatos de Jogos

Servidor Bun/TypeScript para gestão de campeonatos de jogos educativos com formato de dupla eliminação.

## Características

- **Dupla Eliminação**: Brackets winners/losers completos com grand final
- **Séries Melhor de 3**: Alternância de quem começa em cada jogo
- **6 Jogos Suportados (regras oficiais)**:
  - Gatos & Cães — tabuleiro 8×8, restrições de colocação, última jogada ganha
  - Dominório — tabuleiro 8×8, vertical vs horizontal, quem não joga perde
  - Quelhas — tabuleiro 10×10, segmentos 2+, swap, última jogada perde (misère)
  - Produto — tabuleiro hexagonal (61 células), produto dos 2 maiores grupos
  - Atari Go — 9×9, primeira captura ganha
  - Nex — 11×11 com peças neutras e swap
- **Bots**: Jogadores computador para simular campeonatos do início ao fim
- **WebSocket em Tempo Real**: Comunicação instantânea com clientes
- **Painel de Administração**: Interface web para gerir campeonatos e bots

## Requisitos

- [Bun](https://bun.sh/) v1.0 ou superior

## Instalação

```bash
bun install
```

## Executar

### Desenvolvimento (com hot reload)

```bash
bun dev
```

### Produção

```bash
bun start
```

O servidor iniciará em `http://localhost:3000` por defeito.

### Testes

```bash
bun test
```

## Endpoints

### WebSocket

- `ws://localhost:3000/ws` - Conexão para jogadores

### HTTP

- `GET /` - Redireciona para painel de administração
- `GET /admin` - Painel de gestão de campeonatos
- `GET /health` - Estado do servidor

### Admin API

- `GET /admin/api/tournaments` - Lista todos os campeonatos
- `POST /admin/api/tournaments` - Cria novo campeonato (aceita `botCount`)
- `GET /admin/api/tournaments/:id` - Detalhes de um campeonato
- `POST /admin/api/tournaments/:id/bots` - Adiciona bots durante a fase de inscrição
- `POST /admin/api/tournaments/:id/start` - Inicia campeonato
- `POST /admin/api/tournaments/:id/finish` - Termina campeonato
- `POST /admin/api/tournaments/:id/export` - Exporta estado em JSON
- `POST /admin/api/tournaments/import` - Importa campeonato

### Bots (Admin)

- Criar campeonato já com bots:
  ```json
  POST /admin/api/tournaments
  { "gameId": "gatos-caes", "label": "Teste", "botCount": 4 }
  ```
- Adicionar bots a um campeonato em inscrição:
  ```json
  POST /admin/api/tournaments/:id/bots
  { "count": 2 }
  ```

## Protocolo WebSocket

### Mensagens do Cliente → Servidor

```typescript
// Entrar num campeonato
{ type: 'join_tournament', gameId: string, playerName: string, classId?: string }

// Pronto para partida
{ type: 'ready_for_match', matchId: string }

// Submeter jogada
{ type: 'submit_move', matchId: string, gameNumber: number, move: any }

// Sair do campeonato
{ type: 'leave_tournament' }
```

### Mensagens do Servidor → Cliente

```typescript
// Boas-vindas ao campeonato
{ type: 'welcome', playerId, playerName, tournamentId, tournamentState }

// Atualização do estado do campeonato
{ type: 'tournament_state_update', ... }

// Partida atribuída
{ type: 'match_assigned', match, yourRole, opponentName }

// Início de jogo
{ type: 'game_start', matchId, gameNumber, youStart, initialState, yourRole }

// Atualização do estado do jogo
{ type: 'game_state_update', matchId, gameNumber, gameState, yourTurn, lastMove }

// Fim de jogo
{ type: 'game_end', matchId, gameNumber, winnerId, finalState, matchScore }

// Fim de partida
{ type: 'match_end', matchId, winnerId, finalScore, youWon }

// Fim de campeonato
{ type: 'tournament_end', tournamentId, championId, championName, finalStandings }

// Erro
{ type: 'error', code, message }
```

## Estrutura do Projeto

```
crjmserver/
├── index.ts                      # Ponto de entrada do servidor
├── src/
│   ├── core/
│   │   ├── types.ts              # Definições de tipos
│   │   ├── utils.ts              # Utilitários
│   │   ├── tournament/           # Gestão de campeonatos
│   │   │   ├── tournament-manager.ts
│   │   │   └── double-elimination.ts
│   │   ├── game-engine/          # Motores de jogo
│   │   │   ├── index.ts
│   │   │   ├── bot-strategies.ts # Heurísticas de bots por jogo
│   │   │   ├── gatos-caes.ts
│   │   │   ├── dominorio.ts
│   │   │   ├── quelhas.ts
│   │   │   ├── produto.ts
│   │   │   ├── atari-go.ts
│   │   │   └── nex.ts
│   │   └── game-session/         # Sessões de jogo ativas
│   │       └── game-session-manager.ts
│   └── server/
│       ├── websocket-handler.ts  # Gestão de WebSocket
│       ├── admin-api.ts          # API de administração
│       └── bot-manager.ts        # Orquestra jogadas de bots
└── public/
    └── admin/                    # Interface de administração
        ├── index.html
        ├── styles.css
        └── app.js
```

## Configuração

### Variáveis de Ambiente

- `PORT` - Porta do servidor (default: 3000)
- `NODE_ENV` - Ambiente (development/production)

## Licença

MIT
