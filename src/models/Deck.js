export default class Deck {
  constructor(type, color, image) {
    this.type = type.toLowerCase() // 'p','r','n','b','q','k'
    this.color = color // 'white' or 'black'
    // const key = color === 'white' ? this.type.toUpperCase() : this.type
    this.image = image
    this.moved = false
  }
}