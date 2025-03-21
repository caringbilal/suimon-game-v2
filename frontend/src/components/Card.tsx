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
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void; // Add onError prop
}

const Card: React.FC<CardProps> = ({ card, onClick, isAttacking, isDefending, onAnimationEnd, onError }) => {
  const [{ isDragging }, dragRef] = useDrag<CardType, unknown, { isDragging: boolean }>({
    type: 'CARD',
    item: card,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Log card details outside of JSX
  console.log(`Card: ${card.name}, HP: ${card.hp}, MaxHP: ${card.maxHp}, Image: ${card.imageUrl}`);

  return (
    <div
      ref={dragRef as unknown as React.LegacyRef<HTMLDivElement>}
      className={`card ${isDragging ? 'card-dragging' : ''} ${isAttacking ? 'attacking' : ''} ${isDefending ? 'defending' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      onClick={onClick}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="card-title">
        {card.name}
        <span className="health-percentage">{Math.round((card.hp / card.maxHp) * 100)}%</span>
      </div>
      <div className="card-image">
        <img
          src={card.imageUrl ? (card.imageUrl.startsWith('/') ? `${process.env.PUBLIC_URL}${card.imageUrl}` : card.imageUrl) : ''}
          alt={card.name || 'Card'}
          onError={onError} // Use the onError prop passed from GameBoard.tsx
        />
      </div>
      <div className="card-stats">
        <div className="stat">
          <span className="stat-label">ATK</span>
          <span className="stat-value">{card.attack}</span>
        </div>
        <div className="stat">
          <span className="stat-label">DEF</span>
          <span className="stat-value">{card.defense}</span>
        </div>
        <div className="stat">
          <span className="stat-label">HP</span>
          <span className="stat-value">{card.hp}</span>
        </div>
      </div>
    </div>
  );
};

export default Card;