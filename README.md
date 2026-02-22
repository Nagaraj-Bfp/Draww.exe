# Hack the Factory: Sketch the System

Real-time multiplayer drawing + guessing game. Draw internal tech terms, teammates guess.

**Players:** 2–5 · **Round:** 90s · **Stack:** Node, Express, Socket.io, vanilla HTML/CSS/JS

---

## File structure

```
├── public/                     # Frontend (served statically)
│   ├── index.html              # Landing (avatar + username)
│   ├── lobby.html              # Lobby waiting room
│   ├── game.html               # Main game screen
│   ├── winner.html             # Winner + Memory Grid
│   ├── css/
│   │   ├── global.css          # Fonts, variables, resets
│   │   ├── landing.css         # Landing styles
│   │   ├── lobby.css           # Lobby styles
│   │   ├── game.css            # Game screen styles
│   │   └── winner.css          # Winner screen styles
│   ├── js/
│   │   ├── landing.js          # Avatar, username, room create/join
│   │   ├── lobby.js            # Lobby socket events, player list
│   │   ├── game.js             # Canvas, tools, timer, chat, guessing
│   │   └── winner.js           # Confetti, memory grid
│   └── assets/
│       ├── Images/              # Avatar images (any .png/.jpg/.webp/.gif); optional background.png or background.jpg for landing
│       ├── sounds/             # Optional: tick.mp3, correct.mp3, round-end.mp3
│       └── icons/               # Favicon, logo
│
├── server.js                   # Express + Socket.io backend
├── gameEngine.js               # Room state, turn logic, scoring
├── wordbank.js                 # Bipolar Factory terms + categories
├── package.json
├── .env                        # PORT, ROOM_EXPIRY
└── README.md
```

---

## Setup

```bash
npm install
npm run dev
```

Open **http://localhost:3000**

See `plan.md` for the full blueprint and module checklist.
