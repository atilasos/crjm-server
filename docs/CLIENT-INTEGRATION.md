# Especificação de Integração do Cliente

Este documento descreve tudo o que é necessário para desenvolver um cliente que se conecte ao servidor de campeonatos.

## 1. Conexão

### Endpoints

| Tipo | URL | Descrição |
|------|-----|-----------|
| WebSocket | `ws://{HOST}:3000/ws` | Comunicação em tempo real |
| HTTP | `http://{HOST}:3000/health` | Verificar estado do servidor |

### Estabelecer Conexão

```typescript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Conectado ao servidor');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleServerMessage(message);
};

ws.onclose = () => {
  console.log('Desconectado');
};
```

---

## 2. Jogos Suportados

| GameId | Nome | Descrição |
|--------|------|-----------|
| `gatos-caes` | Gatos & Cães | Tabuleiro 8×8, última jogada ganha, restrições de adjacência |
| `dominorio` | Dominório | Tabuleiro 8×8 com dominós, quem não pode jogar perde |
| `quelhas` | Quelhas | Tabuleiro 10×10, segmentos 2+, última jogada perde |
| `produto` | Produto | Tabuleiro hexagonal, produto dos 2 maiores grupos |
| `atari-go` | Atari Go | Go simplificado - primeira captura ganha (9×9) |
| `nex` | Nex | Hex com peças neutras e regra de troca (11×11) |

---

## 3. Protocolo de Mensagens

### 3.1 Mensagens do Cliente → Servidor

#### `join_tournament` - Entrar num campeonato

```typescript
{
  type: 'join_tournament',
  gameId: 'gatos-caes' | 'dominorio' | 'quelhas' | 'produto' | 'atari-go' | 'nex',
  playerName: string,      // Nome do jogador (obrigatório)
  classId?: string,        // Turma/classe (opcional)
  playerId?: string        // Para reconexão (opcional)
}
```

**Resposta**: `welcome` seguido de `tournament_state_update`

---

#### `ready_for_match` - Pronto para jogar

```typescript
{
  type: 'ready_for_match',
  matchId: string    // ID da partida atribuída
}
```

**Resposta**: `game_start` quando ambos os jogadores estiverem prontos

---

#### `submit_move` - Submeter jogada

```typescript
{
  type: 'submit_move',
  matchId: string,
  gameNumber: number,   // 1, 2 ou 3 (melhor de 3)
  move: GameMove        // Estrutura varia por jogo (ver secção 5)
}
```

**Resposta**: 
- Se válido: `game_state_update` para ambos os jogadores
- Se inválido: `error`
- Se fim do jogo: `game_end`

---

#### `leave_tournament` - Sair do campeonato

```typescript
{
  type: 'leave_tournament'
}
```

---

### 3.2 Mensagens do Servidor → Cliente

#### `welcome` - Confirmação de entrada

```typescript
{
  type: 'welcome',
  playerId: string,           // O teu ID único
  playerName: string,         // O teu nome
  tournamentId: string,       // ID do campeonato
  tournamentState: TournamentStateUpdate  // Estado completo
}
```

---

#### `tournament_state_update` - Atualização do campeonato

```typescript
{
  type: 'tournament_state_update',
  tournamentId: string,
  gameId: string,
  phase: 'registration' | 'running' | 'finished',
  players: Array<{
    id: string,
    name: string,
    classId?: string,
    isOnline: boolean
  }>,
  winnersMatches: MatchSummary[],
  losersMatches: MatchSummary[],
  grandFinal: MatchSummary | null,
  grandFinalReset: MatchSummary | null,
  championId: string | null,
  championName: string | null
}
```

---

#### `match_assigned` - Partida atribuída

```typescript
{
  type: 'match_assigned',
  match: {
    id: string,
    round: number,
    bracket: 'winners' | 'losers',
    player1: { id: string, name: string } | null,
    player2: { id: string, name: string } | null,
    score: { player1Wins: number, player2Wins: number },
    phase: 'waiting' | 'playing' | 'finished',
    winnerId: string | null
  },
  yourRole: 'player1' | 'player2',    // O teu papel nesta partida
  opponentName: string                 // Nome do adversário
}
```

---

#### `game_start` - Início de um jogo

```typescript
{
  type: 'game_start',
  matchId: string,
  gameNumber: number,           // 1, 2 ou 3
  youStart: boolean,            // true se começas tu
  initialState: GameState,      // Estado inicial do tabuleiro
  yourRole: 'player1' | 'player2'
}
```

---

#### `game_state_update` - Atualização do estado do jogo

```typescript
{
  type: 'game_state_update',
  matchId: string,
  gameNumber: number,
  gameState: GameState,          // Estado atual do tabuleiro
  yourTurn: boolean,             // true se é a tua vez
  lastMove?: GameMove,           // Última jogada feita
  lastMoveBy?: 'player1' | 'player2'
}
```

---

#### `game_end` - Fim de um jogo individual

```typescript
{
  type: 'game_end',
  matchId: string,
  gameNumber: number,
  winnerId: string | null,       // null se empate
  winnerRole: 'player1' | 'player2' | null,
  isDraw: boolean,
  finalState: GameState,
  matchScore: {
    player1Wins: number,
    player2Wins: number
  }
}
```

---

#### `match_end` - Fim da partida (melhor de 3)

```typescript
{
  type: 'match_end',
  matchId: string,
  winnerId: string,
  winnerName: string,
  finalScore: { player1Wins: number, player2Wins: number },
  youWon: boolean,
  nextMatchId?: string,                    // Próxima partida (se aplicável)
  eliminatedFromTournament: boolean        // true se foste eliminado
}
```

---

#### `tournament_end` - Fim do campeonato

```typescript
{
  type: 'tournament_end',
  tournamentId: string,
  championId: string,
  championName: string,
  finalStandings: Array<{
    rank: number,
    playerId: string,
    playerName: string
  }>
}
```

---

#### `error` - Erro

```typescript
{
  type: 'error',
  code: string,     // Código do erro
  message: string   // Descrição legível
}
```

**Códigos de erro comuns**:
- `JOIN_FAILED` - Falha ao entrar no campeonato
- `NOT_IN_TOURNAMENT` - Não estás num campeonato
- `MATCH_NOT_FOUND` - Partida não encontrada
- `NOT_IN_MATCH` - Não estás nesta partida
- `NO_ACTIVE_GAME` - Não há jogo ativo
- `INVALID_MOVE` - Jogada inválida
- `PARSE_ERROR` - Erro ao processar mensagem

---

#### `info` - Informação geral

```typescript
{
  type: 'info',
  message: string
}
```

---

## 4. Fluxo do Jogo

### 4.1 Fluxo Completo

```
1. Conectar via WebSocket
          ↓
2. Enviar: join_tournament
          ↓
3. Receber: welcome + tournament_state_update
          ↓
4. [AGUARDAR] Campeonato inicia (professor clica "Iniciar")
          ↓
5. Receber: match_assigned
          ↓
6. Enviar: ready_for_match
          ↓
7. Receber: game_start
          ↓
    ┌──────────────────────────────────────┐
    │  LOOP DO JOGO:                       │
    │  8. Se yourTurn: enviar submit_move  │
    │  9. Receber: game_state_update       │
    │  10. Repetir até game_end            │
    └──────────────────────────────────────┘
          ↓
11. Receber: game_end
          ↓
12. Se matchScore não decisivo → volta ao passo 7 (próximo jogo)
          ↓
13. Receber: match_end
          ↓
14. Se não eliminado → volta ao passo 5 (próxima partida)
          ↓
15. Receber: tournament_end
```

### 4.2 Sistema de Melhor de 3

- Cada **partida** (match) é decidida em **melhor de 3 jogos**
- O primeiro a ganhar **2 jogos** ganha a partida
- **Alternância**: quem começa no jogo 1 é player1, no jogo 2 é player2, no jogo 3 volta a player1

### 4.3 Dupla Eliminação

```
Winners Bracket                    Losers Bracket
═══════════════                    ═══════════════
     ┌─ W1 ─┐                      
     │      ├─ W2 ─┐               ┌─ L1 ─┐
     └─ W1 ─┘      │               │      ├─ L2 ─┐
                   ├─ W3 ─┐        └─ L1 ─┘      │
     ┌─ W1 ─┐      │      │                      ├─ L3 ─┐
     │      ├─ W2 ─┘      │        ┌─ L1 ─┐      │      │
     └─ W1 ─┘             │        │      ├─ L2 ─┘      │
                          │        └─ L1 ─┘             │
                          │                             │
                          └───────── GRAND FINAL ───────┘
                                         │
                               (Reset se losers ganhar)
```

- **Perder na Winners** → Vai para Losers
- **Perder na Losers** → Eliminado
- **Grand Final**: Vencedor da Winners vs Vencedor da Losers
- **Grand Final Reset**: Se o jogador da Losers ganhar a Grand Final

---

## 5. Estrutura das Jogadas por Jogo

### 5.1 Gatos & Cães (`gatos-caes`)

**Tabuleiro**: 8×8, player1 = gatos (🐱), player2 = cães (🐶)

**Regras**:
- Primeiro gato deve ser na zona central (2×2 no meio)
- Primeiro cão deve ser fora da zona central
- Não pode colocar gato adjacente a cão (ortogonalmente) e vice-versa
- Ganha quem faz a última jogada

**Jogada**:
```typescript
{
  row: number,  // 0-7
  col: number   // 0-7
}
```

**Estado**:
```typescript
{
  board: ('empty' | 'cat' | 'dog')[][],  // 8×8
  currentPlayer: 'player1' | 'player2',
  catCount: number,
  dogCount: number,
  lastMove: { row: number, col: number } | null,
  winner: 'player1' | 'player2' | null,
  isFirstCatPlaced: boolean,
  isFirstDogPlaced: boolean
}
```

**Vitória**: Fazer a última jogada (adversário não pode jogar)

---

### 5.2 Dominório (`dominorio`)

**Tabuleiro**: 8×8

**Regras**:
- player1 (Vertical) só pode colocar dominós verticalmente
- player2 (Horizontal) só pode colocar dominós horizontalmente
- Vertical começa
- Perde quem não puder jogar

**Jogada**:
```typescript
{
  row1: number, col1: number,  // Primeira célula (0-7)
  row2: number, col2: number   // Segunda célula adjacente (0-7)
}
```

**Estado**:
```typescript
{
  board: (null | 'player1' | 'player2')[][],  // 8×8
  currentPlayer: 'player1' | 'player2',
  lastMove: { row1, col1, row2, col2 } | null,
  winner: 'player1' | 'player2' | null,
  movesCount: number
}
```

**Vitória**: Adversário não pode jogar (jogo misère)

---

### 5.3 Quelhas (`quelhas`)

**Tabuleiro**: 10×10

**Regras**:
- player1 (Vertical) só coloca segmentos verticais de 2+ peças
- player2 (Horizontal) só coloca segmentos horizontais de 2+ peças
- Vertical começa
- Horizontal pode usar "swap" na primeira jogada
- Perde quem faz a última jogada (jogo misère)

**Jogada**:
```typescript
{
  cells: Array<{ row: number, col: number }>,  // 2+ células contíguas
  swap?: boolean  // true para trocar (só player2, só após 1ª jogada)
}
```

**Estado**:
```typescript
{
  board: ('empty' | 'filled')[][],  // 10×10
  currentPlayer: 'player1' | 'player2',
  lastMove: { cells: [...], swap?: boolean } | null,
  winner: 'player1' | 'player2' | null,
  moveCount: number,
  canSwap: boolean,
  swapped: boolean
}
```

**Vitória**: Adversário não pode jogar (quem faz última jogada perde)

---

### 5.4 Produto (`produto`)

**Tabuleiro**: Hexagonal com 5 casas de lado (61 células)

**Regras**:
- player1 = preto, player2 = branco
- Cada jogada: colocar 2 peças de QUALQUER cor (1ª jogada: apenas 1 peça)
- Quando cheio: calcular produto dos 2 maiores grupos de cada cor
- Maior produto ganha; se empate, menos peças da própria cor ganha

**Jogada**:
```typescript
{
  placements: Array<{
    coord: { q: number, r: number },  // Coordenadas axiais
    color: 'black' | 'white'
  }>  // 1 ou 2 elementos
}
```

**Estado**:
```typescript
{
  board: Map<string, 'empty' | 'black' | 'white'>,  // 61 células
  currentPlayer: 'player1' | 'player2',
  lastMove: { placements: [...] } | null,
  winner: 'player1' | 'player2' | 'draw' | null,
  moveCount: number,
  blackPiecesPlaced: number,
  whitePiecesPlaced: number
}
```

**Vitória**: Maior produto de grupos quando o tabuleiro está cheio

---

### 5.5 Atari Go (`atari-go`)

**Tabuleiro**: 9×9, player1 = preto, player2 = branco

**Jogada**:
```typescript
{
  row: number,   // 0-8
  col: number,   // 0-8
  pass?: boolean // true para passar
}
```

**Estado**:
```typescript
{
  board: ('empty' | 'black' | 'white')[][],
  currentPlayer: 'player1' | 'player2',
  blackCaptures: number,
  whiteCaptures: number,
  lastMove: { row, col, pass? } | null,
  winner: 'player1' | 'player2' | 'draw' | null,
  passCount: number
}
```

**Vitória**: Primeira captura (capturar pelo menos 1 pedra)

---

### 5.6 Nex (`nex`)

**Tabuleiro**: 11×11, player1 (preto) conecta topo↔fundo, player2 (branco) conecta esquerda↔direita

**Regras**:
- 3 tipos de peças: pretas, brancas e neutras (cinzentas)
- Jogada tipo 1: colocar 1 peça própria + 1 neutra em casas vazias
- Jogada tipo 2: converter 2 neutras para própria + converter 1 própria para neutra
- Regra de troca: após 1ª jogada, player2 pode trocar cores

**Jogada**:
```typescript
{
  type: 'place' | 'convert' | 'swap',
  // Para 'place':
  ownPiece?: { row: number, col: number },
  neutralPiece?: { row: number, col: number },
  // Para 'convert':
  neutralsToConvert?: Array<{ row: number, col: number }>,  // 2 células
  ownToNeutral?: { row: number, col: number }
}
```

**Estado**:
```typescript
{
  board: ('empty' | 'black' | 'white' | 'neutral')[][],  // 11×11
  currentPlayer: 'player1' | 'player2',
  lastMove: NexMove | null,
  winner: 'player1' | 'player2' | null,
  moveCount: number,
  canSwap: boolean,
  swapped: boolean
}
```

**Vitória**: Conectar os dois lados opostos do tabuleiro com a sua cor

---

## 6. Exemplo Completo de Implementação

```typescript
class TournamentClient {
  private ws: WebSocket;
  private playerId: string | null = null;
  private tournamentId: string | null = null;
  private currentMatchId: string | null = null;
  private myRole: 'player1' | 'player2' | null = null;

  connect(host: string = 'localhost:3000') {
    this.ws = new WebSocket(`ws://${host}/ws`);
    
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };
  }

  joinTournament(gameId: string, playerName: string, classId?: string) {
    this.send({
      type: 'join_tournament',
      gameId,
      playerName,
      classId
    });
  }

  readyForMatch(matchId: string) {
    this.send({
      type: 'ready_for_match',
      matchId
    });
  }

  submitMove(move: any) {
    if (!this.currentMatchId) return;
    this.send({
      type: 'submit_move',
      matchId: this.currentMatchId,
      gameNumber: this.currentGameNumber,
      move
    });
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.tournamentId = msg.tournamentId;
        this.onWelcome(msg);
        break;

      case 'tournament_state_update':
        this.onTournamentUpdate(msg);
        break;

      case 'match_assigned':
        this.currentMatchId = msg.match.id;
        this.myRole = msg.yourRole;
        this.onMatchAssigned(msg);
        // Auto-ready (ou mostrar botão "Pronto")
        this.readyForMatch(msg.match.id);
        break;

      case 'game_start':
        this.currentGameNumber = msg.gameNumber;
        this.onGameStart(msg);
        break;

      case 'game_state_update':
        this.onGameStateUpdate(msg);
        if (msg.yourTurn) {
          this.onMyTurn(msg.gameState);
        }
        break;

      case 'game_end':
        this.onGameEnd(msg);
        break;

      case 'match_end':
        this.currentMatchId = null;
        this.onMatchEnd(msg);
        break;

      case 'tournament_end':
        this.onTournamentEnd(msg);
        break;

      case 'error':
        this.onError(msg);
        break;
    }
  }

  private send(data: any) {
    this.ws.send(JSON.stringify(data));
  }

  // Callbacks para a UI implementar
  onWelcome(msg: any) {}
  onTournamentUpdate(msg: any) {}
  onMatchAssigned(msg: any) {}
  onGameStart(msg: any) {}
  onGameStateUpdate(msg: any) {}
  onMyTurn(gameState: any) {}
  onGameEnd(msg: any) {}
  onMatchEnd(msg: any) {}
  onTournamentEnd(msg: any) {}
  onError(msg: any) {}
}
```

---

## 7. Jogadores Computador (Bots)

O servidor suporta jogadores controlados por computador para testar campeonatos sem jogadores humanos.

### Características dos Bots

- **Identificação**: Jogadores bot têm `isBot: true` no seu objeto de jogador
- **Comportamento**: Jogam automaticamente quando é a sua vez (sem necessidade de WebSocket)
- **Estratégias**: Cada jogo tem estratégias específicas implementadas (heurísticas avançadas)
- **Partidas automáticas**: Partidas entre dois bots iniciam e decorrem automaticamente

### Criar Campeonato com Bots (Admin)

Através da API de administração:

```typescript
// Criar campeonato com 4 bots
POST /admin/api/tournaments
{
  "gameId": "gatos-caes",
  "label": "Teste com Bots",
  "botCount": 4
}

// Adicionar 2 bots a um campeonato existente
POST /admin/api/tournaments/{id}/bots
{
  "count": 2
}
```

### Campo `isBot` em Jogadores

```typescript
// No tournament_state_update, cada jogador pode ter:
{
  id: string,
  name: string,
  classId?: string,
  isOnline: boolean,
  isBot?: boolean  // true se for jogador computador
}
```

### Nota para Clientes

- Bots aparecem sempre como "online" (`isOnline: true`)
- Bots nunca enviam mensagens `ready_for_match` - o servidor trata disso automaticamente
- Quando jogas contra um bot, as jogadas dele aparecem normalmente via `game_state_update`

---

## 8. Notas Importantes

1. **Reconexão**: Guarda o `playerId` e envia-o no `join_tournament` para reconectar
2. **Validação**: Todas as jogadas são validadas no servidor - jogadas inválidas retornam `error`
3. **Tempo real**: O servidor envia updates automaticamente - não é preciso polling
4. **Fase de registo**: Jogadores só podem entrar quando `phase === 'registration'`
5. **Ordem dos turnos**: Verifica sempre `yourTurn` antes de permitir jogada
6. **Melhor de 3**: Uma partida pode ter 2 ou 3 jogos - usa `matchScore` para mostrar progresso
7. **Jogadores computador**: Bots têm `isBot: true` e jogam automaticamente

