// Game logic for UNO - card validation and effects

export function canPlayCard(card, discard, drawPending = false) {
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

  // Wild cards can always be played
  if (t === 'wild' || t === 'wild4') return true

  // If top is a wild that set a color, allow by color
  if (topT === 'wild' || topT === 'wild4') {
    if (c && topC && c === topC) return true
    return false
  }

  // Normal matching: same color OR same type/number
  return c === topC || t === topT
}

export function getNextTurn(currentTurn, direction, playerCount) {
  return (currentTurn + direction + playerCount) % playerCount
}

// Returns the effect to apply after playing a card
// Effects: { skip, reverse, draw, nextTurn }
export function getCardEffect(card, currentTurn, direction, playerCount) {
  const effect = {
    skip: false,
    reverse: false,
    draw: 0,
    pendingColorSelection: false
  }

  switch (card.type) {
    case 'skip':
      effect.skip = true
      break
    case 'reverse':
      effect.reverse = true
      break
    case 'draw2':
      effect.draw = 2
      effect.skip = true
      break
    case 'wild':
      effect.pendingColorSelection = true
      break
    case 'wild4':
      effect.draw = 4
      effect.skip = true
      effect.pendingColorSelection = true
      break
  }

  return effect
}
