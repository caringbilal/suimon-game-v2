import React from 'react';

interface LogoutButtonProps {
  className?: string;
  onSignOut?: () => void;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ className, onSignOut }) => {
  const handleClick = () => {
    if (onSignOut) {
      onSignOut();
    }
  };

  return (
    <button className={className} onClick={handleClick}>
      Logout
    </button>
  );
};

export default LogoutButton;