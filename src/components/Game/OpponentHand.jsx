export default function OpponentHand({ opponent, position, isCurrentTurn }) {
  return (
    <div className={`opponent-hand ${position} ${isCurrentTurn ? 'current-turn' : ''}`}>
      <span className="opponent-name">
        {opponent.name}
        {isCurrentTurn && <span className="turn-indicator"> ⬅</span>}
      </span>
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
