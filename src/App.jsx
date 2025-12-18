import { useEffect, useState, useCallback } from 'react'
import './App.css'
import { socket, connectSocket } from './services/socket'
import CreateRoom from './components/Lobby/CreateRoom'
import JoinRoom from './components/Lobby/JoinRoom'
import WaitingRoom from './components/Lobby/WaitingRoom'
import GameBoard from './components/Game/GameBoard'

function App() {
  const [screen, setScreen] = useState('menu') // 'menu' | 'create' | 'join' | 'lobby' | 'game'
  const [roomInfo, setRoomInfo] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    connectSocket()

    socket.on('room-created', ({ roomCode }) => {
      console.log('room-created received ', roomCode)
      setScreen('lobby')
      setError(null)
    })

    socket.on('room-joined', ({ roomCode }) => {
      setScreen('lobby')
      setError(null)
    })

    socket.on('room-update', (info) => {
      setRoomInfo(info)
    })

    socket.on('room-left', () => {
      setScreen('menu')
      setRoomInfo(null)
    })

    socket.on('game-started', () => {
      setScreen('game')
    })

    socket.on('game-state', (state) => {
      console.log('game-state received', state)
      setGameState(state)
    })

    socket.on('player-disconnected', ({ playerName }) => {
      setError(`${playerName} disconnected. Game ended.`)
      setScreen('menu')
      setRoomInfo(null)
      setGameState(null)
    })

    socket.on('error', ({ message }) => {
      setError(message)
      setTimeout(() => setError(null), 3000)
    })

    return () => {
      socket.off('room-created')
      socket.off('room-joined')
      socket.off('room-update')
      socket.off('room-left')
      socket.off('game-started')
      socket.off('game-state')
      socket.off('player-disconnected')
      socket.off('error')
    }
  }, [])

  const goToMenu = useCallback(() => {
    setScreen('menu')
    setError(null)
  }, [])

  return (
    <div className="app">
      {error && <div className="error-toast">{error}</div>}

      {screen === 'menu' && (
        <div className="main-menu">
          <h1>UNO</h1>
          <div className="menu-buttons">
            <button onClick={() => setScreen('create')}>Create Game</button>
            <button onClick={() => setScreen('join')}>Join Game</button>
          </div>
        </div>
      )}

      {screen === 'create' && (
        <CreateRoom onBack={goToMenu} />
      )}

      {screen === 'join' && (
        <JoinRoom onBack={goToMenu} />
      )}

      {screen === 'lobby' && roomInfo && (
        <WaitingRoom roomInfo={roomInfo} onLeave={goToMenu} />
      )}

      {screen === 'game' && gameState && (
        <GameBoard gameState={gameState} />
      )}
    </div>
  )
}

export default App
