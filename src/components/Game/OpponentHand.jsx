export default function OpponentHand({ opponent, position, isCurrentTurn }) {
  const isTeammate = opponent.isTeammate && opponent.cards

  return (
    <div className={`opponent-hand ${position} ${isCurrentTurn ? 'current-turn' : ''} ${opponent.isTeammate ? 'teammate' : ''}`}>
      <span className="opponent-name">
        {opponent.name}
        {opponent.isTeammate && <span className="teammate-badge"> (Teammate)</span>}
        {isCurrentTurn && <span className="turn-indicator"> ⬅</span>}
      </span>

      {isTeammate ? (
        // Show teammate's actual cards
        <div className="teammate-cards">
          {opponent.cards.map((card, i) => (
            <div key={i} className={`card mini-card ${card.color || ''}`}>
              {card.image ? (
                <img src={card.image} alt={card.type} />
              ) : (
                <span className="card-label">{card.type}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Show card backs for opponents
        <div className="card-backs">
          {Array.from({ length: Math.min(opponent.cardCount, 10) }).map((_, i) => (
            <div key={i} className="card-back" />
          ))}
          {opponent.cardCount > 10 && (
            <span className="card-overflow">+{opponent.cardCount - 10}</span>
          )}
        </div>
      )}

      <span className="card-count">{opponent.cardCount} cards</span>
    </div>
  )
}
