import { useState } from 'react'
import { socket } from '../../services/socket'

export default function JoinRoom({ onBack }) {
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')

  const handleJoin = (e) => {
    e.preventDefault()
    if (playerName.trim() && roomCode.trim()) {
      socket.emit('join-room', {
        playerName: playerName.trim(),
        roomCode: roomCode.trim().toUpperCase()
      })
    }
  }

  return (
    <div className="lobby-form">
      <h2>Join Game</h2>
      <form onSubmit={handleJoin}>
        <input
          type="text"
          placeholder="Your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <input
          type="text"
          placeholder="Room code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={4}
        />
        <button type="submit" disabled={!playerName.trim() || !roomCode.trim()}>
          Join Room
        </button>
      </form>
      <button type="button" className="back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
