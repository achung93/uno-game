import Card from './Card'

// Colors for normal UNO cards
export const COLORS = ['red', 'yellow', 'green', 'blue']

// Types: numbers '0'-'9', and action cards
export const TYPES = {
  NUMBER: 'number',
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

/**
 * Build a standard UNO-like full deck as an array of Card instances.
 * Distribution (approx):
 * - For each color: one 0, two of 1-9, two of skip/reverse/draw2
 * - 4 Wild, 4 Wild Draw Four (color set to 'black')
 */
export function generateFullUnoDeck() {
  const deck = []

  // Number cards
  for (const color of COLORS) {
    // one 0
    deck.push(new Card('0', color, null))

    // two of 1-9
    for (let n = 1; n <= 9; n++) {
      deck.push(new Card(String(n), color, null))
      deck.push(new Card(String(n), color, null))
    }

    // two of each action: skip, reverse, draw2
    for (let i = 0; i < 2; i++) {
      deck.push(new Card(TYPES.SKIP, color, null))
      deck.push(new Card(TYPES.REVERSE, color, null))
      deck.push(new Card(TYPES.DRAW2, color, null))
    }
  }

  // Wilds (color = 'black')
  for (let i = 0; i < 4; i++) {
    deck.push(new Card(TYPES.WILD, 'black', null))
    deck.push(new Card(TYPES.WILD_DRAW4, 'black', null))
  }

  return deck
}

/**
 * Returns a shuffled array of Card instances. If `count` is provided,
 * it returns that many cards (drawn from the shuffled full deck).
 */
export default function generateRandomCards(count = 108) {
  const full = generateFullUnoDeck()
  shuffle(full)
  if (typeof count === 'number') return full.slice(0, Math.min(count, full.length))
  return full
}

// Example usage (in comments):
// import generateRandomCards from './models/generateDeck'
// const hand = generateRandomCards(7) // returns 7 Card instances
