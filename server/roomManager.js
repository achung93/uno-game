import { generateRoomCode } from './utils/generateRoomCode.js'

export class RoomManager {
  constructor() {
    this.rooms = new Map() // roomCode -> Room object
    this.socketToRoom = new Map() // socketId -> roomCode
  }

  createRoom(socketId, playerName) {
    // Generate unique code
    let code
    do {
      code = generateRoomCode()
    } while (this.rooms.has(code))

    const room = {
      code,
      hostSocketId: socketId,
      players: [
        {
          socketId,
          name: playerName,
          ready: false,
          position: 0
        }
      ],
      status: 'waiting', // 'waiting' | 'playing' | 'finished'
      gameState: null,
      createdAt: Date.now()
    }

    this.rooms.set(code, room)
    this.socketToRoom.set(socketId, code)

    return { roomCode: code, room }
  }

  joinRoom(roomCode, socketId, playerName) {
    const room = this.rooms.get(roomCode.toUpperCase())

    if (!room) {
      return { error: 'Room not found' }
    }

    if (room.status !== 'waiting') {
      return { error: 'Game already in progress' }
    }

    if (room.players.length >= 5) {
      return { error: 'Room is full' }
    }

    // Check if name is taken
    if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      return { error: 'Name already taken in this room' }
    }

    const player = {
      socketId,
      name: playerName,
      ready: false,
      position: room.players.length
    }

    room.players.push(player)
    this.socketToRoom.set(socketId, room.code)

    return { room, player }
  }

  leaveRoom(socketId) {
    const roomCode = this.socketToRoom.get(socketId)
    if (!roomCode) return null

    const room = this.rooms.get(roomCode)
    if (!room) return null

    const playerIndex = room.players.findIndex(p => p.socketId === socketId)
    if (playerIndex === -1) return null

    const leavingPlayer = room.players[playerIndex]
    room.players.splice(playerIndex, 1)
    this.socketToRoom.delete(socketId)

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomCode)
      return { room: null, leavingPlayer, newHost: null }
    }

    // Reassign positions
    room.players.forEach((p, i) => {
      p.position = i
    })

    // If host left, assign new host
    let newHost = null
    if (room.hostSocketId === socketId) {
      room.hostSocketId = room.players[0].socketId
      newHost = room.players[0]
    }

    return { room, leavingPlayer, newHost }
  }

  toggleReady(socketId) {
    const roomCode = this.socketToRoom.get(socketId)
    if (!roomCode) return null

    const room = this.rooms.get(roomCode)
    if (!room || room.status !== 'waiting') return null

    const player = room.players.find(p => p.socketId === socketId)
    if (!player) return null

    player.ready = !player.ready
    return { room, player }
  }

  canStartGame(roomCode) {
    const room = this.rooms.get(roomCode)
    if (!room) return false
    if (room.status !== 'waiting') return false
    if (room.players.length < 2) return false
    // All players must be ready
    return room.players.every(p => p.ready)
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode.toUpperCase())
  }

  getRoomBySocketId(socketId) {
    const roomCode = this.socketToRoom.get(socketId)
    if (!roomCode) return null
    return this.rooms.get(roomCode)
  }

  setGameState(roomCode, gameState) {
    const room = this.rooms.get(roomCode)
    if (room) {
      room.gameState = gameState
      room.status = 'playing'
    }
  }

  endGame(roomCode) {
    const room = this.rooms.get(roomCode)
    if (room) {
      room.status = 'finished'
    }
  }
}
