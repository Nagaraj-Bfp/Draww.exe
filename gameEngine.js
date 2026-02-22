/* ═══════════════════════════════════════════
   GAME ENGINE — gameEngine.js
   Room state, turn logic, scoring
   ═══════════════════════════════════════════ */

   const { pickWords } = require('./wordbank');

   const rooms = new Map(); // roomId → roomState
   
   // ── Create Room ──
   function createRoom(roomId) {
     const now = Date.now();
     const room = {
       roomId,
       host: null,
       players: [],          // { id, username, avatar, score, isHost }
       state: 'waiting',     // waiting | playing | roundEnd | gameEnd
       settings: { rounds: 3, drawTime: 90 },
       currentWord: null,
       currentCategory: null,
       currentDrawer: null,
       drawerIndex: 0,
       roundNumber: 0,
       usedWords: [],
       drawingHistory: [],   // { word, category, drawnBy, imageDataURL }
       correctGuessers: [],  // socketIds who guessed correctly this turn
       revealedIndices: [],  // hint positions revealed this turn (cumulative)
       timer: null,
       timeLeft: 90,
       createdAt: now,
       lastActivityAt: now,
     };
     rooms.set(roomId, room);
     return room;
   }
   
   function getRoom(roomId) {
     return rooms.get(roomId);
   }
   
   function deleteRoom(roomId) {
     const room = rooms.get(roomId);
     if (room?.timer) clearInterval(room.timer);
     rooms.delete(roomId);
   }
   
   // ── Players ──
   function addPlayer(roomId, player) {
     const room = getRoom(roomId);
     if (!room) return null;
     if (!room.players.find(p => p.id === player.id)) {
       room.players.push({ ...player, score: 0 });
       if (room.players.length === 1) {
         room.host = player.id;
         room.players[0].isHost = true;
       }
     }
     return room;
   }
   
   function removePlayer(roomId, playerId) {
     const room = getRoom(roomId);
     if (!room) return null;
     room.players = room.players.filter(p => p.id !== playerId);
   
     // Reassign host if needed
     if (room.host === playerId && room.players.length > 0) {
       room.host = room.players[0].id;
       room.players[0].isHost = true;
     }
   
     if (room.players.length === 0) {
       deleteRoom(roomId);
       return null;
     }
     return room;
   }
   
   // ── Start Game ──
   function startGame(room, settings) {
     room.state = 'playing';
     room.settings = { ...room.settings, ...settings };
     room.roundNumber = 0;
     room.drawerIndex = -1;
     room.usedWords = [];
     room.drawingHistory = [];
     // Reset scores
     room.players.forEach(p => { p.score = 0; });
     return nextTurn(room);
   }
   
   // ── Next Turn ──
   function nextTurn(room) {
     if (room.timer) clearInterval(room.timer);
   
     room.drawerIndex = (room.drawerIndex + 1) % room.players.length;
   
     // Check if we've completed a full round
     if (room.drawerIndex === 0) {
       room.roundNumber++;
     } else if (room.roundNumber === 0) {
       room.roundNumber = 1;
     }
   
     // Game over?
     if (room.roundNumber > room.settings.rounds) {
       room.state = 'gameEnd';
       return { gameOver: true };
     }
   
     // Pick word
     const [wordObj] = pickWords(1, room.usedWords);
     room.usedWords.push(wordObj.word);
     room.currentWord     = wordObj.word;
     room.currentCategory = wordObj.category;
     room.currentDrawer   = room.players[room.drawerIndex].id;
     room.correctGuessers = [];
     room.revealedIndices = [];
     room.timeLeft        = room.settings.drawTime;

     return {
       gameOver:    false,
       drawer:      room.players[room.drawerIndex],
       roundNumber: room.roundNumber,
       totalRounds: room.settings.rounds,
       word:        room.currentWord,
       category:    room.currentCategory,
       blanks:      makeBlanks(room.currentWord),
       drawTime:    room.settings.drawTime,
     };
   }
   
   // How many leading characters match (for partial hint)
   function sameStartChars(a, b) {
     let n = 0;
     while (n < a.length && n < b.length && a[n] === b[n]) n++;
     return n;
   }

   // ── Guess ──
   function checkGuess(room, guess, playerId) {
     if (!room.currentWord) return { correct: false };
     if (room.currentDrawer === playerId) return { correct: false }; // drawer can't guess
     if (room.correctGuessers.includes(playerId)) return { correct: false, alreadyGuessed: true };
   
     const g = guess.trim().toLowerCase();
     const w = room.currentWord.toLowerCase();
     const correct = g === w;
     if (!correct) {
       // Partially correct: word contains guess, guess is prefix, or significant overlap
       const partial = (
         (g.length >= 2 && w.includes(g)) ||
         (g.length >= 2 && w.startsWith(g)) ||
         (g.length >= 2 && w.length >= 2 && sameStartChars(g, w) >= 2)
       );
       return { correct: false, partial };
     }
   
     const position = room.correctGuessers.length; // 0-indexed
     room.correctGuessers.push(playerId);
   
     // Points for guesser
     const pointsTable = [100, 75, 50, 25];
     const guesserPoints = pointsTable[Math.min(position, pointsTable.length - 1)];
   
     // Speed bonus
     const speedBonus = room.timeLeft > (room.settings.drawTime - 10) ? 25 : 0;
   
     // Points for drawer
     const drawerPoints = 20;
   
     // Apply points
     const guesser = room.players.find(p => p.id === playerId);
     const drawer  = room.players.find(p => p.id === room.currentDrawer);
     if (guesser) guesser.score += guesserPoints + speedBonus;
     if (drawer)  drawer.score  += drawerPoints;
   
     return {
       correct: true,
       guesserPoints,
       speedBonus,
       drawerPoints,
       allGuessed: room.correctGuessers.length >= room.players.length - 1,
     };
   }
   
   // ── Save drawing ──
   function saveDrawing(room, imageDataURL) {
     room.drawingHistory.push({
       word:        room.currentWord,
       category:    room.currentCategory,
       drawnBy:     room.players.find(p => p.id === room.currentDrawer)?.username || '?',
       imageDataURL,
     });
   }
   
   // ── Scores ──
   function getScores(room) {
     return room.players
       .map(p => ({ id: p.id, username: p.username, avatar: p.avatar, score: p.score }))
       .sort((a, b) => b.score - a.score);
   }
   
   function getWinner(room) {
     const sorted = getScores(room);
     return sorted[0] || null;
   }
   
   // ── Hint reveal (partial letters, cumulative per turn) ──
   function revealHint(room, revealCount) {
     const word = room.currentWord;
     if (!word) return '';

     // Revealable positions (non-space, not yet revealed)
     const allIndices = [];
     for (let i = 0; i < word.length; i++) {
       if (word[i] !== ' ' && !room.revealedIndices.includes(i)) allIndices.push(i);
     }
     const toReveal = Math.min(revealCount, allIndices.length);
     const shuffled = allIndices.sort(() => Math.random() - 0.5).slice(0, toReveal);
     shuffled.forEach(i => room.revealedIndices.push(i));

     return word.split('').map((ch, i) => {
       if (ch === ' ') return ' ';
       if (room.revealedIndices.includes(i)) return ch;
       return '_';
     }).join(' ');
   }
   
   // ── Helpers ──
   function makeBlanks(word) {
     return word.split('').map(ch => ch === ' ' ? '/' : '_').join(' ');
   }
   
   function generateRoomId() {
     const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
     let id = 'F-';
     for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
     return id;
   }
   
   module.exports = {
     rooms,
     createRoom, getRoom, deleteRoom,
     addPlayer, removePlayer,
     startGame, nextTurn,
     checkGuess, saveDrawing,
     getScores, getWinner,
     revealHint, makeBlanks,
     generateRoomId,
   };