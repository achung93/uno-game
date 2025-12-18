# UNO Card Game

A multiplayer UNO card game supporting 2-4 players with online multiplayer functionality.

---

## Table of Contents

1. [Overview](#overview)
2. [Game Rules](#game-rules)
3. [Features](#features)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Plan](#implementation-plan)
6. [API Design](#api-design)
7. [Data Models](#data-models)
8. [Future Enhancements](#future-enhancements)

---

## Overview

This project implements the classic UNO card game with support for:
- 2-4 players per game
- Local play (single device, hot-seat)
- Online multiplayer via WebSocket connections
- Real-time game state synchronization

---

## Game Rules

### Card Types

| Type | Cards | Description |
|------|-------|-------------|
| **Number Cards** | 0-9 in 4 colors (Red, Yellow, Green, Blue) | One 0 per color, two of each 1-9 per color (76 cards total) |
| **Skip** | 2 per color (8 total) | Next player loses their turn |
| **Reverse** | 2 per color (8 total) | Reverses play direction |
| **Draw Two** | 2 per color (8 total) | Next player draws 2 cards and loses turn |
| **Wild** | 4 total | Can be played on any card; player chooses color |
| **Wild Draw Four** | 4 total | Next player draws 4; player chooses color |

**Total Deck: 108 cards**

### Gameplay

1. Each player starts with 7 cards
2. One card is placed face-up to start the discard pile
3. Players take turns clockwise (or counter-clockwise after Reverse)
4. On your turn, play a card that matches the top discard by:
   - **Color** (Red on Red, etc.)
   - **Number** (7 on 7, etc.)
   - **Symbol** (Skip on Skip, etc.)
   - Or play a **Wild** card
5. If you cannot play, draw one card from the deck
   - If the drawn card is playable, you may play it immediately
6. When you have **one card left**, you must call "UNO!"
   - Failure to call UNO before the next player's turn: draw 2 penalty cards
7. First player to empty their hand wins the round

### Scoring (Optional)

| Card | Points |
|------|--------|
| Number cards (0-9) | Face value |
| Skip, Reverse, Draw Two | 20 points |
| Wild, Wild Draw Four | 50 points |

Winner scores the total points of all cards remaining in opponents' hands.

---

## Features

### Core Features (MVP)

- [ ] **Game Lobby**
  - [ ] Create a new game room
  - [ ] Join existing game room via room code
  - [ ] Display connected players
  - [ ] Host can start the game when 2-4 players are present

- [ ] **Card Management**
  - [ ] Deck initialization and shuffling
  - [ ] Card dealing (7 cards per player)
  - [ ] Draw pile management
  - [ ] Discard pile management
  - [ ] Automatic reshuffling when draw pile is empty

- [ ] **Turn System**
  - [ ] Turn order management (clockwise/counter-clockwise)
  - [ ] Turn timer (optional, 30 seconds default)
  - [ ] Skip turn handling
  - [ ] Reverse direction handling

- [ ] **Card Playing**
  - [ ] Validate card plays (color/number/symbol matching)
  - [ ] Handle special cards (Skip, Reverse, Draw Two)
  - [ ] Handle Wild cards with color selection
  - [ ] Handle Wild Draw Four with color selection
  - [ ] Draw card when no valid play available

- [ ] **UNO Call System**
  - [ ] UNO button when player has 2 cards
  - [ ] Catch opponent who forgot to call UNO
  - [ ] Penalty enforcement (draw 2 cards)

- [ ] **Win Condition**
  - [ ] Detect when a player has no cards
  - [ ] Display winner announcement
  - [ ] Score calculation
  - [ ] Option to play again

### Multiplayer Features

- [ ] **Real-time Synchronization**
  - [ ] WebSocket connection management
  - [ ] Game state broadcasting
  - [ ] Player action synchronization
  - [ ] Reconnection handling

- [ ] **Room Management**
  - [ ] Generate unique room codes
  - [ ] Player join/leave handling
  - [ ] Host migration if host disconnects
  - [ ] Spectator mode (optional)

- [ ] **Chat System** (Optional)
  - [ ] In-game text chat
  - [ ] Quick reactions/emotes

### User Interface

- [ ] **Game Board View**
  - [ ] Player hand display (own cards visible, opponents hidden)
  - [ ] Discard pile (top card visible)
  - [ ] Draw pile
  - [ ] Current player indicator
  - [ ] Play direction indicator
  - [ ] Other players' card counts

- [ ] **Animations**
  - [ ] Card dealing animation
  - [ ] Card play animation
  - [ ] Draw card animation
  - [ ] Shuffle animation
  - [ ] UNO call effect

- [ ] **Sound Effects** (Optional)
  - [ ] Card play sounds
  - [ ] UNO call sound
  - [ ] Win/lose sounds

---

## Technical Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React + JavaScript (Vite) |
| **Styling** | CSS / Tailwind CSS |
| **State Management** | Zustand or React Context |
| **Backend** | Node.js + Express |
| **WebSocket** | Socket.IO |
| **Database** | Redis (for game state) or In-memory |

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │Player 1 │  │Player 2 │  │Player 3 │  │Player 4 │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│       └────────────┴─────┬──────┴────────────┘              │
│                          │                                   │
│                   WebSocket (Socket.IO)                      │
│                          │                                   │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                     GAME SERVER                              │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐          │
│  │              Connection Manager                │          │
│  └───────────────────────┬───────────────────────┘          │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐          │
│  │                Room Manager                    │          │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐       │          │
│  │  │ Room A  │  │ Room B  │  │ Room C  │       │          │
│  │  └─────────┘  └─────────┘  └─────────┘       │          │
│  └───────────────────────┬───────────────────────┘          │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐          │
│  │               Game Engine                      │          │
│  │  • Deck Management                             │          │
│  │  • Turn Logic                                  │          │
│  │  • Rule Validation                             │          │
│  │  • State Management                            │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Project Structure

```
uno-game/
├── public/
│   └── assets/
│       ├── cards/             # Card images
│       └── sounds/            # Sound effects
├── src/
│   ├── components/
│   │   ├── Card.jsx
│   │   ├── Hand.jsx
│   │   ├── Deck.jsx
│   │   ├── DiscardPile.jsx
│   │   ├── PlayerInfo.jsx
│   │   ├── GameBoard.jsx
│   │   ├── Lobby.jsx
│   │   ├── ColorPicker.jsx
│   │   └── UnoButton.jsx
│   ├── hooks/
│   │   ├── useSocket.js
│   │   ├── useGame.js
│   │   └── useAudio.js
│   ├── store/
│   │   └── gameStore.js
│   ├── game/
│   │   ├── Card.js
│   │   ├── Deck.js
│   │   ├── Player.js
│   │   ├── GameState.js
│   │   └── GameEngine.js
│   ├── utils/
│   │   ├── cardUtils.js
│   │   └── validation.js
│   ├── constants/
│   │   └── gameConstants.js
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
│
├── server/                    # Backend Node.js application
│   ├── game/
│   │   ├── Deck.js
│   │   ├── Card.js
│   │   ├── Player.js
│   │   ├── GameState.js
│   │   └── GameEngine.js
│   ├── rooms/
│   │   ├── Room.js
│   │   └── RoomManager.js
│   ├── socket/
│   │   ├── handlers.js
│   │   └── events.js
│   ├── utils/
│   │   └── validation.js
│   ├── index.js
│   └── package.json
│
├── shared/                    # Shared types and constants
│   ├── constants.js
│   └── events.js
│
├── index.html
├── vite.config.js
├── eslint.config.js
├── package.json
└── README.md
```

---

## Implementation Plan

### Phase 1: Project Setup & Core Game Logic

1. **Project Structure Setup**
   - Create folder structure (components, hooks, game, utils, etc.)
   - Install additional dependencies (socket.io-client, zustand)
   - Set up CSS/styling framework

2. **Implement Core Game Classes (Client-side)**
   - Card class (color, value, type)
   - Deck class (shuffle, draw, reset)
   - Player class (hand, score)
   - GameState class (full game state management)
   - GameEngine class (rules, validation, turns)

3. **Unit Tests for Game Logic**
   - Test deck shuffling and dealing
   - Test card validation rules
   - Test special card effects
   - Test win conditions

### Phase 2: Backend Server

1. **Set Up Express Server**
   - Create server directory with Node.js project
   - Basic HTTP server
   - Health check endpoint
   - CORS configuration

2. **Implement Socket.IO Integration**
   - Connection handling
   - Room creation/joining
   - Event handlers for game actions

3. **Room Management**
   - Create room with unique code
   - Join room validation
   - Player disconnect handling
   - Game start conditions

4. **Game Logic on Server**
   - Port game engine to server
   - Server-authoritative game state
   - Action validation

### Phase 3: Frontend - Basic UI

1. **Implement Game Components**
   - Card component with styling (CSS-based cards or images)
   - Hand component (display player's cards)
   - Deck and discard pile components
   - Player info display

2. **Lobby Interface**
   - Home screen with Create/Join options
   - Room code input
   - Player list display
   - Start game button (host only)

3. **Game Board Layout**
   - Central area (draw pile, discard pile)
   - Player positions around the table
   - Current player indicator
   - Direction indicator

### Phase 4: Frontend - Game Integration

1. **Socket Integration**
   - Connect to game server
   - Handle game events
   - Sync game state

2. **Game State Management**
   - Set up Zustand store
   - Handle state updates from server
   - Optimistic UI updates

3. **Interactive Gameplay**
   - Card selection and playing
   - Draw card action
   - Color picker for Wild cards
   - UNO button functionality
   - Turn validation feedback

### Phase 5: Polish & Testing

1. **Animations**
   - Card movement animations (CSS transitions)
   - Deal animation
   - Special card effects

2. **Sound Effects**
   - Add audio files
   - Implement audio hooks
   - Mute/unmute controls

3. **Error Handling**
   - Connection error handling
   - Reconnection logic
   - Invalid action feedback
   - Network timeout handling

4. **End-to-End Testing**
   - Full game flow testing
   - Multiplayer scenarios
   - Edge cases (empty deck, disconnections)

### Phase 6: Deployment

1. **Production Build**
   - Optimize client build
   - Configure production server
   - Environment variables

2. **Deployment**
   - Deploy server (Railway, Render, Fly.io)
   - Deploy client (Vercel, Netlify)
   - WebSocket configuration for production

---

## API Design

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `create_room` | `{ playerName: string }` | Create a new game room |
| `join_room` | `{ roomCode: string, playerName: string }` | Join existing room |
| `leave_room` | `{}` | Leave current room |
| `start_game` | `{}` | Host starts the game |
| `play_card` | `{ cardId: string, chosenColor?: string }` | Play a card |
| `draw_card` | `{}` | Draw a card from deck |
| `call_uno` | `{}` | Call UNO |
| `catch_uno` | `{ targetPlayerId: string }` | Catch player who forgot UNO |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room_created` | `{ roomCode: string }` | Room successfully created |
| `room_joined` | `{ room: RoomState }` | Successfully joined room |
| `player_joined` | `{ player: Player }` | New player joined |
| `player_left` | `{ playerId: string }` | Player left the room |
| `game_started` | `{ gameState: GameState }` | Game has started |
| `game_state_update` | `{ gameState: GameState }` | Game state changed |
| `card_played` | `{ playerId: string, card: Card }` | A card was played |
| `card_drawn` | `{ playerId: string, count: number }` | Cards were drawn |
| `turn_changed` | `{ currentPlayerId: string }` | Turn changed |
| `uno_called` | `{ playerId: string }` | Player called UNO |
| `uno_caught` | `{ playerId: string }` | Player was caught |
| `game_over` | `{ winnerId: string, scores: Score[] }` | Game ended |
| `error` | `{ message: string, code: string }` | Error occurred |

---

## Data Models

### Card

```javascript
{
  id: string,           // Unique identifier (e.g., "red-7-1")
  type: string,         // 'number' | 'skip' | 'reverse' | 'draw_two' | 'wild' | 'wild_draw_four'
  color: string | null, // 'red' | 'yellow' | 'green' | 'blue' | null (for wild cards)
  value: number | null  // 0-9 for number cards, null for special
}
```

### Player

```javascript
{
  id: string,
  name: string,
  hand: Card[],
  isHost: boolean,
  isConnected: boolean,
  hasCalledUno: boolean
}
```

### GameState

```javascript
{
  id: string,
  status: string,           // 'waiting' | 'playing' | 'finished'
  players: Player[],
  currentPlayerIndex: number,
  direction: number,        // 1 = clockwise, -1 = counter-clockwise
  drawPile: Card[],
  discardPile: Card[],
  currentColor: string,     // Active color (important for wild cards)
  winner: string | null
}
```

### Room

```javascript
{
  code: string,
  hostId: string,
  players: Player[],
  gameState: GameState | null,
  createdAt: Date
}
```

---

## Future Enhancements

- [ ] **House Rules Support**
  - Stacking Draw cards
  - Jump-in rule (play identical card out of turn)
  - 7-0 rule (swap hands)

- [ ] **Player Accounts**
  - User authentication
  - Game history
  - Statistics tracking
  - Leaderboards

- [ ] **AI Players**
  - Single-player mode with bots
  - Difficulty levels

- [ ] **Mobile Support**
  - Responsive design
  - Touch-friendly controls
  - PWA support

- [ ] **Private Rooms**
  - Password-protected rooms
  - Friends list
  - Invite links

- [ ] **Customization**
  - Custom card themes
  - Avatar selection
  - Table themes

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd uno-game

# Install client dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### Development

```bash
# Start the client (from root directory)
npm run dev

# Start the server (in another terminal)
cd server
npm run dev
```

### Production Build

```bash
# Build the client
npm run build

# Start production server
cd server
npm start
```

---

## License

MIT License
