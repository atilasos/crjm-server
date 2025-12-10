// ============================================================================
// Admin Panel JavaScript
// ============================================================================

const API_BASE = '/admin/api';

// State
let currentTournamentId = null;
let refreshInterval = null;

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  createForm: document.getElementById('createForm'),
  gameSelect: document.getElementById('gameSelect'),
  labelInput: document.getElementById('labelInput'),
  refreshBtn: document.getElementById('refreshBtn'),
  tournamentList: document.getElementById('tournamentList'),
  tournamentDetails: document.getElementById('tournamentDetails'),
  detailsTitle: document.getElementById('detailsTitle'),
  detailsPhase: document.getElementById('detailsPhase'),
  detailsGameId: document.getElementById('detailsGameId'),
  detailsPlayerCount: document.getElementById('detailsPlayerCount'),
  detailsChampion: document.getElementById('detailsChampion'),
  championRow: document.getElementById('championRow'),
  closeDetailsBtn: document.getElementById('closeDetailsBtn'),
  startTournamentBtn: document.getElementById('startTournamentBtn'),
  finishTournamentBtn: document.getElementById('finishTournamentBtn'),
  exportTournamentBtn: document.getElementById('exportTournamentBtn'),
  playerList: document.getElementById('playerList'),
  winnersMatches: document.getElementById('winnersMatches'),
  losersMatches: document.getElementById('losersMatches'),
  grandFinalMatch: document.getElementById('grandFinalMatch'),
};

// ============================================================================
// API Functions
// ============================================================================

async function fetchTournaments() {
  const res = await fetch(`${API_BASE}/tournaments`);
  return res.json();
}

async function fetchTournamentDetails(id) {
  const res = await fetch(`${API_BASE}/tournaments/${id}`);
  return res.json();
}

async function createTournament(gameId, label) {
  const res = await fetch(`${API_BASE}/tournaments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, label: label || undefined }),
  });
  return res.json();
}

async function startTournament(id) {
  const res = await fetch(`${API_BASE}/tournaments/${id}/start`, { method: 'POST' });
  return res.json();
}

async function finishTournament(id) {
  const res = await fetch(`${API_BASE}/tournaments/${id}/finish`, { method: 'POST' });
  return res.json();
}

async function exportTournament(id) {
  const res = await fetch(`${API_BASE}/tournaments/${id}/export`, { method: 'POST' });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tournament-${id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Render Functions
// ============================================================================

function renderTournamentList(tournaments) {
  if (tournaments.length === 0) {
    elements.tournamentList.innerHTML = '<p class="empty-state">Nenhum campeonato criado ainda.</p>';
    return;
  }

  const html = tournaments.map(t => `
    <div class="tournament-item" data-id="${t.id}">
      <div class="tournament-info">
        <span class="tournament-name">${escapeHtml(t.label || t.gameId)}</span>
        <span class="tournament-meta">${getGameName(t.gameId)} • ${t.playerCount} jogadores</span>
      </div>
      <div class="tournament-status">
        <span class="badge badge-${t.phase}">${getPhaseLabel(t.phase)}</span>
      </div>
    </div>
  `).join('');

  elements.tournamentList.innerHTML = html;

  // Add click handlers
  elements.tournamentList.querySelectorAll('.tournament-item').forEach(item => {
    item.addEventListener('click', () => {
      selectTournament(item.dataset.id);
    });
  });
}

function renderTournamentDetails(state) {
  elements.detailsTitle.textContent = state.label || getGameName(state.gameId);
  elements.detailsPhase.textContent = getPhaseLabel(state.phase);
  elements.detailsPhase.className = `badge badge-${state.phase}`;
  elements.detailsGameId.textContent = getGameName(state.gameId);
  elements.detailsPlayerCount.textContent = state.players.length;

  // Champion
  if (state.championName) {
    elements.championRow.style.display = 'flex';
    elements.detailsChampion.textContent = `🏆 ${state.championName}`;
  } else {
    elements.championRow.style.display = 'none';
  }

  // Button states
  elements.startTournamentBtn.disabled = state.phase !== 'registration' || state.players.length < 2;
  elements.finishTournamentBtn.disabled = state.phase === 'finished';

  // Render players
  renderPlayerList(state.players);

  // Render bracket
  renderBracket(state);

  elements.tournamentDetails.classList.remove('hidden');
}

function renderPlayerList(players) {
  const html = players.map(p => `
    <li class="${p.isOnline ? 'online' : 'offline'}">
      ${escapeHtml(p.name)}${p.classId ? ` <span style="opacity:0.6">(${escapeHtml(p.classId)})</span>` : ''}
    </li>
  `).join('');
  elements.playerList.innerHTML = html || '<li class="empty-state">Sem jogadores inscritos</li>';
}

function renderBracket(state) {
  elements.winnersMatches.innerHTML = renderMatchesList(state.winnersMatches);
  elements.losersMatches.innerHTML = renderMatchesList(state.losersMatches);
  
  const finals = [state.grandFinal, state.grandFinalReset].filter(Boolean);
  elements.grandFinalMatch.innerHTML = finals.length > 0 
    ? renderMatchesList(finals) 
    : '<p class="empty-state" style="font-size: 0.8rem;">A definir</p>';
}

function renderMatchesList(matches) {
  if (!matches || matches.length === 0) {
    return '<p class="empty-state" style="font-size: 0.8rem;">Sem partidas</p>';
  }

  return matches.map(m => `
    <div class="match-card ${m.phase}">
      <div class="match-round">Ronda ${m.round}</div>
      <div class="match-players">
        <div class="match-player ${m.winnerId === m.player1?.id ? 'winner' : ''} ${!m.player1 ? 'tbd' : ''}">
          <span>${m.player1 ? escapeHtml(m.player1.name) : 'TBD'}</span>
          <span class="match-score">${m.score.player1Wins}</span>
        </div>
        <div class="match-player ${m.winnerId === m.player2?.id ? 'winner' : ''} ${!m.player2 ? 'tbd' : ''}">
          <span>${m.player2 ? escapeHtml(m.player2.name) : 'TBD'}</span>
          <span class="match-score">${m.score.player2Wins}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// Event Handlers
// ============================================================================

async function selectTournament(id) {
  currentTournamentId = id;
  const details = await fetchTournamentDetails(id);
  renderTournamentDetails(details);

  // Start auto-refresh when viewing a tournament
  startAutoRefresh();
}

function closeDetails() {
  elements.tournamentDetails.classList.add('hidden');
  currentTournamentId = null;
  stopAutoRefresh();
}

async function handleCreateTournament(e) {
  e.preventDefault();
  const gameId = elements.gameSelect.value;
  const label = elements.labelInput.value.trim();
  
  if (!gameId) {
    alert('Por favor selecione um jogo.');
    return;
  }

  await createTournament(gameId, label);
  elements.createForm.reset();
  await refreshTournamentList();
}

async function handleStartTournament() {
  if (!currentTournamentId) return;
  const result = await startTournament(currentTournamentId);
  if (result.error) {
    alert(`Erro: ${result.error}`);
  } else {
    await refreshCurrentTournament();
    await refreshTournamentList();
  }
}

async function handleFinishTournament() {
  if (!currentTournamentId) return;
  if (!confirm('Tem a certeza que quer terminar o campeonato?')) return;
  await finishTournament(currentTournamentId);
  await refreshCurrentTournament();
  await refreshTournamentList();
}

async function handleExportTournament() {
  if (!currentTournamentId) return;
  await exportTournament(currentTournamentId);
}

// ============================================================================
// Refresh Functions
// ============================================================================

async function refreshTournamentList() {
  const tournaments = await fetchTournaments();
  renderTournamentList(tournaments);
}

async function refreshCurrentTournament() {
  if (!currentTournamentId) return;
  const details = await fetchTournamentDetails(currentTournamentId);
  renderTournamentDetails(details);
}

function startAutoRefresh() {
  stopAutoRefresh();
  refreshInterval = setInterval(refreshCurrentTournament, 3000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getGameName(gameId) {
  const names = {
    'gatos-caes': 'Gatos & Cães',
    'dominorio': 'Dominório',
    'quelhas': 'Quelhas',
    'produto': 'Produto',
    'atari-go': 'Atari Go',
    'nex': 'Nex',
  };
  return names[gameId] || gameId;
}

function getPhaseLabel(phase) {
  const labels = {
    'registration': 'Inscrições',
    'running': 'Em Curso',
    'finished': 'Terminado',
  };
  return labels[phase] || phase;
}

// ============================================================================
// Initialize
// ============================================================================

function init() {
  // Event listeners
  elements.createForm.addEventListener('submit', handleCreateTournament);
  elements.refreshBtn.addEventListener('click', refreshTournamentList);
  elements.closeDetailsBtn.addEventListener('click', closeDetails);
  elements.startTournamentBtn.addEventListener('click', handleStartTournament);
  elements.finishTournamentBtn.addEventListener('click', handleFinishTournament);
  elements.exportTournamentBtn.addEventListener('click', handleExportTournament);

  // Initial load
  refreshTournamentList();
}

// Start the app
init();

