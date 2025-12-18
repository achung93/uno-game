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

// Broadcast game state to all players in a room
function broadcastGameState(room) {
  if (!room.gameState) return

  for (const player of room.players) {
    const state = room.gameState.getStateForPlayer(player.socketId)
    io.to(player.socketId).emit('game-state', state)
  }
}

// Broadcast room info to all players in a room
function broadcastRoomInfo(room) {
  const roomInfo = {
    code: room.code,
    players: room.players.map(p => ({
      name: p.name,
      position: p.position,
      ready: p.ready,
      isHost: p.socketId === room.hostSocketId
    })),
    status: room.status
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

    // Initialize game
    const gameState = new GameState(room.players)
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
