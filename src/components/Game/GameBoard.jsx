import { socket } from '../../services/socket'
import Hand from '../Hand'
import OpponentHand from './OpponentHand'

function canPlayCard(card, discard) {
  if (!discard) return true
  if (!card || !card.type) return false

  const t = card.type
  const c = card.color
  const topT = discard.type
  const topC = discard.color

  if (t === 'wild' || t === 'wild4') return true

  if (topT === 'wild' || topT === 'wild4') {
    if (c && topC && c === topC) return true
    return false
  }

  return c === topC || t === topT
}

export default function GameBoard({ gameState, onColorSelect }) {
  const {
    myHand,
    myPosition,
    opponents,
    discard,
    deckCount,
    isMyTurn,
    currentPlayerPosition,
    pendingColorSelection,
    winner,
    playerCount
  } = gameState

  const handlePlayCard = (card, index) => {
    if (!isMyTurn) return
    if (!canPlayCard(card, discard)) return
    socket.emit('play-card', { cardIndex: index })
  }

  const handleDrawCard = () => {
    if (!isMyTurn) return
    socket.emit('draw-card')
  }

  const handleColorSelect = (color) => {
    socket.emit('select-color', { color })
  }

  // Get opponent positions based on player count and my position
  const getOpponentPosition = (opponent) => {
    const positions2 = ['top']
    const positions3 = ['left', 'top']
    const positions4 = ['left', 'top', 'right']

    const relativePos = (opponent.position - myPosition + playerCount) % playerCount - 1

    if (playerCount === 2) return positions2[0]
    if (playerCount === 3) return positions3[relativePos] || 'top'
    return positions4[relativePos] || 'top'
  }

  // Sort opponents by position for consistent layout
  const sortedOpponents = [...opponents].sort((a, b) => {
    const posOrder = { left: 0, top: 1, right: 2 }
    return posOrder[getOpponentPosition(a)] - posOrder[getOpponentPosition(b)]
  })

  const leftOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'left')
  const topOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'top')
  const rightOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'right')

  // Find whose turn it is
  const currentPlayerName = currentPlayerPosition === myPosition
    ? 'Your turn'
    : opponents.find(o => o.position === currentPlayerPosition)?.name + "'s turn"

  if (winner) {
    return (
      <div className="game-over">
        <h1>Game Over!</h1>
        <h2>{winner.position === myPosition ? 'You won!' : `${winner.name} wins!`}</h2>
        <button onClick={() => window.location.reload()}>Play Again</button>
      </div>
    )
  }

  return (
    <div className="game-table">
      <div className="top-section">
        <div className="current-turn">
          {currentPlayerName}
        </div>
        {topOpponent && (
          <div className="player top">
            <OpponentHand opponent={topOpponent} position="top" />
          </div>
        )}
      </div>

      {leftOpponent && (
        <div className="player left">
          <OpponentHand opponent={leftOpponent} position="left" />
        </div>
      )}

      <div className="center">
        <h2>UNO</h2>
        <p>Deck: {deckCount}</p>
        <button type="button" onClick={handleDrawCard} disabled={!isMyTurn || pendingColorSelection}>
          Draw
        </button>
      </div>

      <div className="discard-pile">
        {discard ? (
          <div className={`card ${discard.color || ''}`} aria-hidden>
            {discard.image ? (
              <img src={discard.image} alt={discard.type + discard.color} />
            ) : (
              <div className="card-label">{discard.type}</div>
            )}
            <div className="card-type-small">{discard.type}</div>
          </div>
        ) : (
          <div className="card card-placeholder">No discard</div>
        )}
      </div>

      {rightOpponent && (
        <div className="player right">
          <OpponentHand opponent={rightOpponent} position="right" />
        </div>
      )}

      <div className={`player bottom ${isMyTurn ? 'my-turn' : ''}`}>
        <Hand
          cards={myHand}
          onCardClick={handlePlayCard}
          disabled={!isMyTurn || pendingColorSelection}
          discard={discard}
        />
      </div>

      {pendingColorSelection && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Choose a color</h3>
            <div className="color-picker">
              <button className="color-btn red" onClick={() => handleColorSelect('red')}>Red</button>
              <button className="color-btn yellow" onClick={() => handleColorSelect('yellow')}>Yellow</button>
              <button className="color-btn green" onClick={() => handleColorSelect('green')}>Green</button>
              <button className="color-btn blue" onClick={() => handleColorSelect('blue')}>Blue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
