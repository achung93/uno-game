import { generateShuffledDeck } from './utils/deck.js'
import { canPlayCard, getNextTurn, getCardEffect } from './gameLogic.js'

export class GameState {
  constructor(players, teamModeEnabled = false) {
    // players: array of { socketId, name, position, team }
    this.players = players.map(p => ({
      socketId: p.socketId,
      name: p.name,
      position: p.position,
      team: p.team
    }))
    this.hands = {} // socketId -> array of cards
    this.deck = []
    this.discard = null // Top card of discard pile (for display)
    this.discardPile = [] // Full discard pile for reshuffling
    this.currentTurn = Math.floor(Math.random() * players.length) // Random starting player
    this.direction = 1 // 1 = clockwise, -1 = counter-clockwise
    this.pendingWild = null // { socketId } when waiting for color selection
    this.winner = null
    this.winningTeam = null // Team number if team mode
    this.unoCallRequired = null // socketId of player who needs to call UNO
    this.unoCalled = {} // socketId -> boolean, tracks who has called UNO
    this.unoButtonPositions = {} // socketId -> { x, y } random position for UNO button
    this.drawNumber = 1

    // Team mode - uses player-selected teams from lobby
    this.teamMode = teamModeEnabled
    this.teams = {} // socketId -> team number
    this.lastTeamPlayed = null // Track which team last played for alternating turns

    if (this.teamMode) {
      this.assignTeamsFromPlayers()
      // Build turn order for alternating team play
      this.buildTeamTurnOrder()
    }
  }

  assignTeamsFromPlayers() {
    // Use the team assignments from player selections
    for (const player of this.players) {
      this.teams[player.socketId] = player.team
    }
  }

  buildTeamTurnOrder() {
    // Group players by team
    this.teamGroups = {}
    for (const player of this.players) {
      const team = this.teams[player.socketId]
      if (!this.teamGroups[team]) {
        this.teamGroups[team] = []
      }
      this.teamGroups[team].push(player)
    }

    // Track which player in each team plays next
    this.teamPlayerIndex = {}
    for (const team of Object.keys(this.teamGroups)) {
      this.teamPlayerIndex[team] = 0
    }

    // Get sorted team numbers for alternating
    this.teamOrder = Object.keys(this.teamGroups).map(Number).sort((a, b) => a - b)
    this.currentTeamIndex = 0

    // Set initial turn to first player of first team
    const firstTeam = this.teamOrder[0]
    const firstPlayer = this.teamGroups[firstTeam][0]
    this.currentTurn = this.players.findIndex(p => p.socketId === firstPlayer.socketId)
  }

  // Get next turn for team mode - alternates between teams, then within team
  getNextTeamTurn(skipped = false) {
    const currentPlayer = this.players[this.currentTurn]
    const currentTeam = this.teams[currentPlayer.socketId]

    // Move to next team
    let nextTeamIndex = (this.teamOrder.indexOf(currentTeam) + 1) % this.teamOrder.length

    // If skipped, skip the next team too
    if (skipped) {
      nextTeamIndex = (nextTeamIndex + 1) % this.teamOrder.length
    }

    const nextTeam = this.teamOrder[nextTeamIndex]

    // Get the next player from that team (alternate between teammates)
    const teamPlayers = this.teamGroups[nextTeam]
    const playerIndex = this.teamPlayerIndex[nextTeam]
    const nextPlayer = teamPlayers[playerIndex]

    // Advance the team's player index for next time
    this.teamPlayerIndex[nextTeam] = (playerIndex + 1) % teamPlayers.length

    // Find the player index in the main players array
    return this.players.findIndex(p => p.socketId === nextPlayer.socketId)
  }

  // Unified method to advance turn
  advanceTurn(skip = false) {
    if (this.teamMode) {
      return this.getNextTeamTurn(skip)
    } else {
      let nextTurn = getNextTurn(this.currentTurn, this.direction, this.players.length)
      if (skip) {
        nextTurn = getNextTurn(nextTurn, this.direction, this.players.length)
      }
      return nextTurn
    }
  }

  getTeammate(socketId) {
    if (!this.teamMode) return null
    const myTeam = this.teams[socketId]
    const teammate = this.players.find(p =>
      p.socketId !== socketId && this.teams[p.socketId] === myTeam
    )
    return teammate || null
  }

  // Generate a random position for the UNO button within safe zones
  generateUnoButtonPosition(socketId) {
    const safeZones = [
      { minX: 5, maxX: 20, minY: 40, maxY: 75 },   // Left side
      { minX: 80, maxX: 95, minY: 40, maxY: 75 },  // Right side
      { minX: 20, maxX: 40, minY: 70, maxY: 85 },  // Bottom left
      { minX: 60, maxX: 80, minY: 70, maxY: 85 },  // Bottom right
    ]

    // Pick a random safe zone
    const zone = safeZones[Math.floor(Math.random() * safeZones.length)]

    // Generate random position within that zone
    const x = zone.minX + Math.random() * (zone.maxX - zone.minX)
    const y = zone.minY + Math.random() * (zone.maxY - zone.minY)

    this.unoButtonPositions[socketId] = { x, y }
  }

  // Remove a player who disconnected and continue the game
  removePlayer(socketId) {
    const playerIndex = this.players.findIndex(p => p.socketId === socketId)
    if (playerIndex === -1) return { error: 'Player not found' }

    const removedPlayer = this.players[playerIndex]

    // Remove player from hands
    delete this.hands[socketId]
    delete this.unoCalled[socketId]

    // If only one player left, they win
    if (this.players.length <= 2) {
      this.players.splice(playerIndex, 1)
      if (this.players.length === 1) {
        this.winner = this.players[0]
        if (this.teamMode) {
          this.winningTeam = this.teams[this.players[0].socketId]
        }
        return { success: true, gameOver: true, winner: this.winner }
      }
    }

    // Adjust currentTurn if needed before removing player
    const wasCurrentPlayer = this.currentTurn === playerIndex

    // Remove the player
    this.players.splice(playerIndex, 1)

    // Reassign positions
    this.players.forEach((p, i) => {
      p.position = i
    })

    // If current turn was the removed player or after them, adjust
    if (wasCurrentPlayer) {
      // Move to next player (which is now at the same index)
      this.currentTurn = this.currentTurn % this.players.length
    } else if (this.currentTurn > playerIndex) {
      // Adjust index since a player before current was removed
      this.currentTurn--
    }

    // Ensure currentTurn is valid
    this.currentTurn = Math.max(0, Math.min(this.currentTurn, this.players.length - 1))

    // Clear pending wild if it was the removed player
    if (this.pendingWild && this.pendingWild.socketId === socketId) {
      this.pendingWild = null
    }

    // Clear UNO requirement if it was the removed player
    if (this.unoCallRequired === socketId) {
      this.unoCallRequired = null
    }

    // In team mode, update team groups
    if (this.teamMode) {
      delete this.teams[socketId]
      this.buildTeamTurnOrder()
      // After rebuilding, set current turn to a valid player
      if (this.players.length > 0) {
        this.currentTurn = Math.min(this.currentTurn, this.players.length - 1)
      }
    }

    return { success: true, removedPlayer }
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
    const drawPending = this.drawNumber > 1
    if (!canPlayCard(card, this.discard, drawPending)) {
      return { error: 'Cannot play this card' }
    }

    // Remove card from hand
    hand.splice(cardIndex, 1)

    // Check for win
    if (hand.length === 0) {
      this.winner = currentPlayer
      this.discard = card
      this.discardPile.push(card)

      // In team mode, the whole team wins
      if (this.teamMode) {
        this.winningTeam = this.teams[socketId]
      }

      return { success: true, winner: currentPlayer, winningTeam: this.winningTeam, playedCard: card, playerPosition: currentPlayer.position }
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
      // UNO button position will be generated after color selection
      return { success: true, pendingColor: true, playedCard: card, playerPosition: currentPlayer.position }
    }

    // Generate UNO button position now (for non-wild cards with 1 card left)
    if (hand.length === 1) {
      this.generateUnoButtonPosition(socketId)
    }

    // Set discard
    this.discard = card
    this.discardPile.push(card)

    // Handle draw effect - accumulate for stacking
    if (effect.draw > 0) {
      if (this.drawNumber === 1) {
        this.drawNumber += effect.draw - 1
      } else {
        this.drawNumber += effect.draw
      }
      // Don't skip - next player gets a chance to stack or draw
      effect.skip = false
    }

    // Advance turn using unified method
    this.currentTurn = this.advanceTurn(effect.skip)

    return { success: true, playedCard: card, playerPosition: currentPlayer.position }
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

    // Handle draw effect - accumulate for stacking (wild4)
    if (effect.draw > 0) {
      this.drawNumber += effect.draw
      // Don't skip - next player gets a chance to stack or draw
      effect.skip = false
    }

    // Advance turn using unified method
    this.currentTurn = this.advanceTurn(effect.skip)

    // Generate UNO button position after color selection if player has 1 card
    if (this.hands[socketId]?.length === 1 && !this.unoCalled[socketId]) {
      this.generateUnoButtonPosition(socketId)
    }

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

    const drawnCards = []
    for (let i = 0; i < this.drawNumber; i++) {
      const card = this.drawFromDeck()
      if (!card) {
        break // No more cards available
      }
      this.hands[socketId].push(card)
      drawnCards.push(card)
    }

    if (drawnCards.length === 0) {
      return { error: 'No cards available' }
    }

    // Reset drawNumber back to 1
    this.drawNumber = 1

    // Advance turn after drawing using unified method
    this.currentTurn = this.advanceTurn(false)

    return { success: true, cards: drawnCards, count: drawnCards.length, playerPosition: currentPlayer.position }
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
    const teammate = this.getTeammate(socketId)
    const myTeam = this.teamMode ? this.teams[socketId] : null

    return {
      myHand: this.hands[socketId] || [],
      myPosition: playerIndex,
      opponents: this.players
        .filter(p => p.socketId !== socketId)
        .map(p => {
          const isTeammate = teammate && p.socketId === teammate.socketId
          return {
            name: p.name,
            position: p.position,
            cardCount: (this.hands[p.socketId] || []).length,
            isTeammate,
            team: this.teamMode ? this.teams[p.socketId] : null,
            // Teammates can see each other's cards
            cards: isTeammate ? this.hands[p.socketId] : null
          }
        }),
      discard: this.discard,
      deckCount: this.deck.length,
      currentTurn: this.currentTurn,
      currentPlayerPosition: this.players[this.currentTurn]?.position,
      isMyTurn: this.players[this.currentTurn]?.socketId === socketId,
      direction: this.direction,
      pendingColorSelection: this.pendingWild?.socketId === socketId,
      winner: this.winner ? { name: this.winner.name, position: this.winner.position } : null,
      winningTeam: this.winningTeam,
      playerCount: this.players.length,
      canCallUno: this.hands[socketId]?.length === 1 && !this.unoCalled[socketId],
      hasCalled: this.unoCalled[socketId] || false,
      playersWithOneCard: this.players
        .filter(p => this.hands[p.socketId]?.length === 1 && !this.unoCalled[p.socketId] && p.socketId !== socketId)
        .map(p => ({ socketId: p.socketId, name: p.name, position: p.position })),
      drawPending: this.drawNumber > 1,
      drawNumber: this.drawNumber,
      // Team mode info
      teamMode: this.teamMode,
      myTeam,
      teammatePosition: teammate?.position ?? null,
      // Random UNO button position (only sent when player has 1 card and hasn't called)
      unoButtonPosition: this.unoButtonPositions[socketId] || null
    }
  }
}
