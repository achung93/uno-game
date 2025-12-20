import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import process from 'node:process'
import { RoomManager } from './roomManager.js'
import { GameState } from './gameState.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())

// Serve static files from the frontend build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
}

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
})

const roomManager = new RoomManager()

// Per-room turn timers (auto-draw when player times out)
const turnTimers = new Map() // roomCode -> timeoutId

function clearTurnTimer(room) {
  if (!room) return
  const t = turnTimers.get(room.code)
  if (t) {
    clearTimeout(t)
    turnTimers.delete(room.code)
  }
}

function scheduleTurnTimer(room, duration = 10000) {
  clearTurnTimer(room)
  if (!room || room.status !== 'playing' || !room.gameState) return
  const gs = room.gameState
  // don't auto-timer while waiting for color selection
  if (gs.pendingWild) return
  if (gs.winner) return

  const currentPlayer = gs.players[gs.currentTurn]
  if (!currentPlayer) return
  const socketId = currentPlayer.socketId

  // notify player that their timer started
  io.to(socketId).emit('turn-timer-start', { duration })

  const timer = setTimeout(() => {
    // re-check current turn hasn't changed
    const gsNow = room.gameState
    if (!gsNow) return
    const curr = gsNow.players[gsNow.currentTurn]
    if (!curr || curr.socketId !== socketId) return

    // perform auto-draw for the player who timed out
    const result = gsNow.drawCard(socketId)
    if (result.error) {
      io.to(socketId).emit('error', { message: result.error })
    } else {
      // let the player know what was drawn
      io.to(socketId).emit('auto-draw', { card: result.card })
      // broadcast updated game state to all players
      broadcastGameState(room)
    }
  }, duration)

  turnTimers.set(room.code, timer)
}

// Broadcast game state to all players in a room
function broadcastGameState(room) {
  if (!room.gameState) return

  for (const player of room.players) {
    const state = room.gameState.getStateForPlayer(player.socketId)
    io.to(player.socketId).emit('game-state', state)
  }
  // Schedule a turn timer for the active player (server enforces timeout)
  scheduleTurnTimer(room)
}

// Broadcast room info to all players in a room
function broadcastRoomInfo(room) {
  const roomInfo = {
    code: room.code,
    players: room.players.map(p => ({
      name: p.name,
      position: p.position,
      ready: p.ready,
      isHost: p.socketId === room.hostSocketId,
      team: p.team
    })),
    status: room.status,
    teamMode: room.teamMode
  }

  for (const player of room.players) {
    io.to(player.socketId).emit('room-update', {
      ...roomInfo,
      isHost: player.socketId === room.hostSocketId
    })
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Create a new room
  socket.on('create-room', ({ playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      socket.emit('error', { message: 'Player name is required' })
      return
    }

    const { roomCode, room } = roomManager.createRoom(socket.id, playerName.trim())
    socket.emit('room-created', { roomCode })
    broadcastRoomInfo(room)
  })

  // Join an existing room
  socket.on('join-room', ({ roomCode, playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      socket.emit('error', { message: 'Player name is required' })
      return
    }

    if (!roomCode || roomCode.trim().length === 0) {
      socket.emit('error', { message: 'Room code is required' })
      return
    }

    const result = roomManager.joinRoom(roomCode.trim(), socket.id, playerName.trim())

    if (result.error) {
      socket.emit('error', { message: result.error })
      return
    }

    socket.emit('room-joined', { roomCode: result.room.code })
    broadcastRoomInfo(result.room)
  })

  // Leave current room
  socket.on('leave-room', () => {
    const result = roomManager.leaveRoom(socket.id)
    if (!result) return

    socket.emit('room-left')

    if (result.room) {
      broadcastRoomInfo(result.room)
    }
  })

  // Toggle ready status
  socket.on('toggle-ready', () => {
    const result = roomManager.toggleReady(socket.id)
    if (!result) return

    broadcastRoomInfo(result.room)
  })

  // Toggle team mode (host only)
  socket.on('toggle-team-mode', () => {
    const result = roomManager.toggleTeamMode(socket.id)
    if (!result) return

    broadcastRoomInfo(result.room)
  })

  // Select team
  socket.on('select-team', ({ team }) => {
    const result = roomManager.setTeam(socket.id, team)
    if (!result) return

    if (result.error) {
      socket.emit('error', { message: result.error })
      return
    }

    broadcastRoomInfo(result.room)
  })

  // Start game (host only)
  socket.on('start-game', () => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room) {
      socket.emit('error', { message: 'Not in a room' })
      return
    }

    if (room.hostSocketId !== socket.id) {
      socket.emit('error', { message: 'Only host can start the game' })
      return
    }

    if (!roomManager.canStartGame(room.code)) {
      socket.emit('error', { message: 'Not all players are ready' })
      return
    }

    // Initialize game with team mode settings
    const gameState = new GameState(room.players, room.teamMode)
    gameState.initialize()
    console.log('Game initialized. Top discard:', gameState.discard)
    roomManager.setGameState(room.code, gameState)

    // Notify all players game is starting
    for (const player of room.players) {
      io.to(player.socketId).emit('game-started')
    }

    broadcastGameState(room)
  })

  // Play a card
  socket.on('play-card', ({ cardIndex }) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room || room.status !== 'playing') {
      socket.emit('error', { message: 'Not in an active game' })
      return
    }

    const result = room.gameState.playCard(socket.id, cardIndex)

    if (result.error) {
      socket.emit('error', { message: result.error })
      return
    }

    // Clear timer when a card is played
    clearTurnTimer(room)

    // Broadcast card-played event to all players for animation
    if (result.playedCard) {
      for (const player of room.players) {
        io.to(player.socketId).emit('card-played', {
          card: result.playedCard,
          playerPosition: result.playerPosition
        })
      }
    }

    if (result.winner) {
      roomManager.endGame(room.code)
    }

    broadcastGameState(room)
  })

  // Draw a card
  socket.on('draw-card', () => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room || room.status !== 'playing') {
      socket.emit('error', { message: 'Not in an active game' })
      return
    }

    const result = room.gameState.drawCard(socket.id)

    if (result.error) {
      socket.emit('error', { message: result.error })
      return
    }

    // Clear timer while processing
    clearTurnTimer(room)

    // Broadcast card-drawn event to all players for animation
    for (const player of room.players) {
      io.to(player.socketId).emit('card-drawn', {
        count: result.count,
        playerPosition: result.playerPosition
      })
    }

    broadcastGameState(room)
  })

  // Select color for wild card
  socket.on('select-color', ({ color }) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room || room.status !== 'playing') {
      socket.emit('error', { message: 'Not in an active game' })
      return
    }

    const result = room.gameState.selectColor(socket.id, color)

    if (result.error) {
      socket.emit('error', { message: result.error })
      return
    }

        // clear timer while processing selection
        clearTurnTimer(room)
    broadcastGameState(room)
  })

  // Call UNO
  socket.on('call-uno', () => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room || room.status !== 'playing') {
      socket.emit('error', { message: 'Not in an active game' })
      return
    }

    const result = room.gameState.callUno(socket.id)

    if (result.error) {
      socket.emit('error', { message: result.error })
      return
    }

    // Notify all players that someone called UNO
    const player = room.players.find(p => p.socketId === socket.id)
    for (const p of room.players) {
      io.to(p.socketId).emit('uno-called', { playerName: player.name })
    }

    broadcastGameState(room)
  })

  // Catch someone who didn't call UNO
  socket.on('catch-uno', ({ targetSocketId }) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room || room.status !== 'playing') {
      socket.emit('error', { message: 'Not in an active game' })
      return
    }

    const result = room.gameState.catchUno(socket.id, targetSocketId)

    if (result.error) {
      socket.emit('error', { message: result.error })
      return
    }

    // Notify all players about the catch
    const catcher = room.players.find(p => p.socketId === socket.id)
    const target = room.players.find(p => p.socketId === targetSocketId)
    for (const p of room.players) {
      io.to(p.socketId).emit('uno-caught', {
        catcherName: catcher.name,
        targetName: target.name
      })
    }

    broadcastGameState(room)
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)

    const result = roomManager.leaveRoom(socket.id)
    if (result && result.room) {
      // Notify remaining players
      if (result.room.status === 'playing') {
        // End game if someone disconnects during play
        roomManager.endGame(result.room.code)
        for (const player of result.room.players) {
          io.to(player.socketId).emit('player-disconnected', {
            playerName: result.leavingPlayer.name
          })
        }
      } else {
        broadcastRoomInfo(result.room)
      }
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
})
