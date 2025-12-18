export default function OpponentHand({ opponent, position }) {
  return (
    <div className={`opponent-hand ${position}`}>
      <span className="opponent-name">{opponent.name}</span>
      <div className="card-backs">
        {Array.from({ length: Math.min(opponent.cardCount, 10) }).map((_, i) => (
          <div key={i} className="card-back" />
        ))}
        {opponent.cardCount > 10 && (
          <span className="card-overflow">+{opponent.cardCount - 10}</span>
        )}
      </div>
      <span className="card-count">{opponent.cardCount} cards</span>
    </div>
  )
}
