const Hand = ({ cards = [], onCardClick = () => {} }) => {
    const handleClick = (e, card, index) => {
        onCardClick(card, index, e.currentTarget)
    }

    return (
        <div className="hand">
            {cards.map((card, index) => (
                <button
                    className={`card ${card.color || ''}`}
                    key={index}
                    type="button"
                    onClick={(e) => handleClick(e, card, index)}
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