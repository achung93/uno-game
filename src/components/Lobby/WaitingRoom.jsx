import { socket } from '../../services/socket'

const TEAM_COLORS = ['Red', 'Blue', 'Green', 'Yellow']

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

  const handleToggleTeamMode = () => {
    socket.emit('toggle-team-mode')
  }

  const handleSelectTeam = (team) => {
    socket.emit('select-team', { team })
  }

  const myPlayer = roomInfo.players.find(p => p.isHost === roomInfo.isHost) || roomInfo.players[0]

  // Calculate if we can start the game
  const allReady = roomInfo.players.length >= 2 && roomInfo.players.every(p => p.ready)

  // Team mode validation
  let teamsValid = true
  let teamModeMessage = ''
  if (roomInfo.teamMode) {
    // All players must have selected a team
    const allHaveTeams = roomInfo.players.every(p => p.team !== null)
    if (!allHaveTeams) {
      teamsValid = false
      teamModeMessage = 'All players must select a team'
    } else {
      // Check team sizes (must be exactly 2 per team)
      const teamCounts = {}
      for (const p of roomInfo.players) {
        teamCounts[p.team] = (teamCounts[p.team] || 0) + 1
      }
      const counts = Object.values(teamCounts)
      if (!counts.every(c => c === 2)) {
        teamsValid = false
        teamModeMessage = 'Each team must have exactly 2 players'
      }
    }
  }

  const canStart = allReady && (!roomInfo.teamMode || teamsValid)

  // Get available teams (max 4 teams for 8 players)
  const maxTeams = Math.min(4, Math.floor(roomInfo.players.length / 2))
  const availableTeams = Array.from({ length: maxTeams }, (_, i) => i)

  // Count players per team (for team selection buttons)
  const playerTeamCounts = {}
  for (const p of roomInfo.players) {
    if (p.team !== null) {
      playerTeamCounts[p.team] = (playerTeamCounts[p.team] || 0) + 1
    }
  }

  return (
    <div className="waiting-room">
      <h2>Room: {roomInfo.code}</h2>
      <p className="room-code-hint">Share this code with friends to join!</p>

      {roomInfo.isHost && (
        <div className="team-mode-toggle">
          <label>
            <input
              type="checkbox"
              checked={roomInfo.teamMode || false}
              onChange={handleToggleTeamMode}
            />
            Team Mode (2 players per team)
          </label>
        </div>
      )}

      {!roomInfo.isHost && roomInfo.teamMode && (
        <div className="team-mode-notice">
          Team Mode is enabled
        </div>
      )}

      <div className="players-list">
        <h3>Players ({roomInfo.players.length}/8)</h3>
        {roomInfo.players.map((player, index) => (
          <div key={index} className={`player-row ${player.ready ? 'ready' : ''}`}>
            <span className="player-name">
              {player.name}
              {player.isHost && <span className="host-badge"> (Host)</span>}
              {roomInfo.teamMode && player.team !== null && (
                <span className={`team-badge team-${player.team}`}> Team {TEAM_COLORS[player.team]}</span>
              )}
            </span>
            <span className={`ready-status ${player.ready ? 'ready' : 'not-ready'}`}>
              {player.ready ? 'Ready' : 'Not Ready'}
            </span>
          </div>
        ))}
      </div>

      {roomInfo.teamMode && (
        <div className="team-selection">
          <h4>Select Your Team:</h4>
          <div className="team-buttons">
            {availableTeams.map(team => {
              const isFull = playerTeamCounts[team] >= 2 && myPlayer?.team !== team
              const isSelected = myPlayer?.team === team
              return (
                <button
                  key={team}
                  type="button"
                  className={`team-btn team-btn-${team} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectTeam(isSelected ? null : team)}
                  disabled={isFull && !isSelected}
                >
                  {TEAM_COLORS[team]} {playerTeamCounts[team] ? `(${playerTeamCounts[team]}/2)` : '(0/2)'}
                </button>
              )
            })}
          </div>
          {teamModeMessage && <p className="team-warning">{teamModeMessage}</p>}
        </div>
      )}

      <div className="waiting-actions">
        <button type="button" onClick={handleToggleReady}>
          {myPlayer?.ready ? 'Not Ready' : 'Ready'}
        </button>

        {roomInfo.isHost && (
          <button
            type="button"
            onClick={handleStartGame}
            disabled={!canStart}
            className="start-btn"
          >
            {canStart ? 'Start Game' : 'Waiting for players...'}
          </button>
        )}

        <button type="button" className="leave-btn" onClick={handleLeave}>
          Leave Room
        </button>
      </div>

    </div>
  )
}
