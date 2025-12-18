// Server-side deck generation (no class dependency)

export const COLORS = ['red', 'yellow', 'green', 'blue']

export const TYPES = {
  SKIP: 'skip',
  REVERSE: 'reverse',
  DRAW2: 'draw2',
  WILD: 'wild',
  WILD_DRAW4: 'wild4'
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

// Build a standard UNO deck (108 cards)
export function generateFullUnoDeck() {
  const deck = []

  for (const color of COLORS) {
    // one 0
    deck.push({ type: '0', color, image: null })

    // two of 1-9
    for (let n = 1; n <= 9; n++) {
      deck.push({ type: String(n), color, image: null })
      deck.push({ type: String(n), color, image: null })
    }

    // two of each action: skip, reverse, draw2
    for (let i = 0; i < 2; i++) {
      deck.push({ type: TYPES.SKIP, color, image: null })
      deck.push({ type: TYPES.REVERSE, color, image: null })
      deck.push({ type: TYPES.DRAW2, color, image: null })
    }
  }

  // Wilds (color = 'black')
  for (let i = 0; i < 4; i++) {
    deck.push({ type: TYPES.WILD, color: 'black', image: null })
    deck.push({ type: TYPES.WILD_DRAW4, color: 'black', image: null })
  }

  return deck
}

export function generateShuffledDeck() {
  return shuffle(generateFullUnoDeck())
}
