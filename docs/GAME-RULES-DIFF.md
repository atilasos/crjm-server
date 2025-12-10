# Diferenças entre Regras Oficiais e Implementação

Este documento mapeia as diferenças entre as regras oficiais dos jogos (das imagens) e a implementação no código.

**NOTA:** Todas as diferenças identificadas neste documento foram corrigidas. Os motores de jogo agora implementam as regras oficiais.

---

## 1. Quelhas

### Regras Oficiais
- **Tabuleiro:** 10×10
- **Jogadores:** Vertical e Horizontal
- **Jogada:** Colocar 2 ou mais peças ortogonalmente contíguas
- **Restrição:** Vertical só coloca verticalmente, Horizontal só coloca horizontalmente
- **Início:** Vertical começa
- **Troca:** Na primeira jogada, Horizontal pode aproveitar a jogada do adversário e forçar troca de orientações
- **Fim:** Perde quem faz a última jogada (jogo misère)

### Implementação Atual (INCORRETA)
- Tabuleiro: 9×9
- Jogadores colocam peças individuais
- Vitória por: 5 em linha OU 5 capturas (estilo Pente)
- Turnos alternados normais

### Alterações Necessárias
- Alterar para tabuleiro 10×10
- Implementar jogadas de segmentos (2+ peças contíguas)
- Adicionar restrição de orientação por jogador
- Implementar regra de troca
- Mudar condição de vitória para misère (última jogada perde)

---

## 2. Dominório

### Regras Oficiais
- **Tabuleiro:** 8×8
- **Jogada:** Colocar peça de dominó (ocupa 2 casas adjacentes ortogonalmente)
- **Restrição:** Um jogador só coloca verticalmente, outro só horizontalmente
- **Início:** Vertical começa
- **Fim:** Perde quem não puder jogar (jogo misère)

### Implementação Atual (INCORRETA)
- Tabuleiro: 5×5
- Cada casa tem valor aleatório 1-6
- Jogadores reclamam pares e somam pontos
- Maior pontuação ganha

### Alterações Necessárias
- Alterar para tabuleiro 8×8
- Remover valores/pontuação das casas
- Implementar restrição de orientação por jogador
- Mudar condição de vitória para misère (quem não pode jogar perde)

---

## 3. Produto

### Regras Oficiais
- **Tabuleiro:** Hexagonal com 5 casas de lado
- **Peças:** 45 brancas e 45 pretas
- **Jogada:** Colocar 2 peças de QUALQUER cor em casas vazias
- **Início:** Pretas começam (primeira jogada apenas 1 peça)
- **Fim:** Quando o tabuleiro estiver cheio
- **Vitória:** Calcula-se o produto dos tamanhos dos 2 maiores grupos de cada cor. Ganha quem tiver maior produto. Se empate, ganha quem tiver menos peças da sua cor.

### Implementação Atual (COMPLETAMENTE ERRADA)
- Tabuleiro: grelha 9×9 de multiplicação
- Jogadores movem factores e marcam células
- Vitória por: 4 em linha

### Alterações Necessárias
- Reimplementar completamente com tabuleiro hexagonal
- Implementar colocação de 2 peças de qualquer cor
- Implementar cálculo de grupos e produto
- Implementar regra de desempate

---

## 4. Gatos & Cães

### Regras Oficiais
- **Tabuleiro:** 8×8
- **Peças:** 28 Gatos e 28 Cães
- **Jogada:** Colocar uma peça sua numa casa vazia
- **Restrições:**
  - Primeiro gato deve ser na zona central (2×2 no meio)
  - Primeiro cão deve ser fora da zona central
  - Não pode colocar gato adjacente a cão (ortogonalmente) nem vice-versa
- **Início:** Gatos começam
- **Fim:** Ganha quem faz a última jogada

### Implementação Atual (INCORRETA)
- Tabuleiro: 6×6
- Vitória por: 4 em linha

### Alterações Necessárias
- Alterar para tabuleiro 8×8
- Implementar zona central
- Implementar restrição de adjacência gato/cão
- Remover lógica de 4 em linha
- Mudar condição de vitória para última jogada ganha

---

## 5. Atari Go

### Regras Oficiais
- **Tabuleiro:** 9×9
- **Grupos:** Conjunto de peças da mesma cor ligadas vertical/horizontalmente
- **Liberdades:** Número de intersecções vazias adjacentes ao grupo
- **Jogada:** Colocar uma peça numa intersecção vazia
- **Restrição:** Não pode colocar peça que deixe o próprio grupo sem liberdades, a não ser que capture
- **Vitória:** Primeiro a capturar ganha

### Implementação Atual (PARCIALMENTE CORRETA)
- Tabuleiro: 9×9 ✓
- Primeira captura ganha ✓
- Lógica de grupos e liberdades ✓
- Verificação de suicídio ✓

### Alterações Necessárias
- Verificar se a implementação está 100% correta
- Possivelmente ajustes menores

---

## 6. Nex

### Regras Oficiais
- **Tabuleiro:** Hexagonal (como ilustrado)
- **Peças:** Brancas, Pretas e Neutras (cinzentas)
- **Jogada:** Uma das seguintes:
  1. Colocar 1 peça da sua cor + 1 peça neutral em casas vazias
  2. Substituir 2 peças neutras por peças da sua cor + substituir 1 peça sua por neutral
- **Troca:** Segundo jogador pode aproveitar jogada do adversário no primeiro lance
- **Vitória:** 
  - Branco ganha se unir margens Sudoeste-Nordeste
  - Negro ganha se unir margens Noroeste-Sudeste

### Implementação Atual (SIMPLIFICADA/INCORRETA)
- Tabuleiro: 11×11
- Apenas 2 tipos de peças (sem neutras)
- Colocação simples de 1 peça
- Swap rule existe
- Player1 liga topo-fundo, Player2 liga esquerda-direita

### Alterações Necessárias
- Adicionar peças neutras
- Implementar os 2 tipos de jogada
- Ajustar condições de vitória para as margens corretas
- Implementar corretamente o tabuleiro hexagonal

---

## Prioridade de Implementação

1. **Gatos & Cães** - Alterações moderadas
2. **Dominório** - Simplificação (remover pontuação)
3. **Quelhas** - Alterações significativas
4. **Atari Go** - Apenas verificação
5. **Nex** - Adicionar complexidade (neutras)
6. **Produto** - Reimplementação completa (hexagonal)
