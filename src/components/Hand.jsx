import React from 'react'

const Hand = ({ cards = [], onCardClick = () => {} }) => {
    return (
        <div className="hand">
            {cards.map((card, index) => (
                <button
                    className={`card ${card.color || ''}`}
                    key={index}
                    type="button"
                    onClick={() => onCardClick(card, index)}
                >
                    {/* show image if available, otherwise show type text */}
                    {card.image ? (
                        <img src={card.image || card.src || ''} alt={card.type + card.color} />
                    ) : (
                        <div className="card-label">{card.type}</div>
                    )}
                    {/* always show a small type label for accessibility */}
                    <div className="card-type-small">{card.type}</div>
                </button>
            ))}
        </div>
    )
}

export default Hand