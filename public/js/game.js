/* ═══════════════════════════════════════════════════════════════
   GAME — game.js  (COMPLETE)
   Canvas · Drawing sync · Timer · Word/Hints · Scoreboard ·
   Chat · Guess · Round overlay · Game end → winner.html
   ═══════════════════════════════════════════════════════════════ */

// ── 1. Session ───────────────────────────────────────────────
const username = sessionStorage.getItem('username');
const avatar   = sessionStorage.getItem('avatar');
const roomId   = sessionStorage.getItem('roomId');

if (!username || !roomId) {
  window.location.href = 'index.html';
}

// ── 2. DOM refs ──────────────────────────────────────────────
const canvas           = document.getElementById('drawCanvas');
const ctx              = canvas.getContext('2d');

// Topbar
const roundBadge       = document.getElementById('roundBadge');
const drawerInfo       = document.getElementById('drawerInfo');
const drawerName       = document.getElementById('drawerName');
const wordBlanks       = document.getElementById('wordBlanks');
const wordCategory     = document.getElementById('wordCategory');
const timerDisplay     = document.getElementById('timerDisplay');

// Canvas area
const yourWordBanner   = document.getElementById('yourWordBanner');
const yourWordText     = document.getElementById('yourWordText');
const yourWordCat      = document.getElementById('yourWordCat');
const watchingOverlay  = document.getElementById('watchingOverlay');

// Toolbar
const toolbar          = document.getElementById('toolbar');
const colorGrid        = document.getElementById('colorGrid');
const brushGroup       = document.getElementById('brushGroup');
const btnEraser        = document.getElementById('btnEraser');
const btnClear         = document.getElementById('btnClear');

// Scoreboard
const scoresList       = document.getElementById('scoresList');

// Chat
const chatMessages     = document.getElementById('chatMessages');
const emojiPicker      = document.getElementById('emojiPicker');
const btnEmojiToggle   = document.getElementById('btnEmojiToggle');
const chatInput        = document.getElementById('chatInput');
const btnChatSend      = document.getElementById('btnChatSend');
const inputLabel       = document.getElementById('inputLabel');

// Round overlay
const roundOverlay     = document.getElementById('roundOverlay');
const overlayTitle     = document.getElementById('overlayTitle');
const overlayWord      = document.getElementById('overlayWord');
const overlayScores    = document.getElementById('overlayScores');
const overlayCountdown = document.getElementById('overlayCountdown');

// Toast
const toastContainer   = document.getElementById('toastContainer');

// ── 3. Game state ────────────────────────────────────────────
let isDrawer        = false;
let hasGuessed      = false;
let isDrawing       = false;
let currentColor    = '#000000';
let brushSize       = 4;
let eraserMode      = false;
let lastX           = 0;
let lastY           = 0;
let currentDrawerId = null;
let players         = [];
let prevScores      = {};    // for delta calculation
let overlayTimer    = null;

// ── 4. Canvas setup ─────────────────────────────────────────
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
clearCanvas();

// Responsive canvas: fill entire whiteboard so you can draw everywhere (internal 800x560 for sync)
function resizeCanvas() {
  const wrapper = canvas.parentElement;
  if (!wrapper) return;
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
// When canvas wrapper size changes (e.g. chat/layout), resize so drawing still works
const canvasWrapper = canvas.parentElement;
if (canvasWrapper && typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => resizeCanvas());
  ro.observe(canvasWrapper);
}

// ── 5. Color palette ─────────────────────────────────────────
const COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6',
  '#EC4899', '#92400E', '#6B7280', '#0EA5E9',
  '#39FF14', '#FFE600', '#FF3CAC', '#00D4FF',
];

if (colorGrid) {
  COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (color === '#000000' ? ' selected' : '');
    swatch.style.backgroundColor = color;
    if (color === '#FFFFFF') swatch.style.border = '2px solid #555';
    swatch.title = color;
    swatch.addEventListener('click', () => selectColor(color, swatch));
    colorGrid.appendChild(swatch);
  });
}

function selectColor(color, el) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  if (el) el.classList.add('selected');
  currentColor = color;
  eraserMode   = false;
  if (btnEraser) btnEraser.classList.remove('active');
  canvas.style.cursor = 'crosshair';
}

// ── 6. Brush sizes ───────────────────────────────────────────
if (brushGroup) {
  brushGroup.querySelectorAll('.brush-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      brushGroup.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      brushSize  = parseInt(btn.dataset.size);
      eraserMode = false;
      if (btnEraser) btnEraser.classList.remove('active');
    });
  });
}

// ── 7. Eraser ────────────────────────────────────────────────
if (btnEraser) {
  btnEraser.addEventListener('click', () => {
    if (!isDrawer) return;
    eraserMode = !eraserMode;
    btnEraser.classList.toggle('active', eraserMode);
    canvas.style.cursor = eraserMode ? 'cell' : 'crosshair';
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  });
}

// ── 8. Clear canvas ──────────────────────────────────────────
if (btnClear) {
  btnClear.addEventListener('click', () => {
    if (!isDrawer) return;
    clearCanvas();
    socket.emit('clear-canvas', { roomId });
  });
}

// ── 9. Drawing — mouse ───────────────────────────────────────
function getCanvasPos(e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const src    = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY,
  };
}

function onPointerDown(e) {
  if (!isDrawer) return;
  e.preventDefault();
  isDrawing = true;
  const { x, y } = getCanvasPos(e);
  lastX = x; lastY = y;

  ctx.beginPath();
  ctx.moveTo(x, y);

  socket.emit('draw-stroke', {
    roomId,
    strokeData: { type: 'begin', x, y, color: getDrawColor(), size: getDrawSize() }
  });
}

function onPointerMove(e) {
  if (!isDrawer || !isDrawing) return;
  e.preventDefault();
  const { x, y } = getCanvasPos(e);
  const color     = getDrawColor();
  const size      = getDrawSize();

  applyStroke(lastX, lastY, x, y, color, size);

  socket.emit('draw-stroke', {
    roomId,
    strokeData: { type: 'move', x, y, lx: lastX, ly: lastY, color, size }
  });

  lastX = x; lastY = y;
}

function onPointerUp(e) {
  if (!isDrawer || !isDrawing) return;
  isDrawing = false;
  socket.emit('draw-stroke', { roomId, strokeData: { type: 'end' } });
}

function getDrawColor() { return eraserMode ? '#ffffff' : currentColor; }
function getDrawSize()  { return eraserMode ? brushSize * 3 : brushSize; }

function applyStroke(x1, y1, x2, y2, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = size;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Attach events
canvas.addEventListener('mousedown',  onPointerDown);
canvas.addEventListener('mousemove',  onPointerMove);
canvas.addEventListener('mouseup',    onPointerUp);
canvas.addEventListener('mouseleave', onPointerUp);
canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchmove',  onPointerMove, { passive: false });
canvas.addEventListener('touchend',   onPointerUp);

// ── 10. Emoji picker (Unicode emoji only) ─────────────────────
const CHAT_EMOJI = [
  '😀', '😂', '🎉', '👍', '👏', '✨', '🔥', '❤️', '🎨', '✏️',
  '💡', '🚀', '⭐', '🏆', '👋', '🙌', '💪', '😎', '🤔', '✅',
];

const emojiPickerGrid = document.getElementById('emojiPickerGrid');
if (emojiPickerGrid) {
  CHAT_EMOJI.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn-item';
    btn.textContent = emoji;
    btn.title = 'Insert emoji';
    btn.addEventListener('click', () => {
      if (chatInput) {
        chatInput.value += emoji;
        chatInput.focus();
      }
      if (emojiPicker) emojiPicker.classList.remove('open');
    });
    emojiPickerGrid.appendChild(btn);
  });
}

if (btnEmojiToggle) {
  btnEmojiToggle.addEventListener('click', () => {
    if (emojiPicker) emojiPicker.classList.toggle('open');
  });
}

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
  if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== btnEmojiToggle) {
    emojiPicker.classList.remove('open');
  }
});

// ── 11. Chat & guess ─────────────────────────────────────────
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}
if (btnChatSend) {
  btnChatSend.addEventListener('click', handleSend);
}

function handleSend() {
  if (!chatInput) return;
  const msg = chatInput.value.trim();
  if (!msg) return;
  chatInput.value = '';
  if (emojiPicker) emojiPicker.classList.remove('open');

  if (isDrawer || hasGuessed) {
    // Drawer and already-guessed players can only chat
    socket.emit('send-chat', { roomId, message: msg, username, avatar });
  } else {
    // Active guesser: submit as guess (server checks correctness)
    socket.emit('submit-guess', { roomId, guess: msg, username, avatar });
  }
}

// ── 12. Chat rendering ───────────────────────────────────────
function addChatMsg({ username: u, message, isSystem, avatar: av, feedbackType }) {
  if (!chatMessages) return;

  const div = document.createElement('div');
  div.className = 'chat-msg';

  if (isSystem) {
    const isPartial = feedbackType === 'partial';
    const isWrong = feedbackType === 'wrong';
    const isCorrect = !isPartial && !isWrong && (message.includes('guessed it') || message.includes('correct'));
    const feedbackClass = isCorrect ? ' correct-guess' : isPartial ? ' guess-partial' : isWrong ? ' guess-wrong' : '';
    if (isPartial) div.className += ' chat-msg-feedback-partial';
    if (isWrong) div.className += ' chat-msg-feedback-wrong';
    div.innerHTML = `
      <div class="chat-msg-system${feedbackClass}">
        ${escHtml(message)}
      </div>`;
  } else {
    const imgSrc = av ? `assets/Images/${av}.png` : '';
    const avatarFallback = getAvatarFallbackHtml();
    div.innerHTML = `
      <div class="chat-msg-normal">
        <div class="chat-avatar-dot">
          ${imgSrc
            ? `<img src="${imgSrc}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/><span class="avatar-fallback-icon" style="display:none;">${avatarFallback}</span>`
            : avatarFallback}
        </div>
        <div class="chat-bubble">
          <div class="chat-username">${escHtml(u || 'Player')}</div>
          <div class="chat-text">${escHtml(message)}</div>
        </div>
      </div>`;
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Cap at 120 messages
  while (chatMessages.children.length > 120) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
}

// ── 13. Scoreboard ───────────────────────────────────────────
function renderScores(scores, deltas = {}) {
  if (!scoresList) return;
  scoresList.innerHTML = '';

  scores.forEach((p, i) => {
    const delta = deltas[p.id];
    const gained = delta && delta > 0;
    const item = document.createElement('div');
    item.className = 'score-item'
      + (p.id === currentDrawerId ? ' is-drawing' : '')
      + (p.hasGuessed ? ' correct' : '')
      + (p.id === socket.id ? ' is-you' : '')
      + (gained ? ' score-item-gained' : '');

    // Same doodle as picked on index.html (avatar can be "doo_1.png" or "doo_1")
    const raw = (p.avatar || 'doo_1.png').toString().trim();
    const base = raw.toLowerCase().endsWith('.png') ? raw : raw + '.png';
    const imgSrc = `assets/Images/${base}`;
    const avatarFallback = getAvatarFallbackHtml();

    item.innerHTML = `
      <span class="score-rank">#${i + 1}</span>
      <img class="score-avatar-sm" src="${imgSrc}" alt="${escHtml(p.username)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
      <div class="score-avatar-emoji" style="display:none;">${avatarFallback}</div>
      <div class="score-info">
        <div class="score-name">${escHtml(p.username)}</div>
        <div class="score-pts">${p.score} pts</div>
      </div>
    `;

    // +points badge
    if (delta && delta > 0) {
      const badge = document.createElement('div');
      badge.className   = 'score-delta';
      badge.textContent = `+${delta}`;
      item.appendChild(badge);
      setTimeout(() => badge.remove(), 2000);
    }

    scoresList.appendChild(item);
  });
  if (typeof feather !== 'undefined') feather.replace({ width: 16, height: 16 }, scoresList);
}

// ── 14. Timer display ────────────────────────────────────────
function updateTimer(seconds) {
  if (!timerDisplay) return;
  timerDisplay.textContent = seconds;
  timerDisplay.className   = 'timer-display';
  if (seconds <= 10)       timerDisplay.classList.add('critical');
  else if (seconds <= 20)  timerDisplay.classList.add('warning');
}

// ── 15. Round overlay ────────────────────────────────────────
function showRoundOverlay(word, scores, reason) {
  if (!roundOverlay) return;
  if (overlayTimer) clearInterval(overlayTimer);

  if (overlayTitle)    overlayTitle.innerHTML = reason === 'all-guessed' ? '<i data-feather="award"></i> Everyone Guessed!' : '<i data-feather="clock"></i> Time\'s Up!';
  if (overlayWord)     overlayWord.textContent  = word;

  if (overlayScores) {
    overlayScores.innerHTML = '';
    (scores || []).slice(0, 5).forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'overlay-score-row';
      const rank = i < 3 ? '#' + (i + 1) : '#' + (i + 1);
      row.innerHTML = `
        <span><span class="overlay-rank">${rank}</span> ${escHtml(p.username)}</span>
        <span class="overlay-score-pts">${p.score} pts</span>`;
      overlayScores.appendChild(row);
    });
  }
  if (typeof feather !== 'undefined') feather.replace({ width: 18, height: 18 }, roundOverlay);

  roundOverlay.style.display = 'flex';

  let cd = 4;
  if (overlayCountdown) overlayCountdown.textContent = `Next round in ${cd}...`;

  overlayTimer = setInterval(() => {
    cd--;
    if (overlayCountdown) overlayCountdown.textContent = cd > 0 ? `Next round in ${cd}...` : 'Get ready!';
    if (cd <= 0) {
      clearInterval(overlayTimer);
      roundOverlay.style.display = 'none';
    }
  }, 1000);
}

// ── 16. Set drawer / guesser UI ──────────────────────────────
function setDrawerMode(drawing) {
  isDrawer = drawing;

  // Canvas cursor + interaction
  canvas.style.cursor = drawing ? 'crosshair' : 'default';
  canvas.classList.toggle('readonly', !drawing);

  // Toolbar
  if (toolbar) toolbar.classList.toggle('readonly', !drawing);

  // Your word banner
  if (yourWordBanner)  yourWordBanner.style.display  = drawing ? 'flex' : 'none';
  if (watchingOverlay) watchingOverlay.style.display  = drawing ? 'none' : 'flex';

  // Chat input
  if (chatInput) {
    chatInput.disabled     = false;
    chatInput.placeholder  = drawing
      ? 'Chat (don\'t type the word!)'
      : hasGuessed ? 'Guessed! Keep chatting...' : 'Type your guess...';
  }
  if (inputLabel) {
    inputLabel.textContent = drawing
      ? 'You\'re drawing! Don\'t type the word.'
      : 'Guess the word or chat!';
  }
}

// ── 17. Socket.io ────────────────────────────────────────────
const socket = io();

socket.emit('join-room', { roomId, username, avatar });

// ── Room joined (player list) ──
socket.on('room-joined', ({ players: p }) => {
  players = p || [];
  prevScores = {};
  players.forEach(pl => { prevScores[pl.id] = pl.score || 0; });
  renderScores(players);
});

// ── Catch-up when rejoining during a round (lobby → game.html) ──
socket.on('game-state', ({ roundNumber, totalRounds, drawer, blanks, wordLength, drawTime, timeLeft, scores }) => {
  currentDrawerId = drawer ? drawer.id : null;
  const meDrawing = drawer && drawer.id === socket.id;

  if (roundBadge)  roundBadge.textContent  = `Round ${roundNumber || 1} / ${totalRounds || 3}`;
  if (drawerName)  drawerName.textContent  = drawer ? drawer.username : '—';
  if (wordBlanks)  wordBlanks.textContent  = blanks || (wordLength ? '_ '.repeat(wordLength).trim() : '—');
  if (wordCategory) wordCategory.textContent = wordLength ? `${wordLength} letters` : '—';

  updateTimer(typeof timeLeft === 'number' ? timeLeft : (drawTime || 90));

  if (scores && scores.length) {
    players = players.map(p => {
      const s = scores.find(x => x.id === p.id);
      return s ? { ...p, score: s.score } : p;
    });
    prevScores = {};
    players.forEach(pl => { prevScores[pl.id] = pl.score || 0; });
    renderScores(players);
  }

  setDrawerMode(meDrawing);
  if (meDrawing && yourWordText) yourWordText.textContent = '...';
});

// ── New player joined ──
socket.on('player-joined', (player) => {
  if (!players.find(p => p.id === player.id)) {
    players.push({ ...player, score: 0 });
  }
  renderScores(players);
  addChatMsg({ username: 'SYSTEM', message: `${player.username} joined the game!`, isSystem: true });
});

// ── Player left ──
socket.on('player-left', ({ playerId, username: leftName }) => {
  players = players.filter(p => p.id !== playerId);
  renderScores(players);
  addChatMsg({ username: 'SYSTEM', message: `${leftName || 'A player'} left the game`, isSystem: true });
});

// ── New round starts ──
socket.on('new-round', ({ drawer, roundNumber, totalRounds, blanks, wordLength, drawTime }) => {
  // Reset per-round state
  hasGuessed      = false;
  currentDrawerId = drawer.id;
  const meDrawing = drawer.id === socket.id;

  // Topbar
  if (roundBadge)  roundBadge.textContent  = `Round ${roundNumber} / ${totalRounds}`;
  if (drawerName)  drawerName.textContent   = drawer.username;
  if (wordBlanks)  wordBlanks.textContent   = blanks || '_ '.repeat(wordLength).trim();
  if (wordCategory) wordCategory.textContent = `${wordLength} letters`;

  // Clear canvas for everyone
  clearCanvas();

  // Set drawer/guesser UI
  setDrawerMode(meDrawing);

  // If I'm the drawer, clear my word banner until word-to-draw arrives
  if (meDrawing && yourWordText) yourWordText.textContent = '...';

  // Timer
  updateTimer(drawTime || 90);

  // System chat
  addChatMsg({ username: 'SYSTEM', message: `✏️ ${drawer.username} is now drawing!`, isSystem: true });

  // Mark drawer on scoreboard
  renderScores(players.map(p => ({
    ...p,
    hasGuessed: false,
  })));
});

// ── Word sent only to drawer ──
socket.on('word-to-draw', ({ word, category }) => {
  if (yourWordText)    yourWordText.textContent    = word;
  if (yourWordCat)     yourWordCat.textContent     = `Category: ${category}`;
  if (wordBlanks)      wordBlanks.textContent      = '— You are drawing —';
  if (wordCategory)    wordCategory.textContent    = `Category: ${category}`;
});

// ── Timer tick ──
socket.on('timer-tick', ({ seconds }) => {
  updateTimer(seconds);
});

// ── Hint revealed ──
socket.on('hint-revealed', ({ hint }) => {
  if (!isDrawer && wordBlanks) {
    wordBlanks.textContent = hint;
  }
  addChatMsg({ username: 'SYSTEM', message: `Hint: ${hint}`, isSystem: true });
});

// ── Stroke from another player ──
socket.on('stroke-received', (strokeData) => {
  if (!strokeData) return;
  if (strokeData.type === 'move' && strokeData.lx !== undefined) {
    applyStroke(strokeData.lx, strokeData.ly, strokeData.x, strokeData.y, strokeData.color, strokeData.size);
  } else if (strokeData.type === 'begin') {
    ctx.beginPath();
    ctx.moveTo(strokeData.x, strokeData.y);
  }
});

// ── Canvas cleared by drawer ──
socket.on('canvas-cleared', () => {
  clearCanvas();
});

// ── Chat message ──
socket.on('chat-message', (data) => {
  addChatMsg(data);
});

// ── Guess feedback (only partial; wrong guesses are just chat, no message) ──
socket.on('guess-feedback', ({ type, message }) => {
  if (type !== 'partial') return;
  showToast(message, 'info');
  addChatMsg({ username: 'SYSTEM', message, isSystem: true, feedbackType: 'partial' });
});

// ── Correct guess ──
socket.on('correct-guess', ({ playerId, username: gUser, guesserPoints, speedBonus, scores, word }) => {
  // If it was me
  if (playerId === socket.id) {
    hasGuessed = true;
    if (chatInput) chatInput.placeholder = 'Correct! Keep chatting...';
    if (inputLabel) inputLabel.textContent = 'You got it! Chat freely.';
    showToast(`+${guesserPoints + (speedBonus || 0)} points!`, 'success');
    // Fill the dashes only for the player who guessed correctly
    if (word && wordBlanks) wordBlanks.textContent = word;
  }

  // Calculate deltas
  const deltas = {};
  if (scores) {
    scores.forEach(p => {
      deltas[p.id] = (p.score || 0) - (prevScores[p.id] || 0);
      prevScores[p.id] = p.score || 0;
    });

    // Update local player list scores
    players = players.map(p => {
      const updated = scores.find(s => s.id === p.id);
      return updated ? { ...p, score: updated.score } : p;
    });

    renderScores(scores, deltas);
  }
});

// ── Round ended ──
socket.on('round-ended', ({ word, reason, scores }) => {
  // Fill the word in the top bar so everyone sees the answer
  if (word && wordBlanks) wordBlanks.textContent = word;

  // Drawer saves canvas snapshot
  if (isDrawer) {
    const snap = canvas.toDataURL('image/png');
    socket.emit('save-drawing', { roomId, imageDataURL: snap });
  }

  // Update scores
  if (scores) {
    players = players.map(p => {
      const updated = scores.find(s => s.id === p.id);
      return updated ? { ...p, score: updated.score } : p;
    });
    prevScores = {};
    players.forEach(p => { prevScores[p.id] = p.score || 0; });
  }

  showRoundOverlay(word, scores, reason);
});

// ── Server requests canvas snapshot ──
socket.on('request-snapshot', () => {
  const snap = canvas.toDataURL('image/png');
  socket.emit('save-drawing', { roomId, imageDataURL: snap });
});

// ── Game ended → winner page ──
socket.on('game-ended', ({ winner, finalScores, drawingHistory }) => {
  sessionStorage.setItem('gameResult', JSON.stringify({
    winner,
    finalScores,
    drawingHistory: drawingHistory || [],
  }));
  showToast('Game over! Loading results...', 'success');
  setTimeout(() => { window.location.href = 'winner.html'; }, 1200);
});

// ── Server error ──
socket.on('error', ({ message }) => {
  showToast(message || 'Something went wrong', 'error');
});

// ── 18. Helpers ───────────────────────────────────────────────
function replaceIconCodes(text) {
  return String(text || '').replace(/:([a-z0-9-]+):/g, (_, name) => {
    return `<i data-feather="${escHtml(name)}" class="chat-inline-icon"></i>`;
  });
}

function getAvatarFallbackHtml() {
  return '<i data-feather="user" class="avatar-fallback-svg"></i>';
}

function getEmojiForAvatar(av) {
  return getAvatarFallbackHtml();
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className   = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}