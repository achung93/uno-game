import { useState, useRef, useEffect } from 'react'
import { socket } from '../../services/socket'
import Hand from '../Hand'
import OpponentHand from './OpponentHand'

function canPlayCard(card, discard, drawPending = false) {
  if (!discard) return true
  if (!card || !card.type) return false

  const t = card.type
  const c = card.color
  const topT = discard.type
  const topC = discard.color

  // If there's a draw penalty pending, only draw cards can be played to stack
  if (drawPending) {
    // Can stack draw2 on draw2, or wild4 on any draw card
    if (topT === 'draw2') {
      return t === 'draw2' || t === 'wild4'
    }
    if (topT === 'wild4') {
      return t === 'wild4'
    }
  }

  if (t === 'wild' || t === 'wild4') return true

  if (topT === 'wild' || topT === 'wild4') {
    if (c && topC && c === topC) return true
    return false
  }

  return c === topC || t === topT
}

export default function GameBoard({ gameState }) {
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
    winningTeam,
    playerCount,
    drawPending,
    drawNumber,
    teamMode,
    myTeam,
    teammatePosition,
    canCallUno,
    playersWithOneCard,
    unoButtonPosition
  } = gameState

  const [flyingCard, setFlyingCard] = useState(null)
  const [opponentFlyingCard, setOpponentFlyingCard] = useState(null)
  const [drawingCards, setDrawingCards] = useState(null) // { count, targetPosition }
  const discardRef = useRef(null)
  const deckRef = useRef(null)
  const myHandRef = useRef(null)
  const opponentRefs = useRef({}) // position -> ref for opponent hand elements
  // Turn timer UI state (client-side)
  const [timerActive, setTimerActive] = useState(false)
  const [timerRemaining, setTimerRemaining] = useState(0)
  const timerRef = useRef({ end: 0, intervalId: null })

  // Helper to clear timer state
  const clearTimer = () => {
    setTimerActive(false)
    setTimerRemaining(0)
    if (timerRef.current.intervalId) {
      clearInterval(timerRef.current.intervalId)
      timerRef.current.intervalId = null
    }
  }

  useEffect(() => {
    function onTimerStart({ duration }) {
      const now = Date.now()
      timerRef.current.end = now + duration
      setTimerActive(true)
      setTimerRemaining(duration)

      if (timerRef.current.intervalId) clearInterval(timerRef.current.intervalId)
      timerRef.current.intervalId = setInterval(() => {
        const rem = Math.max(0, timerRef.current.end - Date.now())
        setTimerRemaining(rem)
        if (rem <= 0) {
          clearInterval(timerRef.current.intervalId)
          timerRef.current.intervalId = null
          setTimerActive(false)
        }
      }, 100)
    }

    function onAutoDraw() {
      // hide timer immediately when auto-draw is performed
      clearTimer()
    }

    function onCardPlayed({ card, playerPosition }) {
      // Clear timer when any card is played
      clearTimer()

      // If it's not me who played, animate from opponent position
      if (playerPosition !== myPosition) {
        const opponentEl = opponentRefs.current[playerPosition]
        const discardRect = discardRef.current?.getBoundingClientRect()

        if (opponentEl && discardRect) {
          const opponentRect = opponentEl.getBoundingClientRect()
          const startX = opponentRect.left + opponentRect.width / 2 - 40
          const startY = opponentRect.top + opponentRect.height / 2 - 60
          const deltaX = discardRect.left + discardRect.width / 2 - 40 - startX
          const deltaY = discardRect.top + discardRect.height / 2 - 60 - startY

          setOpponentFlyingCard({
            card,
            startX,
            startY,
            deltaX,
            deltaY,
            width: 80,
            height: 120
          })

          setTimeout(() => {
            setOpponentFlyingCard(null)
          }, 350)
        }
      }
    }

    function onCardDrawn({ count, playerPosition }) {
      const deckEl = deckRef.current
      if (!deckEl) return

      const deckRect = deckEl.getBoundingClientRect()

      // Determine target - my hand or opponent's hand
      let targetEl
      if (playerPosition === myPosition) {
        targetEl = myHandRef.current
      } else {
        targetEl = opponentRefs.current[playerPosition]
      }

      if (targetEl) {
        const targetRect = targetEl.getBoundingClientRect()
        const startX = deckRect.left + deckRect.width / 2 - 40
        const startY = deckRect.top + deckRect.height / 2 - 60
        const deltaX = targetRect.left + targetRect.width / 2 - 40 - startX
        const deltaY = targetRect.top + targetRect.height / 2 - 60 - startY

        setDrawingCards({
          count,
          startX,
          startY,
          deltaX,
          deltaY
        })

        setTimeout(() => {
          setDrawingCards(null)
        }, 350)
      }
    }

    socket.on('turn-timer-start', onTimerStart)
    socket.on('auto-draw', onAutoDraw)
    socket.on('card-played', onCardPlayed)
    socket.on('card-drawn', onCardDrawn)

    return () => {
      socket.off('turn-timer-start', onTimerStart)
      socket.off('auto-draw', onAutoDraw)
      socket.off('card-played', onCardPlayed)
      socket.off('card-drawn', onCardDrawn)
      if (timerRef.current.intervalId) clearInterval(timerRef.current.intervalId)
    }
  }, [myPosition])

  // Determine if timer should be shown (hide during color selection or after game end)
  const showTimer = timerActive && !pendingColorSelection && !winner

  const handlePlayCard = (card, index, cardElement) => {
    if (!isMyTurn) return
    if (!canPlayCard(card, discard, drawPending)) return

    // Get positions for animation
    const cardRect = cardElement.getBoundingClientRect()
    const discardRect = discardRef.current?.getBoundingClientRect()

    if (discardRect) {
      // Calculate the distance to fly
      const deltaX = discardRect.left + discardRect.width / 2 - (cardRect.left + cardRect.width / 2)
      const deltaY = discardRect.top + discardRect.height / 2 - (cardRect.top + cardRect.height / 2)

      setFlyingCard({
        card,
        startX: cardRect.left,
        startY: cardRect.top,
        deltaX,
        deltaY,
        width: cardRect.width,
        height: cardRect.height
      })

      // Clear flying card and emit after animation
      setTimeout(() => {
        setFlyingCard(null)
        socket.emit('play-card', { cardIndex: index })
      }, 350)
    } else {
      socket.emit('play-card', { cardIndex: index })
    }
  }

  const handleDrawCard = () => {
    if (!isMyTurn) return
    socket.emit('draw-card')
  }

  const handleColorSelect = (color) => {
    socket.emit('select-color', { color })
  }

  const handleCallUno = () => {
    socket.emit('call-uno')
  }

  const handleCatchUno = (targetSocketId) => {
    socket.emit('catch-uno', { targetSocketId })
  }

  // Get opponent positions based on player count and my position
  const getOpponentPosition = (opponent) => {
    const positions2 = ['top']
    const positions3 = ['left', 'top']
    const positions4 = ['left', 'top', 'right']
    const positions5 = ['left', 'top-left', 'top-right', 'right']
    const positions6 = ['left', 'top-left', 'top', 'top-right', 'right']
    const positions7 = ['left', 'left-top', 'top-left', 'top-right', 'right-top', 'right']
    const positions8 = ['left', 'left-top', 'top-left', 'top', 'top-right', 'right-top', 'right']

    const relativePos = (opponent.position - myPosition + playerCount) % playerCount - 1

    if (playerCount === 2) return positions2[0]
    if (playerCount === 3) return positions3[relativePos] || 'top'
    if (playerCount === 4) return positions4[relativePos] || 'top'
    if (playerCount === 5) return positions5[relativePos] || 'top'
    if (playerCount === 6) return positions6[relativePos] || 'top'
    if (playerCount === 7) return positions7[relativePos] || 'top'
    return positions8[relativePos] || 'top'
  }

  // Sort opponents by position for consistent layout
  const sortedOpponents = [...opponents].sort((a, b) => {
    const posOrder = { left: 0, 'left-top': 1, 'top-left': 2, top: 3, 'top-right': 4, 'right-top': 5, right: 6 }
    return posOrder[getOpponentPosition(a)] - posOrder[getOpponentPosition(b)]
  })

  const leftOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'left')
  const leftTopOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'left-top')
  const topLeftOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'top-left')
  const topOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'top')
  const topRightOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'top-right')
  const rightTopOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'right-top')
  const rightOpponent = sortedOpponents.find(o => getOpponentPosition(o) === 'right')

  // Find whose turn it is
  const currentPlayerName = currentPlayerPosition === myPosition
    ? 'Your turn'
    : opponents.find(o => o.position === currentPlayerPosition)?.name + "'s turn"

  if (winner) {
    const isMyTeamWin = teamMode && winningTeam === myTeam
    const isMyWin = winner.position === myPosition
    const teammate = opponents.find(o => o.position === teammatePosition)

    let winMessage
    if (teamMode) {
      if (isMyWin) {
        winMessage = 'You won for your team!'
      } else if (isMyTeamWin) {
        winMessage = `Your teammate ${winner.name} won! Your team wins!`
      } else {
        winMessage = `Team ${winningTeam + 1} wins! (${winner.name})`
      }
    } else {
      winMessage = isMyWin ? 'You won!' : `${winner.name} wins!`
    }

    return (
      <div className="game-over">
        <h1>Game Over!</h1>
        {teamMode && <p className="team-mode-badge">Team Mode</p>}
        <h2>{winMessage}</h2>
        {teamMode && teammate && (
          <p className="teammate-info">Your teammate: {teammate.name}</p>
        )}
        <button onClick={() => window.location.reload()}>Play Again</button>
      </div>
    )
  }

  // Determine layout class based on player count
  const layoutClass = `layout-${playerCount}-players`

  return (
    <div className={`game-table ${layoutClass}`}>
      <div className={`current-turn ${isMyTurn ? 'my-turn-banner' : ''}`}>
        {currentPlayerName}
      </div>

      {/* Render all opponents in their positions */}
      {leftOpponent && (
        <div ref={el => opponentRefs.current[leftOpponent.position] = el} className={`player left ${leftOpponent.position === currentPlayerPosition ? 'active-turn' : ''}`}>
          <OpponentHand opponent={leftOpponent} position="left" isCurrentTurn={leftOpponent.position === currentPlayerPosition} />
        </div>
      )}

      {leftTopOpponent && (
        <div ref={el => opponentRefs.current[leftTopOpponent.position] = el} className={`player left-top ${leftTopOpponent.position === currentPlayerPosition ? 'active-turn' : ''}`}>
          <OpponentHand opponent={leftTopOpponent} position="left-top" isCurrentTurn={leftTopOpponent.position === currentPlayerPosition} />
        </div>
      )}

      {topLeftOpponent && (
        <div ref={el => opponentRefs.current[topLeftOpponent.position] = el} className={`player top-left ${topLeftOpponent.position === currentPlayerPosition ? 'active-turn' : ''}`}>
          <OpponentHand opponent={topLeftOpponent} position="top-left" isCurrentTurn={topLeftOpponent.position === currentPlayerPosition} />
        </div>
      )}

      {topOpponent && (
        <div ref={el => opponentRefs.current[topOpponent.position] = el} className={`player top ${topOpponent.position === currentPlayerPosition ? 'active-turn' : ''}`}>
          <OpponentHand opponent={topOpponent} position="top" isCurrentTurn={topOpponent.position === currentPlayerPosition} />
        </div>
      )}

      {topRightOpponent && (
        <div ref={el => opponentRefs.current[topRightOpponent.position] = el} className={`player top-right ${topRightOpponent.position === currentPlayerPosition ? 'active-turn' : ''}`}>
          <OpponentHand opponent={topRightOpponent} position="top-right" isCurrentTurn={topRightOpponent.position === currentPlayerPosition} />
        </div>
      )}

      {rightTopOpponent && (
        <div ref={el => opponentRefs.current[rightTopOpponent.position] = el} className={`player right-top ${rightTopOpponent.position === currentPlayerPosition ? 'active-turn' : ''}`}>
          <OpponentHand opponent={rightTopOpponent} position="right-top" isCurrentTurn={rightTopOpponent.position === currentPlayerPosition} />
        </div>
      )}

      {rightOpponent && (
        <div ref={el => opponentRefs.current[rightOpponent.position] = el} className={`player right ${rightOpponent.position === currentPlayerPosition ? 'active-turn' : ''}`}>
          <OpponentHand opponent={rightOpponent} position="right" isCurrentTurn={rightOpponent.position === currentPlayerPosition} />
        </div>
      )}

      <div className="center">
        <h2>UNO</h2>
        {teamMode && (
          <p className="team-indicator">Team Mode - Team {myTeam + 1}</p>
        )}
        <p ref={deckRef} className="deck-display">Deck: {deckCount}</p>
        {drawPending && (
          <div className="draw-penalty">
            Draw +{drawNumber}!
          </div>
        )}

        <div className="center-controls">
          <button type="button" onClick={handleDrawCard} disabled={!isMyTurn || pendingColorSelection}>
            {drawPending ? `Draw ${drawNumber}` : 'Draw'}
          </button>

          {/* Timer displayed to the right of the Draw button */}
          <div className="turn-timer-container">
            {showTimer && (
              <div className="turn-timer">
                <div className="timer-circle">
                  <div className="timer-value">{Math.ceil(timerRemaining / 1000)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Catch UNO buttons stay in center */}
        {playersWithOneCard && playersWithOneCard.length > 0 && (
          <div className="catch-uno-container">
            {playersWithOneCard.map(player => (
              <button
                key={player.socketId}
                type="button"
                className="uno-btn catch-uno"
                onClick={() => handleCatchUno(player.socketId)}
              >
                Catch {player.name}!
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Random position UNO call button - only show after color selection is complete */}
      {canCallUno && !pendingColorSelection && unoButtonPosition && (
        <button
          type="button"
          className="uno-btn call-uno floating-uno"
          onClick={handleCallUno}
          style={{
            left: `${unoButtonPosition.x}%`,
            top: `${unoButtonPosition.y}%`
          }}
        >
          UNO!
        </button>
      )}

      <div className="discard-pile" ref={discardRef}>
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

      {/* Flying card animation */}
      {flyingCard && (
        <div
          className={`flying-card card ${flyingCard.card.color || ''}`}
          style={{
            left: flyingCard.startX,
            top: flyingCard.startY,
            width: flyingCard.width,
            height: flyingCard.height,
            '--fly-x': `${flyingCard.deltaX}px`,
            '--fly-y': `${flyingCard.deltaY}px`
          }}
        >
          {flyingCard.card.image ? (
            <img src={flyingCard.card.image} alt={flyingCard.card.type} />
          ) : (
            <div className="card-label">{flyingCard.card.type}</div>
          )}
        </div>
      )}

      {/* Opponent flying card animation */}
      {opponentFlyingCard && (
        <div
          className={`flying-card card ${opponentFlyingCard.card.color || ''}`}
          style={{
            left: opponentFlyingCard.startX,
            top: opponentFlyingCard.startY,
            width: opponentFlyingCard.width,
            height: opponentFlyingCard.height,
            '--fly-x': `${opponentFlyingCard.deltaX}px`,
            '--fly-y': `${opponentFlyingCard.deltaY}px`
          }}
        >
          {opponentFlyingCard.card.image ? (
            <img src={opponentFlyingCard.card.image} alt={opponentFlyingCard.card.type} />
          ) : (
            <div className="card-label">{opponentFlyingCard.card.type}</div>
          )}
        </div>
      )}

      {/* Drawing cards animation */}
      {drawingCards && (
        Array.from({ length: Math.min(drawingCards.count, 4) }).map((_, i) => (
          <div
            key={i}
            className="flying-card card card-back drawing-card"
            style={{
              left: drawingCards.startX,
              top: drawingCards.startY,
              width: 80,
              height: 120,
              '--fly-x': `${drawingCards.deltaX}px`,
              '--fly-y': `${drawingCards.deltaY}px`,
              animationDelay: `${i * 50}ms`
            }}
          />
        ))
      )}

      <div ref={myHandRef} className={`player bottom ${isMyTurn ? 'my-turn' : ''}`}>
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
