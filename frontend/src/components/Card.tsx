import React from 'react';
import { useDrag } from 'react-dnd';
import { CardType } from '../types/game';
import '../styles/card.css';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isAttacking?: boolean;
  isDefending?: boolean;
  onAnimationEnd?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const Card: React.FC<CardProps> = ({ card, onClick, isAttacking, isDefending, onAnimationEnd, onError }) => {
  const [{ isDragging }, dragRef] = useDrag<CardType, unknown, { isDragging: boolean }>({
    type: 'CARD',
    item: card,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Validate card data before rendering
  if (!card || !card.id || !card.maxHp) {
    console.error('Invalid card data:', card);
    return null; // Prevent rendering if card data is invalid
  }

  // Log card details for debugging
  console.log(`Rendering Card: ${card.name}, HP: ${card.hp}, MaxHP: ${card.maxHp}, Image: ${card.imageUrl}`);

  // Ensure image URL is valid, provide a fallback if not
  const imageUrl = card.imageUrl && card.imageUrl.startsWith('/')
    ? `${process.env.PUBLIC_URL}${card.imageUrl}`
    : card.imageUrl || '/monsters/default-card.png';

  return (
    <div
      ref={dragRef as unknown as React.LegacyRef<HTMLDivElement>}
      className={`card ${isDragging ? 'card-dragging' : ''} ${isAttacking ? 'attacking' : ''} ${isDefending ? 'defending' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      onClick={onClick}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="card-title">
        {card.name || 'Unknown Card'}
        <span className="health-percentage">{Math.round((card.hp / card.maxHp) * 100)}%</span>
      </div>
      <div className="card-image">
        <img
          src={imageUrl}
          alt={card.name || 'Card'}
          onError={(e) => {
            console.error(`Failed to load image for card ${card.id}: ${imageUrl}`);
            e.currentTarget.src = `${process.env.PUBLIC_URL}/monsters/card-back.png`; // Fallback image
            if (onError) onError(e); // Call the passed onError handler
          }}
        />
      </div>
      <div className="card-stats">
        <div className="stat">
          <span className="stat-label">ATK</span>
          <span className="stat-value">{card.attack || 0}</span>
        </div>
        <div className="stat">
          <span className="stat-label">DEF</span>
          <span className="stat-value">{card.defense || 0}</span>
        </div>
        <div className="stat">
          <span className="stat-label">HP</span>
          <span className="stat-value">{card.hp || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default Card;