/* ═══════════════════════════════════════════
   LANDING PAGE — landing.js
   Doodles bound in index.html (assets/Images), no server list
   ═══════════════════════════════════════════ */

const avatarGrid       = document.getElementById('avatarGrid');
const avatarError      = document.getElementById('avatarError');
const usernameInput    = document.getElementById('usernameInput');
const charCount        = document.getElementById('charCount');
const usernameError    = document.getElementById('usernameError');
const btnCreate        = document.getElementById('btnCreate');
const btnJoinToggle    = document.getElementById('btnJoinToggle');
const joinPanel        = document.getElementById('joinPanel');
const roomCodeInput    = document.getElementById('roomCodeInput');
const btnJoinGo        = document.getElementById('btnJoinGo');
const toastContainer   = document.getElementById('toastContainer');
const shareLinkSection = document.getElementById('shareLinkSection');
const shareLinkInput   = document.getElementById('shareLinkInput');
const btnCopyLink      = document.getElementById('btnCopyLink');
const btnEnterLobby    = document.getElementById('btnEnterLobby');
const howToPlayOverlay = document.getElementById('howToPlayOverlay');
const btnHowToPlay     = document.getElementById('btnHowToPlay');
const howToPlayClose   = document.getElementById('howToPlayClose');

let selectedAvatar = null;
let joinPanelOpen  = false;
let createdRoomId  = null;

// ── How to play popup: show on first visit, open/close ──
const HOWTO_SEEN_KEY = 'draww-howto-seen';
function openHowToPlay() {
  if (howToPlayOverlay) {
    howToPlayOverlay.classList.add('is-open');
    howToPlayOverlay.setAttribute('aria-hidden', 'false');
    if (howToPlayClose) howToPlayClose.focus();
    document.body.style.overflow = 'hidden';
    if (typeof feather !== 'undefined') feather.replace({ width: 20, height: 20 }, howToPlayOverlay);
  }
}
function closeHowToPlay() {
  if (howToPlayOverlay) {
    howToPlayOverlay.classList.remove('is-open');
    howToPlayOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    localStorage.setItem(HOWTO_SEEN_KEY, '1');
    if (btnHowToPlay) btnHowToPlay.focus();
  }
}
if (btnHowToPlay) btnHowToPlay.addEventListener('click', openHowToPlay);
if (howToPlayClose) howToPlayClose.addEventListener('click', closeHowToPlay);
if (howToPlayOverlay) {
  howToPlayOverlay.addEventListener('click', (e) => { if (e.target === howToPlayOverlay) closeHowToPlay(); });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && howToPlayOverlay && howToPlayOverlay.classList.contains('is-open')) closeHowToPlay();
});
// Show popup on first page load (once per browser)
if (!localStorage.getItem(HOWTO_SEEN_KEY)) {
  setTimeout(openHowToPlay, 600);
}

// ── Avatar selection (cards are in HTML, no API) ──
document.querySelectorAll('.avatar-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    card.querySelector('input[type="radio"]').checked = true;
    selectedAvatar = card.dataset.avatar;
    avatarError.style.display = 'none';
    card.style.transform = 'translateY(-4px) scale(1.08)';
    setTimeout(() => { card.style.transform = 'translateY(-4px)'; }, 200);
  });
});

// ── Username ──
usernameInput.addEventListener('input', () => {
  const len = usernameInput.value.trim().length;
  charCount.textContent = len;
  if (charCount.parentElement) charCount.parentElement.classList.toggle('warn', len > 22);
  if (len >= 1) usernameError.style.display = 'none';
});
usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnCreate.click(); });

// ── Join panel ──
btnJoinToggle.addEventListener('click', () => {
  joinPanelOpen = !joinPanelOpen;
  joinPanel.classList.toggle('open', joinPanelOpen);
  if (joinPanelOpen) setTimeout(() => roomCodeInput.focus(), 300);
});
roomCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnJoinGo.click(); });

// Parse room from pasted link (e.g. http://localhost:3000/?room=factory-xxxx)
function parseRoomFromInput(value) {
  const s = (value || '').trim();
  const match = s.match(/[?&]room=([a-zA-Z0-9-]+)/);
  if (match) return match[1];
  return s.length >= 4 ? s : null;
}

// ── Validation ──
function validate() {
  let ok = true;
  if (!selectedAvatar) {
    avatarError.style.display = 'block';
    avatarGrid.style.animation = 'shake 0.4s ease';
    setTimeout(() => { avatarGrid.style.animation = ''; }, 400);
    ok = false;
  }
  const name = usernameInput.value.trim();
  if (name.length < 1 || name.length > 25) {
    usernameError.style.display = 'block';
    usernameError.textContent = name.length > 25 ? 'Name must be 1–25 characters' : 'Enter your name';
    usernameInput.classList.add('error');
    usernameInput.style.animation = 'shake 0.4s ease';
    setTimeout(() => { usernameInput.style.animation = ''; usernameInput.classList.remove('error'); }, 400);
    ok = false;
  } else {
    usernameError.style.display = 'none';
  }
  return ok;
}

function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function saveSession(roomId, isHost) {
  sessionStorage.setItem('username', usernameInput.value.trim());
  sessionStorage.setItem('avatar', selectedAvatar);
  sessionStorage.setItem('roomId', roomId);
  sessionStorage.setItem('isHost', isHost ? 'true' : 'false');
}

// ── Create Room (show share link + Enter Lobby) ──
btnCreate.addEventListener('click', async () => {
  if (!validate()) return;

  btnCreate.disabled = true;
  const btnText = btnCreate.querySelector('span');
  if (btnText) btnText.textContent = 'Creating...';

  try {
    const res = await fetch('/api/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput.value.trim(), avatar: selectedAvatar })
    });
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    createdRoomId = data.roomId;
    saveSession(data.roomId, true);

    const shareUrl = window.location.origin + window.location.pathname.replace(/\/?$/, '') + '?room=' + data.roomId;
    shareLinkInput.value = shareUrl;
    shareLinkSection.classList.add('open');
    showToast('Room created! Share the link or enter lobby.', 'success');
    if (btnText) btnText.textContent = 'Create Room';
    btnCreate.disabled = false;
    if (typeof feather !== 'undefined') feather.replace({ width: 18, height: 18 });
  } catch (err) {
    showToast('Failed to create room. Is the server running?', 'error');
    btnCreate.disabled = false;
    if (btnText) btnText.textContent = 'Create Room';
  }
});

btnCopyLink.addEventListener('click', () => {
  shareLinkInput.select();
  document.execCommand('copy');
  showToast('Link copied!', 'success', 2000);
});

btnEnterLobby.addEventListener('click', () => {
  if (createdRoomId) window.location.href = 'lobby.html?room=' + createdRoomId;
});

// ── Join Room (accept room code or full URL) ──
btnJoinGo.addEventListener('click', () => {
  if (!validate()) return;
  const roomId = parseRoomFromInput(roomCodeInput.value);
  if (!roomId) {
    showToast('Paste the room link or enter room code', 'error');
    roomCodeInput.classList.add('error');
    setTimeout(() => roomCodeInput.classList.remove('error'), 400);
    return;
  }
  saveSession(roomId, false);
  showToast('Joining room...', 'info');
  window.location.href = 'lobby.html?room=' + roomId;
});

// Direct join via URL
(function checkDirectJoin() {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    joinPanelOpen = true;
    joinPanel.classList.add('open');
    roomCodeInput.value = roomParam;
    showToast('Joining room: ' + roomParam, 'info');
    setTimeout(() => usernameInput.focus(), 300);
  }
})();
