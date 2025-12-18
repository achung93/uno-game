import { useState } from 'react'
import { socket } from '../../services/socket'

export default function CreateRoom({ onBack }) {
  const [playerName, setPlayerName] = useState('')

  const handleCreate = (e) => {
    e.preventDefault()
    if (playerName.trim()) {
      socket.emit('create-room', { playerName: playerName.trim() })
    }
  }

  return (
    <div className="lobby-form">
      <h2>Create Game</h2>
      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <button type="submit" disabled={!playerName.trim()}>
          Create Room
        </button>
      </form>
      <button type="button" className="back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
