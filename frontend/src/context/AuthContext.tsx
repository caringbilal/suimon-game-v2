import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

interface User {
  email: string;
  name: string;
  picture?: string;
  sub: string; // Google's unique identifier
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => void;
  error: string | null;
  signInWithGoogle: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  signOut: () => {},
  error: null,
  signInWithGoogle: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGoogleLogin, setShowGoogleLogin] = useState(false);

  useEffect(() => {
    // Check for stored credentials on mount
    const storedCredential = localStorage.getItem('google_credential');
    if (storedCredential) {
      try {
        const decoded: any = jwtDecode(storedCredential);
        const userData: User = {
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
          sub: decoded.sub,
        };
        setUser(userData);
      } catch (error) {
        console.error('Error processing stored credential:', error);
        localStorage.removeItem('google_credential');
      }
    }
    setIsLoading(false);
  }, []);

  const handleGoogleSuccess = (credentialResponse: any) => {
    try {
      const decoded: any = jwtDecode(credentialResponse.credential);
      const userData: User = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        sub: decoded.sub,
      };
      setUser(userData);
      setError(null);
      setShowGoogleLogin(false);
      localStorage.setItem('google_credential', credentialResponse.credential);
    } catch (error) {
      console.error('Error processing Google sign-in:', error);
      setError('Failed to process Google sign-in');
    }
  };

  const handleSignOut = () => {
    setUser(null);
    setError(null);
    setShowGoogleLogin(false);
    localStorage.removeItem('google_credential');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signOut: handleSignOut,
        error,
        signInWithGoogle: () => setShowGoogleLogin(true),
      }}
    >
      {children}
      {showGoogleLogin && !user && (
        <div className="login-container">
          <div className="login-card">
            <h1>Welcome</h1>
            <p>Please sign in with your Google account to continue</p>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setError('Login Failed');
                setShowGoogleLogin(false);
              }}
            />
            {error && <p className="error-message">{error}</p>}
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);