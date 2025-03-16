import React, { useEffect } from 'react';
import Confetti from 'react-confetti';
import '../styles/dialog.css';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  isVictory?: boolean;
}

const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, message, isVictory = false }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      {isVictory && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          numberOfPieces={200}
          recycle={false}
          run={isOpen}
          colors={['#ff6b6b', '#4ecdc4', '#45b7d1', '#96c93d', '#f7d794']}
          confettiSource={{
            x: window.innerWidth / 2,
            y: 0,
            w: window.innerWidth,
            h: 0
          }}
        />
      )}

      <div className="dialog-overlay" onClick={onClose}>
        <div className="dialog-box" onClick={e => e.stopPropagation()}>
          <div className="dialog-header">
            <h2>{title}</h2>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="dialog-content">
            <p>{message}</p>
          </div>
          <div className="dialog-footer">
            <button className="confirm-btn" onClick={onClose}>
              OK
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dialog;