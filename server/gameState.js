import { generateShuffledDeck } from './utils/deck.js'
import { canPlayCard, getNextTurn, getCardEffect } from './gameLogic.js'

export class GameState {
  constructor(players) {
    // players: array of { socketId, name, position }
    this.players = players.map(p => ({
      socketId: p.socketId,
      name: p.name,
      position: p.position
    }))
    this.hands = {} // socketId -> array of cards
    this.deck = []
    this.discard = null // Top card of discard pile (for display)
    this.discardPile = [] // Full discard pile for reshuffling
    this.currentTurn = 0 // index in players array
    this.direction = 1 // 1 = clockwise, -1 = counter-clockwise
    this.pendingWild = null // { socketId } when waiting for color selection
    this.winner = null
    this.unoCallRequired = null // socketId of player who needs to call UNO
    this.unoCalled = {} // socketId -> boolean, tracks who has called UNO
  }

  initialize() {
    this.deck = generateShuffledDeck()

    // Deal 7 cards to each player
    for (const player of this.players) {
      this.hands[player.socketId] = []
      for (let i = 0; i < 7; i++) {
        this.hands[player.socketId].push(this.deck.shift())
      }
    }

    // Set initial discard - reshuffle wild cards back into deck
    let topCard = this.deck.shift()
    while (topCard && (topCard.type === 'wild' || topCard.type === 'wild4')) {
      this.deck.push(topCard)
      this.shuffleDeck()
      topCard = this.deck.shift()
    }
    this.discard = topCard
    this.discardPile = [topCard]

    // Apply starting card effects
    if (topCard.type === 'skip') {
      // First player is skipped
      this.currentTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)
    } else if (topCard.type === 'reverse') {
      // Reverse direction (in 2-player, also skip)
      this.direction *= -1
      if (this.players.length === 2) {
        this.currentTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)
      }
    } else if (topCard.type === 'draw2') {
      // First player draws 2 and is skipped
      const firstPlayer = this.players[this.currentTurn]
      for (let i = 0; i < 2; i++) {
        const drawnCard = this.drawFromDeck()
        if (drawnCard) {
          this.hands[firstPlayer.socketId].push(drawnCard)
        }
      }
      this.currentTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)
    }
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]
    }
  }

  reshuffleDiscardIntoDeck() {
    // Keep the top discard card, shuffle the rest back into deck
    // This is called when deck is empty and we need more cards
    if (this.discardPile && this.discardPile.length > 1) {
      // Move all but top card back to deck
      const cardsToShuffle = this.discardPile.slice(0, -1)
      this.discardPile = [this.discardPile[this.discardPile.length - 1]]
      this.deck = cardsToShuffle
      this.shuffleDeck()
      return true
    }
    return false
  }

  drawFromDeck() {
    // Try to draw a card, reshuffling if needed
    if (this.deck.length === 0) {
      if (!this.reshuffleDiscardIntoDeck()) {
        return null // No cards available
      }
    }
    return this.deck.length > 0 ? this.deck.shift() : null
  }

  playCard(socketId, cardIndex) {
    // Validate it's this player's turn
    const currentPlayer = this.players[this.currentTurn]
    if (currentPlayer.socketId !== socketId) {
      return { error: 'Not your turn' }
    }

    // Validate pending wild is not blocking
    if (this.pendingWild) {
      return { error: 'Must select a color first' }
    }

    const hand = this.hands[socketId]
    if (cardIndex < 0 || cardIndex >= hand.length) {
      return { error: 'Invalid card index' }
    }

    const card = hand[cardIndex]
    if (!canPlayCard(card, this.discard)) {
      return { error: 'Cannot play this card' }
    }

    // Remove card from hand
    hand.splice(cardIndex, 1)

    // Check for win
    if (hand.length === 0) {
      this.winner = currentPlayer
      this.discard = card
      this.discardPile.push(card)
      return { success: true, winner: currentPlayer }
    }

    // Check if player needs to call UNO (1 card left)
    if (hand.length === 1) {
      this.unoCallRequired = socketId
      this.unoCalled[socketId] = false
    }

    // Get card effect
    const effect = getCardEffect(card, this.currentTurn, this.direction, this.players.length)

    // Handle reverse
    if (effect.reverse) {
      this.direction *= -1
      // In 2-player game, reverse acts like skip
      if (this.players.length === 2) {
        effect.skip = true
      }
    }

    // Handle wild cards
    if (effect.pendingColorSelection) {
      this.pendingWild = { socketId, card }
      // Don't advance turn yet - wait for color selection
      // But still set discard without color
      this.discard = { ...card }
      this.discardPile.push(card)
      return { success: true, pendingColor: true }
    }

    // Set discard
    this.discard = card
    this.discardPile.push(card)

    // Handle draw effect on next player
    if (effect.draw > 0) {
      const nextTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)
      const nextPlayer = this.players[nextTurn]
      for (let i = 0; i < effect.draw; i++) {
        const drawnCard = this.drawFromDeck()
        if (drawnCard) {
          this.hands[nextPlayer.socketId].push(drawnCard)
        }
      }
    }

    // Advance turn
    let nextTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)
    if (effect.skip) {
      nextTurn = getNextTurn(nextTurn, this.direction, this.players.length)
    }
    this.currentTurn = nextTurn

    return { success: true }
  }

  selectColor(socketId, color) {
    if (!this.pendingWild || this.pendingWild.socketId !== socketId) {
      return { error: 'No pending color selection' }
    }

    const validColors = ['red', 'yellow', 'green', 'blue']
    if (!validColors.includes(color)) {
      return { error: 'Invalid color' }
    }

    const card = this.pendingWild.card

    // Set the color on discard
    this.discard = { ...card, color }

    // Get effect again for advancing turn
    const effect = getCardEffect(card, this.currentTurn, this.direction, this.players.length)

    // Handle draw effect on next player for wild4
    if (effect.draw > 0) {
      const nextTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)
      const nextPlayer = this.players[nextTurn]
      for (let i = 0; i < effect.draw; i++) {
        const drawnCard = this.drawFromDeck()
        if (drawnCard) {
          this.hands[nextPlayer.socketId].push(drawnCard)
        }
      }
    }

    // Advance turn
    let nextTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)
    if (effect.skip) {
      nextTurn = getNextTurn(nextTurn, this.direction, this.players.length)
    }
    this.currentTurn = nextTurn

    this.pendingWild = null

    return { success: true }
  }

  drawCard(socketId) {
    const currentPlayer = this.players[this.currentTurn]
    if (currentPlayer.socketId !== socketId) {
      return { error: 'Not your turn' }
    }

    if (this.pendingWild) {
      return { error: 'Must select a color first' }
    }

    const card = this.drawFromDeck()
    if (!card) {
      return { error: 'No cards available' }
    }

    this.hands[socketId].push(card)

    // Advance turn after drawing
    this.currentTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)

    return { success: true, card }
  }

  callUno(socketId) {
    // Player calls UNO for themselves
    if (this.hands[socketId]?.length !== 1) {
      return { error: 'You can only call UNO with one card' }
    }

    this.unoCalled[socketId] = true
    if (this.unoCallRequired === socketId) {
      this.unoCallRequired = null
    }

    return { success: true }
  }

  catchUno(catcherSocketId, targetSocketId) {
    // Another player catches someone who didn't call UNO
    if (catcherSocketId === targetSocketId) {
      return { error: 'Cannot catch yourself' }
    }

    // Check if target has 1 card and hasn't called UNO
    if (this.hands[targetSocketId]?.length !== 1) {
      return { error: 'Player does not have one card' }
    }

    if (this.unoCalled[targetSocketId]) {
      return { error: 'Player already called UNO' }
    }

    // Penalty: target draws 2 cards
    for (let i = 0; i < 2; i++) {
      const card = this.drawFromDeck()
      if (card) {
        this.hands[targetSocketId].push(card)
      }
    }

    // Clear the UNO requirement
    if (this.unoCallRequired === targetSocketId) {
      this.unoCallRequired = null
    }
    delete this.unoCalled[targetSocketId]

    return { success: true, penaltyApplied: true }
  }

  // Returns sanitized state for a specific player
  getStateForPlayer(socketId) {
    const playerIndex = this.players.findIndex(p => p.socketId === socketId)

    return {
      myHand: this.hands[socketId] || [],
      myPosition: playerIndex,
      opponents: this.players
        .filter(p => p.socketId !== socketId)
        .map(p => ({
          name: p.name,
          position: p.position,
          cardCount: (this.hands[p.socketId] || []).length
        })),
      discard: this.discard,
      deckCount: this.deck.length,
      currentTurn: this.currentTurn,
      currentPlayerPosition: this.players[this.currentTurn]?.position,
      isMyTurn: this.players[this.currentTurn]?.socketId === socketId,
      direction: this.direction,
      pendingColorSelection: this.pendingWild?.socketId === socketId,
      winner: this.winner ? { name: this.winner.name, position: this.winner.position } : null,
      playerCount: this.players.length,
      canCallUno: this.hands[socketId]?.length === 1 && !this.unoCalled[socketId],
      hasCalled: this.unoCalled[socketId] || false,
      playersWithOneCard: this.players
        .filter(p => this.hands[p.socketId]?.length === 1 && !this.unoCalled[p.socketId] && p.socketId !== socketId)
        .map(p => ({ socketId: p.socketId, name: p.name, position: p.position }))
    }
  }
}
