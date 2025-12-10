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
| `gatos-caes` | Gatos & Cães | 4 em linha num tabuleiro 6×6 |
| `dominorio` | Dominório | Captura de células com dominós (5×5) |
| `quelhas` | Quelhas | 5 em linha com capturas (9×9) |
| `produto` | Produto | 4 em linha na tabela de multiplicação (9×9) |
| `atari-go` | Atari Go | Go simplificado - primeira captura ganha (9×9) |
| `nex` | Nex | Variante de Hex com regra de troca (11×11) |

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

**Tabuleiro**: 6×6, player1 = gatos (🐱), player2 = cães (🐶)

**Jogada**:
```typescript
{
  row: number,  // 0-5
  col: number   // 0-5
}
```

**Estado**:
```typescript
{
  board: ('empty' | 'cat' | 'dog')[][],  // 6×6
  currentPlayer: 'player1' | 'player2',
  catCount: number,
  dogCount: number,
  lastMove: { row: number, col: number } | null,
  winner: 'player1' | 'player2' | 'draw' | null
}
```

**Vitória**: 4 peças em linha (horizontal, vertical ou diagonal)

---

### 5.2 Dominório (`dominorio`)

**Tabuleiro**: 5×5 com valores 1-6 em cada célula

**Jogada**:
```typescript
{
  row1: number, col1: number,  // Primeira célula (0-4)
  row2: number, col2: number   // Segunda célula adjacente (0-4)
}
```

**Estado**:
```typescript
{
  board: Array<Array<{
    value: number,                     // 1-6
    owner: null | 'player1' | 'player2'
  }>>,
  currentPlayer: 'player1' | 'player2',
  player1Score: number,
  player2Score: number,
  lastMove: { row1, col1, row2, col2 } | null,
  winner: 'player1' | 'player2' | 'draw' | null,
  movesCount: number
}
```

**Vitória**: Maior pontuação quando não há mais jogadas possíveis

---

### 5.3 Quelhas (`quelhas`)

**Tabuleiro**: 9×9

**Jogada**:
```typescript
{
  row: number,  // 0-8
  col: number   // 0-8
}
```

**Estado**:
```typescript
{
  board: ('empty' | 'player1' | 'player2')[][],
  currentPlayer: 'player1' | 'player2',
  player1Captures: number,
  player2Captures: number,
  lastMove: { row: number, col: number } | null,
  winner: 'player1' | 'player2' | 'draw' | null
}
```

**Vitória**: 5 em linha OU 5 capturas (captura custodiana de pares)

---

### 5.4 Produto (`produto`)

**Tabuleiro**: 9×9 (tabela de multiplicação)

**Jogada**:
```typescript
{
  factor: 1 | 2,    // Qual fator mover
  position: number  // Nova posição (1-9)
}
```

**Estado**:
```typescript
{
  grid: number[][],              // Tabela de multiplicação fixa
  player1Marked: boolean[][],    // Células marcadas por player1
  player2Marked: boolean[][],    // Células marcadas por player2
  currentPlayer: 'player1' | 'player2',
  factor1Position: number,       // Posição do fator 1 (1-9)
  factor2Position: number,       // Posição do fator 2 (1-9)
  lastMove: { factor: 1|2, position: number } | null,
  winner: 'player1' | 'player2' | 'draw' | null
}
```

**Vitória**: 4 marcações em linha

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

**Tabuleiro**: 11×11 hexagonal, player1 conecta topo↔fundo, player2 conecta esquerda↔direita

**Jogada**:
```typescript
{
  row: number,    // 0-10
  col: number,    // 0-10
  swap?: boolean  // true para usar regra de troca (só player2, só no 2º turno)
}
```

**Estado**:
```typescript
{
  board: ('empty' | 'player1' | 'player2')[][],
  currentPlayer: 'player1' | 'player2',
  lastMove: { row, col, swap? } | null,
  winner: 'player1' | 'player2' | null,  // Hex não tem empate
  moveCount: number,
  canSwap: boolean  // true se player2 pode usar swap
}
```

**Vitória**: Conectar os dois lados opostos do tabuleiro

**Regra de troca**: Após a primeira jogada de player1, player2 pode escolher trocar (ficar com a posição de player1)

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

## 7. Notas Importantes

1. **Reconexão**: Guarda o `playerId` e envia-o no `join_tournament` para reconectar
2. **Validação**: Todas as jogadas são validadas no servidor - jogadas inválidas retornam `error`
3. **Tempo real**: O servidor envia updates automaticamente - não é preciso polling
4. **Fase de registo**: Jogadores só podem entrar quando `phase === 'registration'`
5. **Ordem dos turnos**: Verifica sempre `yourTurn` antes de permitir jogada
6. **Melhor de 3**: Uma partida pode ter 2 ou 3 jogos - usa `matchScore` para mostrar progresso

