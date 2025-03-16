import React from 'react';
import { useAuth } from '../context/AuthContext';

interface LogoutButtonProps {
  className?: string;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ className }) => {
  const { signOut, user } = useAuth();

  if (!user) return null;

  return (
    <button
      onClick={signOut}
      className={`px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors ${className || ''}`}
    >
      Logout
    </button>
  );
};

export default LogoutButton;