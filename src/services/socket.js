import { io } from 'socket.io-client'

// In production, connect to same origin (frontend serves from backend)
// In development, connect to localhost:3001
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3001')

export const socket = io(SERVER_URL, {
  autoConnect: false
})

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect()
  }
}

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect()
  }
}
