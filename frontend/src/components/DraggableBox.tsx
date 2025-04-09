import React, { useState, useRef, useEffect, ReactNode } from 'react';
import '../styles/draggable-stats.css';
import defaultAvatar from '../assets/ui/default-avatar.png';

interface DraggableBoxProps {
  title: string;
  avatar?: string;
  initialPosition?: { x: number; y: number };
  children: ReactNode;
}

const DraggableBox: React.FC<DraggableBoxProps> = ({
  title,
  avatar,
  initialPosition = { x: 800, y: 100 },
  children,
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
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
      className="draggable-stat-box"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: isDragging ? 1001 : 1000,
      }}
    >
      <div className="drag-handle" onMouseDown={handleMouseDown}>⋮⋮</div>
      <div className="stat-header">
        {avatar && (
          <img
            src={avatar.trim() !== '' ? avatar : defaultAvatar}
            alt="Avatar"
            className="profile-picture"
            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '10px' }}
            onError={(e) => {
              e.currentTarget.src = defaultAvatar;
            }}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
          />
        )}
        <h3 className="stat-title">{title}</h3>
      </div>
      <div className="draggable-box-content">
        {children}
      </div>
    </div>
  );
};

export default DraggableBox;
