// M8 — Confetti, memory grid rendering
/* ═══════════════════════════════════════════════════════════
   WINNER — winner.js  (COMPLETE)
   Reads gameResult → renders winner + scores + memory grid
   → confetti → Play Again → Save Memory Wall
   ═══════════════════════════════════════════════════════════ */

// ── 1. Load game result from sessionStorage ──────────────────
const roomId = sessionStorage.getItem('roomId');
let result   = null;

try {
  const raw = sessionStorage.getItem('gameResult');
  result = raw ? JSON.parse(raw) : null;
} catch (e) {
  result = null;
}

// Fallback demo data so the page doesn't break if arriving directly
if (!result) {
  result = {
    winner:         { username: 'Champion', avatar: 'doo_1', score: 350 },
    finalScores:    [
      { id: '1', username: 'Champion', avatar: 'doo_1', score: 350 },
      { id: '2', username: 'Player 2', avatar: 'doo_2', score: 225 },
      { id: '3', username: 'Player 3', avatar: 'doo_3', score: 150 },
    ],
    drawingHistory: [],
  };
}

const { winner, finalScores, drawingHistory } = result;

// ── 2. DOM refs ──────────────────────────────────────────────
const winnerTitle     = document.getElementById('winnerTitle');
const winnerSubtitle  = document.getElementById('winnerSubtitle');
const finalScoresList = document.getElementById('finalScoresList');
const memoryGrid      = document.getElementById('memoryGrid');
const btnPlayAgain    = document.getElementById('btnPlayAgain');
const btnSaveGrid     = document.getElementById('btnSaveGrid');

// ── 3. Render winner banner ──────────────────────────────────
if (winnerTitle)    winnerTitle.innerHTML    = `${escHtml(winner.username)} Wins!`;
if (winnerSubtitle) winnerSubtitle.textContent = `${winner.score} points · Factory Champion`;

// ── 4. Render final scoreboard ───────────────────────────────
if (finalScoresList) {
  finalScoresList.innerHTML = '';

  finalScores.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = `final-score-row${i === 0 ? ' winner-row' : ''}`;

    // Use the doodle selected in index.html (avatar may be "doo_1.png" or "doo_1")
    const avatarBase = (p.avatar || '').replace(/\.(png|jpg|jpeg|gif|webp)$/i, '') || 'doo_1';
    const imgSrc = `assets/Images/${avatarBase}.png`;
    const avatarFallback = '<i data-feather="user" class="avatar-fallback-svg"></i>';

    row.innerHTML = `
      <div class="final-rank">#${i + 1}</div>
      <img
        class="final-avatar"
        src="${imgSrc}"
        alt="${escHtml(p.username)}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
      />
      <div class="final-avatar-emoji" style="display:none;">${avatarFallback}</div>
      <div class="final-player-info">
        <div class="final-player-name">${escHtml(p.username)}</div>
        <div class="final-player-pts">${p.score} points total</div>
      </div>
      <div class="final-score-num">${p.score}</div>
    `;

    finalScoresList.appendChild(row);
  });
  if (typeof feather !== 'undefined') feather.replace({ width: 20, height: 20 }, finalScoresList);
}

// ── 5. Render memory grid ────────────────────────────────────
if (memoryGrid) {
  memoryGrid.innerHTML = '';

  if (drawingHistory && drawingHistory.length > 0) {
    drawingHistory.forEach(({ word, category, drawnBy, imageDataURL }) => {
      if (!imageDataURL) return; // skip if no snapshot

      const card = document.createElement('div');
      card.className = 'memory-card';
      card.innerHTML = `
        <img
          class="memory-card-img"
          src="${imageDataURL}"
          alt="Drawing of ${escHtml(word)}"
        />
        <div class="memory-card-info">
          <div class="memory-card-word">📝 ${escHtml(word)}</div>
          <div class="memory-card-artist">✏️ ${escHtml(drawnBy)}</div>
          <div class="memory-card-cat">${escHtml(category || '')}</div>
        </div>
      `;
      memoryGrid.appendChild(card);
    });
  } else {
    // No drawings saved
    memoryGrid.innerHTML = `
      <div style="
        grid-column: 1 / -1;
        text-align: center;
        color: var(--text-muted);
        padding: 48px 24px;
        font-family: var(--font-mono);
        font-size: 0.85rem;
        border: 1px dashed var(--border-dim);
        border-radius: var(--radius-md);
      ">
        🎨 No drawings were saved this session.<br/>
        <span style="font-size:0.75rem; margin-top:8px; display:block;">
          They'll appear here next time once the game completes normally.
        </span>
      </div>
    `;
  }
}

// ── 6. Confetti 🎉 ───────────────────────────────────────────
function fireConfetti() {
  if (typeof confetti === 'undefined') return;

  const colors  = ['#39FF14', '#FFE600', '#FF3CAC', '#00D4FF', '#FF6B35', '#ffffff'];
  const duration = 4500;
  const end      = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      angle:         60,
      spread:        60,
      origin:        { x: 0, y: 0.65 },
      colors,
      ticks:         200,
    });
    confetti({
      particleCount: 5,
      angle:         120,
      spread:        60,
      origin:        { x: 1, y: 0.65 },
      colors,
      ticks:         200,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// Delay slightly so page renders first
setTimeout(fireConfetti, 400);

// ── 7. Play Again ────────────────────────────────────────────
if (btnPlayAgain) {
  btnPlayAgain.addEventListener('click', () => {
    // Clear game result but keep identity + roomId
    sessionStorage.removeItem('gameResult');
    // Go back to lobby (same room, same host status will be re-established)
    if (roomId) {
      window.location.href = `lobby.html?room=${roomId}`;
    } else {
      window.location.href = 'index.html';
    }
  });
}

// ── 8. Save Memory Wall ──────────────────────────────────────
if (btnSaveGrid) {
  btnSaveGrid.addEventListener('click', async () => {
    if (typeof html2canvas === 'undefined') {
      showToast('Screenshot library not loaded yet, try again!', 'error');
      return;
    }

    btnSaveGrid.disabled    = true;
    btnSaveGrid.textContent = '⏳ Capturing...';

    try {
      const target = document.getElementById('memorySection') || document.body;
      const shot   = await html2canvas(target, {
        backgroundColor: '#0D1117',
        scale:           2,
        useCORS:         true,
        logging:         false,
      });

      const link    = document.createElement('a');
      link.download = `hack-the-factory-memory-${Date.now()}.png`;
      link.href     = shot.toDataURL('image/png');
      link.click();

      btnSaveGrid.innerHTML = '<i data-feather="check"></i> Saved!';
      if (typeof feather !== 'undefined') feather.replace({ width: 18, height: 18 }, btnSaveGrid);
      showToast('Memory Wall saved!', 'success');
    } catch (err) {
      console.error('html2canvas error:', err);
      btnSaveGrid.textContent = 'Failed';
      showToast('Could not capture — try a screenshot instead.', 'error');
    } finally {
      setTimeout(() => {
        btnSaveGrid.disabled = false;
        btnSaveGrid.innerHTML = '<i data-feather="download"></i> Save Memory Wall';
        if (typeof feather !== 'undefined') feather.replace({ width: 18, height: 18 }, btnSaveGrid);
      }, 3000);
    }
  });
}

// ── 9. Helpers ───────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className   = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}