import { socket } from '../../services/socket'

export default function WaitingRoom({ roomInfo, onLeave }) {
  const handleToggleReady = () => {
    socket.emit('toggle-ready')
  }

  const handleStartGame = () => {
    socket.emit('start-game')
  }

  const handleLeave = () => {
    socket.emit('leave-room')
    onLeave()
  }

  const canStart = roomInfo.players.length >= 1
  const myPlayer = roomInfo.players.find(p => p.isHost === roomInfo.isHost) || roomInfo.players[0]

  return (
    <div className="waiting-room">
      <h2>Room: {roomInfo.code}</h2>
      <p className="room-code-hint">Share this code with friends to join!</p>

      <div className="players-list">
        <h3>Players ({roomInfo.players.length}/4)</h3>
        {roomInfo.players.map((player, index) => (
          <div key={index} className={`player-row ${player.ready ? 'ready' : ''}`}>
            <span className="player-name">
              {player.name}
              {player.isHost && <span className="host-badge"> (Host)</span>}
            </span>
            <span className={`ready-status ${player.ready ? 'ready' : 'not-ready'}`}>
              {player.ready ? 'Ready' : 'Not Ready'}
            </span>
          </div>
        ))}
      </div>

      <div className="waiting-actions">
        <button type="button" onClick={handleToggleReady}>
          {roomInfo.players.find(p => p.isHost === roomInfo.isHost)?.ready ? 'Not Ready' : 'Ready'}
        </button>

        {roomInfo.isHost && (
          <button
            type="button"
            onClick={handleStartGame}
            disabled={!canStart}
            className="start-btn"
          >
            Start Game
          </button>
        )}

        <button type="button" className="leave-btn" onClick={handleLeave}>
          Leave Room
        </button>
      </div>

    </div>
  )
}
