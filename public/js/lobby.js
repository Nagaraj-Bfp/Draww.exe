// M3 — Lobby socket events, player list
/* ═══════════════════════════════════════════════════════════
   LOBBY — lobby.js  (COMPLETE)
   Reads session → connects socket → renders players →
   host starts game → everyone redirects to game.html
   ═══════════════════════════════════════════════════════════ */

// ── 1. Read session ──────────────────────────────────────────
const username = sessionStorage.getItem('username');
const avatar   = sessionStorage.getItem('avatar');
const isHost   = sessionStorage.getItem('isHost') === 'true';
const params   = new URLSearchParams(window.location.search);
const roomId   = params.get('room') || sessionStorage.getItem('roomId');

// Guard: no session = back to landing
if (!username || !avatar || !roomId) {
  window.location.href = 'index.html';
}

// Always persist roomId (in case user arrived via share link)
sessionStorage.setItem('roomId', roomId);

// ── 2. DOM refs ──────────────────────────────────────────────
const roomIdDisplay    = document.getElementById('roomIdDisplay');
const shareLinkText    = document.getElementById('shareLinkText');
const btnCopy          = document.getElementById('btnCopy');
const playersGrid      = document.getElementById('playersGrid');
const playerCountBadge = document.getElementById('playerCountBadge');
const hostSettings     = document.getElementById('hostSettings');
const hostControls     = document.getElementById('hostControls');
const guestControls    = document.getElementById('guestControls');
const btnStart         = document.getElementById('btnStart');
const minPlayerWarn    = document.getElementById('minPlayerWarn');
const roundsSelect     = document.getElementById('roundsSelect');
const timerSelect      = document.getElementById('timerSelect');
const toastContainer   = document.getElementById('toastContainer');

// ── 3. Share link ────────────────────────────────────────────
const shareLink = `${window.location.origin}/index.html?room=${roomId}`;

if (roomIdDisplay) roomIdDisplay.textContent = `Room: ${roomId}`;
if (shareLinkText) shareLinkText.textContent  = shareLink;

// ── 4. Show host vs guest controls ──────────────────────────
if (isHost) {
  if (hostControls)  hostControls.style.display  = 'block';
  if (hostSettings)  hostSettings.style.display   = 'flex';
  if (guestControls) guestControls.style.display  = 'none';
} else {
  if (hostControls)  hostControls.style.display   = 'none';
  if (guestControls) guestControls.style.display  = 'block';
  if (hostSettings)  hostSettings.style.display    = 'none';
}

// ── 5. Copy share link ───────────────────────────────────────
if (btnCopy) {
  btnCopy.addEventListener('click', () => {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareLink).then(onCopied).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  });
}

function onCopied() {
  if (!btnCopy) return;
  btnCopy.innerHTML = '<i data-feather="check"></i> Copied!';
  if (typeof feather !== 'undefined') feather.replace({ width: 16, height: 16 }, btnCopy);
  btnCopy.classList.add('copied');
  showToast('Invite link copied! Share it with friends.', 'success');
  setTimeout(() => {
    btnCopy.innerHTML = '<i data-feather="copy"></i> Copy';
    if (typeof feather !== 'undefined') feather.replace({ width: 16, height: 16 }, btnCopy);
    btnCopy.classList.remove('copied');
  }, 2500);
}

function fallbackCopy() {
  const ta = document.createElement('textarea');
  ta.value = shareLink;
  ta.style.position = 'fixed';
  ta.style.opacity  = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); onCopied(); } catch (e) { showToast('Copy manually: ' + shareLink, 'error', 6000); }
  document.body.removeChild(ta);
}

// ── 6. Socket.io ─────────────────────────────────────────────
const socket = io();
let players  = [];

// Join the room immediately
socket.emit('join-room', { roomId, username, avatar, isHost });

// ── 7. Socket events ─────────────────────────────────────────

// Server sends full player list when we join successfully
socket.on('room-joined', ({ players: serverPlayers }) => {
  players = serverPlayers || [];
  renderPlayers();
  showToast(`You're in! Room ${roomId}`, 'success');
});

// A new player just joined
socket.on('player-joined', (player) => {
  // Avoid duplicates
  if (!players.find(p => p.id === player.id)) {
    players.push({ ...player, score: 0 });
    renderPlayers();
    showToast(`${player.username} entered the factory!`, 'info');
  }
});

// A player left
socket.on('player-left', ({ playerId, username: leftName }) => {
  players = players.filter(p => p.id !== playerId);
  renderPlayers();
  showToast(`${leftName || 'Someone'} left the lobby`, 'info');
});

// Host left — server reassigned host; update UI and show Start for new host
socket.on('host-changed', ({ newHost }) => {
  if (!newHost) return;
  players = players.map(p => ({ ...p, isHost: p.id === newHost.id }));
  renderPlayers();

  if (socket.id === newHost.id) {
    sessionStorage.setItem('isHost', 'true');
    if (hostControls) hostControls.style.display = 'block';
    if (hostSettings) hostSettings.style.display = 'flex';
    if (guestControls) guestControls.style.display = 'none';
    if (btnStart) {
      btnStart.disabled = players.length < 2;
      btnStart.innerHTML = '<i data-feather="play"></i> Start the Game!';
      if (typeof feather !== 'undefined') feather.replace({ width: 18, height: 18 }, btnStart);
    }
    showToast("You're now the host! You can start the game.", 'success');
  } else {
    sessionStorage.setItem('isHost', 'false');
    if (hostControls) hostControls.style.display = 'none';
    if (guestControls) guestControls.style.display = 'block';
    if (hostSettings) hostSettings.style.display = 'none';
  }
});

// Host started — everyone redirects
socket.on('game-started', ({ settings }) => {
  // Save game settings so game.js can read them
  sessionStorage.setItem('totalRounds', settings?.rounds   ?? 3);
  sessionStorage.setItem('drawTime',    settings?.drawTime ?? 90);
  showToast('Game is starting!', 'success');
  setTimeout(() => { window.location.href = 'game.html'; }, 700);
});

// Server error (room full, already started, etc.)
socket.on('error', ({ message }) => {
  showToast(message || 'Something went wrong', 'error');
  // Re-enable start button if it was locked
  if (btnStart && isHost) {
    btnStart.disabled    = players.length < 2;
    btnStart.innerHTML = '<i data-feather="play"></i> Start the Game!';
    if (typeof feather !== 'undefined') feather.replace({ width: 18, height: 18 }, btnStart);
  }
});

// ── 8. Start game (host only) ────────────────────────────────
if (btnStart) {
  btnStart.addEventListener('click', () => {
    if (btnStart.disabled) return;
    btnStart.disabled = true;
    btnStart.innerHTML = '<i data-feather="loader" class="spin"></i> Launching...';
    if (typeof feather !== 'undefined') feather.replace({ width: 18, height: 18 }, btnStart);

    socket.emit('start-game', {
      roomId,
      settings: {
        rounds:   parseInt(roundsSelect?.value  ?? '3'),
        drawTime: parseInt(timerSelect?.value   ?? '90'),
      }
    });
  });
}

// ── 9. Render player cards ───────────────────────────────────
function renderPlayers() {
  if (!playersGrid) return;
  playersGrid.innerHTML = '';

  // Update count badge
  if (playerCountBadge) {
    playerCountBadge.textContent = `${players.length} / 5 players`;
  }

  // Filled slots
  players.forEach((p, i) => {
    const slot = document.createElement('div');
    slot.className = `player-slot${p.isHost ? ' is-host' : ''}`;
    slot.style.animationDelay = `${i * 0.07}s`;

    // Avatar image — falls back to Feather user icon if image missing
    const imgSrc = `assets/Images/${p.avatar}.png`;
    const avatarFallback = '<i data-feather="user" class="avatar-fallback-svg"></i>';

    slot.innerHTML = `
      <div class="player-avatar-wrap">
        <img
          class="player-avatar"
          src="${imgSrc}"
          alt="${escHtml(p.username)}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
        />
        <div class="player-avatar-emoji" style="display:none;">${avatarFallback}</div>
        <span class="online-dot"></span>
      </div>
      <div class="player-name">${escHtml(p.username)}</div>
      <div class="host-crown" style="font-size:0.68rem; color:${p.isHost ? 'var(--neon-yellow)' : 'var(--neon-blue)'};">
        ${p.isHost ? '<i data-feather="award" style="width:10px;height:10px;vertical-align:middle;"></i> Host' : 'Player'}
      </div>
    `;
    playersGrid.appendChild(slot);
  });

  // Empty placeholder slots (up to 5 total)
  const emptyCount = Math.max(0, 5 - players.length);
  for (let i = 0; i < emptyCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'player-slot-empty';
    slot.innerHTML = `
      <div class="empty-slot-icon"><i data-feather="user"></i></div>
      <div class="empty-slot-text">Waiting...</div>
    `;
    playersGrid.appendChild(slot);
  }
  if (typeof feather !== 'undefined') feather.replace({ width: 20, height: 20 }, playersGrid);

  // Update start button state (host only)
  if (isHost && btnStart) {
    const canStart = players.length >= 2;
    btnStart.disabled = !canStart;
    if (minPlayerWarn) {
      minPlayerWarn.style.display = canStart ? 'none' : 'flex';
    }
  }
}

// ── 10. Conveyor belt terms ───────────────────────────────────
(function buildConveyor() {
  const track = document.getElementById('conveyorTrack');
  if (!track) return;

  const terms = [
    'FastAPI','Docker','Pull Request','LLM','CI/CD','Figma',
    'Sprint','Webhook','Redis','Debug','Standup','Merge Conflict',
    'Prompt Engineering','Agile','Hotfix','Microservice','Backlog',
    'Kanban','OKR','Tech Debt','Ship It','Vibe Code','RAG','GPT',
  ];

  // Double for seamless loop
  [...terms, ...terms].forEach(t => {
    const item = document.createElement('div');
    item.className = 'conveyor-item';
    item.textContent = t;
    track.appendChild(item);
  });
})();

// ── 11. Helpers ───────────────────────────────────────────────

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}