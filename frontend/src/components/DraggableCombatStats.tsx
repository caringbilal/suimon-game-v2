import React, { useState, useRef, useEffect } from 'react';
import '../styles/draggable-stats.css';

interface CombatLogEntry {
  timestamp: number;
  message: string;
  type: string;
}

interface DraggableCombatStatsProps {
  combatLog: CombatLogEntry[];
  playerCardsCount: number;
  opponentCardsCount: number;
  initialPosition?: { x: number; y: number };
}

const DraggableCombatStats: React.FC<DraggableCombatStatsProps> = ({
  combatLog,
  playerCardsCount,
  opponentCardsCount,
  initialPosition = { x: -240, y: 600 }
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage if available
  useEffect(() => {
    const savedPosition = localStorage.getItem('combat-stats-position');
    if (savedPosition) {
      try {
        const parsedPosition = JSON.parse(savedPosition);
        setPosition(parsedPosition);
      } catch (e) {
        console.error('Failed to parse saved position:', e);
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem('combat-stats-position', JSON.stringify(position));
    }
  }, [position, isDragging]);

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
      className="draggable-stat-box combat-stats"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: isDragging ? 1001 : 1000,
        minWidth: '320px',
      }}
    >
      <div className="drag-handle" onMouseDown={handleMouseDown}>⋮⋮</div>
      <div className="stat-header">
        <h3 className="stat-title">COMBAT STATISTICS</h3>
      </div>
      <div className="total-cards-info">
        <div className="player-cards-count">
          Player Total Cards: {playerCardsCount}
        </div>
        <div className="opponent-cards-count">
          Opponent Total Cards: {opponentCardsCount}
        </div>
      </div>
      <div className="combat-stats-content">
        {combatLog.slice(-5).map((entry, index) => (
          <div key={index} className={`combat-log-entry ${entry.type}`}>
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DraggableCombatStats;