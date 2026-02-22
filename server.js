/* ═══════════════════════════════════════════
   SERVER — server.js
   Express + Socket.io backend
   ═══════════════════════════════════════════ */

  require('dotenv').config();
  const express   = require('express');
  const http      = require('http');
  const fs        = require('fs');
  const { Server } = require('socket.io');
  const path      = require('path');
   
   const {
     rooms,
     createRoom, getRoom, deleteRoom,
     addPlayer, removePlayer,
     startGame, nextTurn,
     checkGuess, saveDrawing,
     getScores, getWinner,
     revealHint, makeBlanks,
     generateRoomId,
   } = require('./gameEngine');
   const { startRoomCleanup } = require('./roomCleanup');
   
   const app    = express();
   const server = http.createServer(app);
   const io     = new Server(server, { cors: { origin: '*' } });
   
   const PORT = process.env.PORT || 3000;
   const ROOM_TTL_MINUTES = parseInt(process.env.ROOM_TTL_MINUTES, 10) || 30;
   
  // ── Static files ──
  app.use(express.json());
  // Explicit route for avatar images (avoids path/case issues)
  app.use('/assets/Images', express.static(path.join(__dirname, 'public', 'assets', 'Images')));
  app.use(express.static(path.join(__dirname, 'public')));
   
   // ── REST: Create Room ──
   app.post('/api/create-room', (req, res) => {
     let roomId;
     do { roomId = generateRoomId(); } while (getRoom(roomId));
     createRoom(roomId);
     console.log(`[Room] Created: ${roomId}`);
     res.json({ roomId });
   });
   
  // ── REST: List avatar images from public/assets/Images (exclude background) ──
  const IMAGES_DIR = path.join(__dirname, 'public', 'assets', 'Images');
  const BG_NAMES = ['background', 'bg', 'back'];
  app.get('/api/avatars', (req, res) => {
    try {
      if (!fs.existsSync(IMAGES_DIR)) {
        return res.json({ avatars: [] });
      }
      const files = fs.readdirSync(IMAGES_DIR);
      const avatars = files
        .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
        .filter(f => !BG_NAMES.some(bg => f.toLowerCase().startsWith(bg)));
      res.json({ avatars });
    } catch (e) {
      res.status(500).json({ avatars: [] });
    }
  });

  // ── REST: Check Room exists ──
  app.get('/api/room/:id', (req, res) => {
     const room = getRoom(req.params.id);
     if (!room) return res.status(404).json({ error: 'Room not found' });
     res.json({ exists: true, playerCount: room.players.length, state: room.state });
   });
   
   // ── Socket.io: update room activity on every event ──
   io.on('connection', (socket) => {
     socket.use(([event, ...args], next) => {
       const roomId = socket.data?.roomId;
       if (roomId) {
         const room = getRoom(roomId);
         if (room) room.lastActivityAt = Date.now();
       }
       next();
     });

     console.log(`[Socket] Connected: ${socket.id}`);

     // ── Join Room ──
     socket.on('join-room', ({ roomId, username, avatar, isHost }) => {
       let room = getRoom(roomId);
   
       // Auto-create if joining via link and room doesn't exist
       if (!room) {
         if (isHost) {
           room = createRoom(roomId);
         } else {
           socket.emit('error', { message: 'Room not found! Ask host to create a room first.' });
           return;
         }
       }
   
       // Game already started: allow rejoin if this username is in the room (e.g. lobby → game.html)
       if (room.state !== 'waiting') {
         const existing = room.players.find(p => p.username.toLowerCase() === (username || '').toLowerCase());
         if (!existing) {
           socket.emit('error', { message: 'Game already in progress!' });
           return;
         }
         const oldId = existing.id;
         existing.id = socket.id;
         if (room.host === oldId) room.host = socket.id;
         if (room.currentDrawer === oldId) room.currentDrawer = socket.id;

         socket.join(roomId);
         socket.data = { roomId, username, avatar };
         room.lastActivityAt = Date.now();

         socket.emit('room-joined', {
           players: room.players,
           roomId,
         });

         // Catch-up: current round state so game page can render
         const drawerPlayer = room.players.find(p => p.id === room.currentDrawer);
         socket.emit('game-state', {
           roundNumber:   room.roundNumber,
           totalRounds:  room.settings.rounds,
           drawer:       drawerPlayer ? { id: drawerPlayer.id, username: drawerPlayer.username, avatar: drawerPlayer.avatar } : null,
           blanks:       room.currentWord ? makeBlanks(room.currentWord) : '',
           wordLength:   room.currentWord ? room.currentWord.length : 0,
           drawTime:     room.settings.drawTime,
           timeLeft:     room.timeLeft,
           scores:       getScores(room),
         });
         if (room.currentDrawer === socket.id && room.currentWord) {
           socket.emit('word-to-draw', { word: room.currentWord, category: room.currentCategory });
         }
         console.log(`[Room ${roomId}] ${username} rejoined (game in progress)`);
         return;
       }

       if (room.players.length >= 5) {
         socket.emit('error', { message: 'Room is full (max 5 players)' });
         return;
       }
   
       // Check duplicate username
       if (room.players.find(p => p.username.toLowerCase() === username.toLowerCase())) {
         socket.emit('error', { message: 'Username already taken in this room!' });
         return;
       }
   
       socket.join(roomId);
       socket.data = { roomId, username, avatar };

       const player = { id: socket.id, username, avatar, score: 0, isHost: room.players.length === 0 };
       addPlayer(roomId, player);

       room = getRoom(roomId);
       room.lastActivityAt = Date.now();
   
       // Tell joiner: full player list
       socket.emit('room-joined', {
         players: room.players,
         roomId,
       });
   
       // Tell everyone else: new player
       socket.to(roomId).emit('player-joined', player);
   
       console.log(`[Room ${roomId}] ${username} joined (${room.players.length} players)`);
     });
   
     // ── Start Game ──
     socket.on('start-game', ({ roomId, settings }) => {
       const room = getRoom(roomId);
       if (!room) return;
       if (room.host !== socket.id) {
         socket.emit('error', { message: 'Only the host can start the game' });
         return;
       }
       if (room.players.length < 2) {
         socket.emit('error', { message: 'Need at least 2 players' });
         return;
       }
   
       const turnData = startGame(room, settings);
       console.log(`[Room ${roomId}] Game started! Round 1 drawer: ${turnData.drawer.username}`);
   
       io.to(roomId).emit('game-started', { settings: room.settings });
   
       // Brief delay then start first turn
       setTimeout(() => startTurn(roomId, turnData), 1000);
     });
   
     // ── Drawing: stroke ──
     socket.on('draw-stroke', ({ roomId, strokeData }) => {
       socket.to(roomId).emit('stroke-received', strokeData);
     });
   
     // ── Drawing: clear ──
     socket.on('clear-canvas', ({ roomId }) => {
       socket.to(roomId).emit('canvas-cleared');
     });
   
   // ── Chat: drawer's messages visible to all unless they type the guessing word ──
   socket.on('send-chat', ({ roomId, message, username, avatar }) => {
     const room = getRoom(roomId);
     const payload = {
       username,
       message,
       avatar,
       isSystem: false,
       timestamp: Date.now(),
     };
     const isDrawer = room && room.state === 'playing' && room.currentDrawer === socket.id;
     if (isDrawer && room.currentWord) {
       const normalized = (message || '').trim().toLowerCase();
       const word = room.currentWord.toLowerCase();
       const revealsWord = normalized === word || normalized.includes(word);
       if (revealsWord) {
         // Drawer typed the guessing word: only they see it; others don't
         socket.emit('chat-message', payload);
         return;
       }
     }
     io.to(roomId).emit('chat-message', payload);
   });
   
     // ── Guess ──
     socket.on('submit-guess', ({ roomId, guess, username }) => {
       const room = getRoom(roomId);
       if (!room || room.state !== 'playing') return;
   
       const result = checkGuess(room, guess, socket.id);
   
       if (result.alreadyGuessed) return;
   
      if (!result.correct) {
        // Wrong or partial guess — show in chat as normal message (words/emoji are just chat)
        io.to(roomId).emit('chat-message', {
          username,
          message: guess,
          isSystem: false,
          isGuess: true,
          timestamp: Date.now(),
        });
        // Tell the guesser only when partially correct; say nothing for wrong guesses
        if (result.partial) {
          socket.emit('guess-feedback', {
            type: 'partial',
            message: 'Partially correct! Keep trying.',
          });
        }
        return;
      }
   
       // Correct!
       io.to(roomId).emit('correct-guess', {
         playerId:     socket.id,
         username,
         guesserPoints: result.guesserPoints,
         speedBonus:    result.speedBonus,
         scores:        getScores(room),
         word:          room.currentWord,
       });
   
       io.to(roomId).emit('chat-message', {
         username:  'SYSTEM',
         message:   `🎉 ${username} guessed it! +${result.guesserPoints + result.speedBonus} pts`,
         isSystem:  true,
         timestamp: Date.now(),
       });
   
       // All guessed?
       if (result.allGuessed) {
         endTurn(roomId, 'all-guessed');
       }
     });
   
     // ── Save drawing (called before canvas clear at round end) ──
     socket.on('save-drawing', ({ roomId, imageDataURL }) => {
       const room = getRoom(roomId);
       if (room) saveDrawing(room, imageDataURL);
     });
   
     // ── Disconnect ──
     socket.on('disconnect', () => {
       const { roomId, username } = socket.data || {};
       if (!roomId) return;

       const room = getRoom(roomId);
       if (!room) return;

       // During game, don't remove player — they will rejoin from game.html with same username
       if (room.state === 'playing' || room.state === 'roundEnd' || room.state === 'gameEnd') {
         console.log(`[Socket] Disconnected (game): ${username} from ${roomId} — will rejoin`);
         return;
       }

       const wasHost = room.host === socket.id;
       const roomAfter = removePlayer(roomId, socket.id);
       console.log(`[Socket] Disconnected: ${username} from ${roomId}`);

       if (roomAfter) {
         io.to(roomId).emit('player-left', {
           playerId: socket.id,
           username,
         });

         if (wasHost && roomAfter.players.length > 0) {
           io.to(roomId).emit('host-changed', { newHost: roomAfter.players[0] });
         }
       }
     });
   });
   
   // ── Turn Management ──
   function startTurn(roomId, turnData) {
     const room = getRoom(roomId);
     if (!room || turnData.gameOver) {
       endGame(roomId);
       return;
     }
   
     // Emit new-round to all
     io.to(roomId).emit('new-round', {
       drawer:      { id: turnData.drawer.id, username: turnData.drawer.username, avatar: turnData.drawer.avatar },
       roundNumber: turnData.roundNumber,
       totalRounds: turnData.totalRounds,
       blanks:      turnData.blanks,
       wordLength:  turnData.word.length,
       drawTime:    turnData.drawTime,
     });
   
     // Send the actual word only to the drawer
     io.to(turnData.drawer.id).emit('word-to-draw', {
       word:     turnData.word,
       category: turnData.category,
     });
   
     // Start countdown
     let timeLeft = turnData.drawTime;
     room.timeLeft = timeLeft;
   
     room.timer = setInterval(() => {
       timeLeft--;
       room.timeLeft = timeLeft;
   
       io.to(roomId).emit('timer-tick', { seconds: timeLeft });
   
       // Hint at 50% and 25% time
       if (timeLeft === Math.floor(turnData.drawTime * 0.5)) {
         const hint = revealHint(room, 1);
         io.to(roomId).emit('hint-revealed', { hint });
       }
       if (timeLeft === Math.floor(turnData.drawTime * 0.25)) {
         const hint = revealHint(room, 2);
         io.to(roomId).emit('hint-revealed', { hint });
       }
   
       if (timeLeft <= 0) {
         endTurn(roomId, 'timer');
       }
     }, 1000);
   }
   
   function endTurn(roomId, reason) {
     const room = getRoom(roomId);
     if (!room) return;
     if (room.timer) { clearInterval(room.timer); room.timer = null; }
   
     const word   = room.currentWord;
     const scores = getScores(room);
   
     io.to(roomId).emit('round-ended', {
       word,
       reason,
       scores,
     });
   
     // Snapshot request — drawer's client will save canvas
     io.to(room.currentDrawer).emit('request-snapshot', {});
   
     // Next turn after 4 seconds
     setTimeout(() => {
       const room2 = getRoom(roomId);
       if (!room2) return;
       const nextData = nextTurn(room2);
       if (nextData.gameOver) {
         endGame(roomId);
       } else {
         // Clear canvas for everyone
         io.to(roomId).emit('canvas-cleared');
         startTurn(roomId, nextData);
       }
     }, 4000);
   }
   
   function endGame(roomId) {
     const room = getRoom(roomId);
     if (!room) return;
   
     room.state = 'gameEnd';
     const winner       = getWinner(room);
     const finalScores  = getScores(room);
     const drawingHistory = room.drawingHistory;
   
     io.to(roomId).emit('game-ended', {
       winner,
       finalScores,
       drawingHistory,
     });
   
     console.log(`[Room ${roomId}] Game ended! Winner: ${winner?.username}`);
   
     // Clean up room after 10 minutes
     setTimeout(() => deleteRoom(roomId), 10 * 60 * 1000);
   }
   
   // ── Start Server ──
   startRoomCleanup(rooms, deleteRoom, ROOM_TTL_MINUTES);

   server.listen(PORT, () => {
     console.log(`\n🏭 Hack the Factory server running on http://localhost:${PORT}\n`);
   });