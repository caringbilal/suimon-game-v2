import React, { useState, useRef, useEffect } from 'react';
import '../styles/draggable-stats.css';
import defaultAvatar from '../assets/ui/default-avatar.png';

interface DraggableStatBoxProps {
  type: 'player' | 'opponent';
  title: string;
  totalHP: number;
  energy: number;
  maxEnergy: number;
  avatar: string;
  kills?: number;
  initialPosition?: { x: number; y: number };
  isCurrentTurn?: boolean;
}

const DraggableStatBox: React.FC<DraggableStatBoxProps> = ({
  type,
  title,
  totalHP,
  energy,
  maxEnergy,
  avatar,
  kills,
  initialPosition = { x: -240, y: type === 'player' ? 100 : 340 },
  isCurrentTurn = false
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage if available
  useEffect(() => {
    const savedPosition = localStorage.getItem(`${type}-stat-box-position`);
    if (savedPosition) {
      try {
        const parsedPosition = JSON.parse(savedPosition);
        setPosition(parsedPosition);
      } catch (e) {
        console.error('Failed to parse saved position:', e);
      }
    }
  }, [type]);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem(`${type}-stat-box-position`, JSON.stringify(position));
    }
  }, [position, isDragging, type]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (boxRef.current) {
      // Use the mouse position relative to the element's position
      // This prevents the jumping effect when starting to drag
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      // Calculate new position based on mouse position and drag offset
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Allow free movement without constraints
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={boxRef}
      className={`draggable-stat-box ${type} ${isCurrentTurn ? 'current-turn' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: isDragging ? 1001 : 1000,
      }}
    >
      <div className="drag-handle" onMouseDown={handleMouseDown}>⋮⋮</div>
      <div className="stat-header">
        <img 
          src={avatar && avatar.trim() !== '' ? avatar : defaultAvatar} 
          alt={type === 'player' ? 'Player' : 'Opponent'} 
          className="profile-picture" 
          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '10px' }}
          onError={(e) => {
            console.error(`Failed to load profile image: ${avatar}`);
            e.currentTarget.src = defaultAvatar;
          }}
          crossOrigin="anonymous"
        />
        <h3 className="stat-title">{title}</h3>
      </div>
      <div className="stat-value">{totalHP}</div>
      <div className="hp-bar">
        <div
          className="hp-fill"
          style={{ width: `${(energy / maxEnergy) * 100}%` }}
        />
        <span>{energy} Energy</span>
      </div>
      {typeof kills !== 'undefined' && (
        <div className="kill-stat">
          <span className="kill-label">{type === 'player' ? 'Your' : 'Opponent'} Kills:</span>
          <span className="kill-value">{kills}</span>
        </div>
      )}
    </div>
  );
};

export default DraggableStatBox;