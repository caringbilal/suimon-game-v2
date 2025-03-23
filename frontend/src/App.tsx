import React, { useState, useEffect, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './App.css';
import './styles/room-info.css';
import GameBoard from '@components/GameBoard';
import GameOver from '@components/GameOver';
import { GameState, CardType } from './types/game';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { io, Socket } from 'socket.io-client';
import PlayerProfile from './assets/ui/Player_Profile.jpg';
import OpponentProfile from './assets/ui/AIPlayer_Profile.jpg';
import { useAuth } from './context/AuthContext';
import LogoutButton from '@components/LogoutButton';
import LeaderboardTable from '@components/LeaderboardTable';
import RoomInfoBox from '@components/RoomInfoBox';

// Define the server URL for AWS deployment
const SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

// Initialize socket outside the component to ensure a single instance
const socket: Socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true, // Enable reconnection
  autoConnect: false,
});

// Login component
const LoginScreen: React.FC = () => {
  const { isLoading, error } = useAuth();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const decoded: any = jwtDecode(credentialResponse.credential);
      const userData = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        sub: decoded.sub,
      };

      // Create or update player in the database
      try {
        const response = await fetch(`${SERVER_URL}/players`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playerId: decoded.sub,
            playerName: decoded.name,
            avatar: decoded.picture,
          }),
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to register player');
        }
      } catch (error) {
        console.error('Error registering player:', error);
      }

      localStorage.setItem('google_credential', credentialResponse.credential);
      window.location.reload();
    } catch (error) {
      console.error('Error processing Google sign-in:', error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Suimon Card Game</h1>
        <p>Sign in to play and track your progress</p>

        <div className="google-login-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => console.error('Login Failed')}
            theme="filled_blue"
            size="large"
            shape="pill"
            text="continue_with"
            useOneTap
          />
        </div>

        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
};

function App() {
  console.log('App component is rendering');
  // Game constants
  const MAX_ENERGY = 700;

  // Auth state
  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAuth();

  // State variables
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<'player1' | 'player2' | null>(null);
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);
  const [players, setPlayers] = useState<
    Array<{ playerId: string; playerName: string; createdAt: number; updatedAt: number }>
  >([]);
  const [games, setGames] = useState<
    Array<{ gameId: string; startTime: number; player1Id: string; player2Id: string; gameState: string; winner: string }>
  >([]);
  const [opponentInfo, setOpponentInfo] = useState<{ name: string; avatar: string }>({
    name: 'Waiting...',
    avatar: OpponentProfile,
  });

  // Player info for the current user
  const playerInfo = {
    name: user?.name || 'Player',
    avatar: user?.picture || PlayerProfile,
  };

  // Memoized function to add combat log entries
  const addCombatLogEntry = useCallback((message: string, type: string) => {
    setGameState((prevState) => {
      if (!prevState) return prevState;
      return {
        ...prevState,
        combatLog: [
          ...prevState.combatLog,
          { timestamp: Date.now(), message, type }
        ]
      };
    });
  }, []);

  // Load players and games data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const playersResponse = await fetch(`${SERVER_URL}/players`, {
          credentials: 'include',
        });
        if (!playersResponse.ok) {
          throw new Error(`HTTP error! status: ${playersResponse.status}`);
        }
        const playersData = await playersResponse.json();
        console.log('Fetched players data:', playersData);
        setPlayers(Array.isArray(playersData) ? playersData : []);

        const gamesResponse = await fetch(`${SERVER_URL}/games`, {
          credentials: 'include',
        });
        if (!gamesResponse.ok) {
          throw new Error(`HTTP error! status: ${gamesResponse.status}`);
        }
        const gamesData = await gamesResponse.json();
        console.log('Fetched games data:', gamesData);
        setGames(Array.isArray(gamesData) ? gamesData : []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setDialogMessage('Failed to load leaderboard data. Please try again later.');
      }
    };

    if (isAuthenticated && user) {
      fetchData();
    }
  }, [isAuthenticated, user]);

  // Initialize socket connection and handle reconnection
  const initializeSocket = useCallback(() => {
    if (socket.connected) {
      socket.disconnect();
    }

    if (user && user.sub) {
      socket.io.opts.query = { playerId: user.sub };
    }

    socket.connect();
    socket.io.on('reconnect_attempt', () => {
      setDialogMessage('Attempting to reconnect...');
    });

    socket.io.on('reconnect', () => {
      setDialogMessage('Reconnected to server!');
      setTimeout(() => setDialogMessage(null), 3000);
      // Rejoin the room if it still exists
      if (roomId) {
        socket.emit('reconnect', { playerId: user?.sub, roomId });
        socket.emit('joinRoom', { roomId, playerData: { playerId: user?.sub, playerName: user?.name } });
      }
    });

    socket.io.on('reconnect_failed', () => {
      setDialogMessage('Failed to reconnect. Please refresh the page.');
    });
  }, [user, roomId]);

  // Handle Socket.IO events
  useEffect(() => {
    if (isAuthenticated) {
      initializeSocket();

      socket.on('connect', () => {
        console.log('Connected to server at', SERVER_URL, 'with socket ID:', socket.id);
      });

      socket.on('roomCreated', (data: { roomId: string; player: any }) => {
        console.log('=== ROOM CREATED SUCCESSFULLY ===');
        console.log('Room ID:', data.roomId);
        console.log('Host Player:', data.player.playerName);
        console.log('Status: Waiting for opponent');
        console.log('================================');
        setDialogMessage(
          `Room ${data.roomId} created successfully. Share this Room ID with your opponent to start playing!`
        );
        setRoomId(data.roomId);
        setPlayerRole('player1');
        console.log('State after roomCreated:', { roomId: data.roomId, playerRole: 'player1', gameState });
      });

      socket.on('playerJoined', (data: { player2: { id: string; name: string; avatar: string } }) => {
        console.log('Player joined event received for socket ID:', socket.id, 'data:', data);
        if (data && data.player2 && data.player2.name) {
          setDialogMessage(`${data.player2.name} has joined! Game starting...`);
        } else {
          setDialogMessage('A player has joined! Game starting...');
        }
      });

      socket.on('joinSuccess', (data: { roomId: string; player1: { id: string; name: string; avatar: string } }) => {
        console.log('Join success event received for socket ID:', socket.id, 'data:', data);
        setDialogMessage('Successfully joined the room. Game will start soon...');
        setRoomId(data.roomId);
        setPlayerRole('player2');
        console.log('State after joinSuccess:', { roomId: data.roomId, playerRole: 'player2', gameState });
      });

      socket.on('gameStarted', (data: { player1: { name: string; avatar: string }; player2: { name: string; avatar: string } }) => {
        console.log('Game started event received for socket ID:', socket.id, 'data:', data);
        setDialogMessage('Game has started!');
      });

      socket.on('updateOpponentInfo', (opponentData: { name: string; avatar: string }) => {
        console.log('Updating opponent info for socket ID:', socket.id, 'opponentData:', opponentData);
        setOpponentInfo(opponentData);
      });

      socket.on(
        'gameStateUpdated',
        (data: { gameState: GameState; playerRole?: 'player1' | 'player2' }) => {
          console.log('Game state updated received for socket ID:', socket.id, 'data:', data);
          
          // Always set playerRole if provided
          if (data.playerRole) {
            console.log(`Setting playerRole to ${data.playerRole} from gameStateUpdated event`);
            setPlayerRole(data.playerRole);
          }
          
          // Always update game state when received
          if (data.gameState) {
            console.log('Setting gameState:', data.gameState);
            setGameState(data.gameState);
            if (data.gameState.gameStatus === 'finished') {
              const winner = data.gameState.player1.energy <= 0 ? 'player2' : 'player1';
              const winnerName =
                data.gameState.winner?.name ||
                (winner === 'player1' ? (playerRole === 'player1' ? playerInfo.name : opponentInfo.name) : (playerRole === 'player2' ? playerInfo.name : opponentInfo.name));
              setDialogMessage(`Game Over! ${winnerName} wins!`);
              if (roomId && user) {
                socket.emit('gameEnded', {
                  roomId,
                  player1Id: playerRole === 'player1' ? user.sub : '',
                  player2Id: playerRole === 'player2' ? user.sub : '',
                  player1Wins: winner === 'player1' ? 1 : 0,
                  player1Losses: winner === 'player2' ? 1 : 0,
                  player2Wins: winner === 'player2' ? 1 : 0,
                  player2Losses: winner === 'player1' ? 1 : 0,
                  gameState: data.gameState,
                });
              }
            } else {
              setDialogMessage(null);
            }
          } else {
            console.error('gameStateUpdated received with no gameState:', data);
          }
          console.log('State after gameStateUpdated:', { roomId, playerRole, gameState: data.gameState });
        }
      );

      socket.on('error', (msg: string) => {
        console.log('Error received for socket ID:', socket.id, 'message:', msg);
        setDialogMessage(`Failed to connect: ${msg}. Please try again.`);
        if (msg.includes('Room does not exist') || msg.includes('Room is full') || msg.includes('Player 1 is disconnected')) {
          setRoomId(null);
          setPlayerRole(null);
          setGameState(null);
          setOpponentInfo({ name: 'Waiting...', avatar: OpponentProfile });
        }
      });

      socket.on('playerDisconnected', () => {
        console.log('Player disconnected event received for socket ID:', socket.id);
        setDialogMessage('Opponent disconnected. Game ended.');
        setRoomId(null);
        setPlayerRole(null);
        setGameState(null);
        setOpponentInfo({ name: 'Waiting...', avatar: OpponentProfile });
      });

      socket.on('connect_error', (error) => {
        console.log('Connection error for socket ID:', socket.id, 'error:', error.message);
        setDialogMessage(`Connection failed: ${error.message}. Please try again or check network.`);
        setRoomId(null);
        setPlayerRole(null);
        setGameState(null);
        setOpponentInfo({ name: 'Waiting...', avatar: OpponentProfile });
      });

      // Cleanup on unmount
      return () => {
        socket.off('connect');
        socket.off('roomCreated');
        socket.off('joinSuccess');
        socket.off('playerJoined');
        socket.off('updateOpponentInfo');
        socket.off('gameStateUpdated');
        socket.off('error');
        socket.off('playerDisconnected');
        socket.off('connect_error');
        socket.offAny();
        socket.disconnect();
      };
    } else {
      // Disconnect socket if not authenticated
      socket.disconnect();
    }
  }, [isAuthenticated, user]);

  // Handle player card play
  const handleCardPlay = (card: CardType) => {
    if (!gameState || !roomId || !playerRole) return;

    const isPlayerTurn =
      playerRole === 'player1' ? gameState.currentTurn === 'player1' : gameState.currentTurn === 'player2';
    if (!isPlayerTurn) return;

    socket.emit('cardPlayed', { roomId, card, playerRole });
  };

  // Handle card defeated event
  const handleCardDefeated = useCallback((defeatedPlayerKey: 'player1' | 'player2') => {
    setGameState((prevState: GameState | null) => {
      if (!prevState) return prevState;
      const newKillCount = { ...prevState.killCount };
      const killerKey = defeatedPlayerKey === 'player1' ? 'player2' : 'player1';
      newKillCount[killerKey] += 1;
      return {
        ...prevState,
        killCount: newKillCount,
      };
    });
  }, []);

  // addCombatLogEntry is already defined above

  // Create a new game room
  const createRoom = () => {
    if (!isAuthenticated || !user?.sub || !user?.name) {
      setDialogMessage('Please ensure you are properly logged in.');
      return;
    }
    const playerData = {
      playerId: user.sub,
      playerName: user.name,
      avatar: user.picture, // Pass Google profile picture URL
    };
    socket.emit('createRoom', playerData);
  };

  // Join an existing game room
  const joinRoom = () => {
    if (!isAuthenticated || !joinRoomInput) return;
    socket.emit('joinRoom', { roomId: joinRoomInput, playerData: { playerId: user?.sub, playerName: user?.name, avatar: user?.picture } });
  };

  // Render login screen if not authenticated
  if (!isAuthenticated && !authLoading) {
    return <LoginScreen />;
  }

  // If auth is still loading, show a loading indicator
  if (authLoading) {
    return <div className="loading">Loading...</div>;
  }

  // If game is over, show game over screen
  if (gameState && gameState.gameStatus === 'finished') {
    const playerEnergy = playerRole === 'player1' ? gameState.player1.energy : gameState.player2.energy;
    const opponentEnergy = playerRole === 'player1' ? gameState.player2.energy : gameState.player1.energy;
    const winner = gameState.player1.energy <= 0 ? 'player2' : 'player1';

    // Refresh leaderboard data
    fetch(`${SERVER_URL}/games`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setGames(data))
      .catch((error) => console.error('Error fetching games:', error));

    fetch(`${SERVER_URL}/players`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setPlayers(data))
      .catch((error) => console.error('Error fetching players:', error));

    return (
      <GameOver
        winner={winner}
        playerRole={playerRole!} // Pass playerRole to GameOver
        playerInfo={playerInfo}
        opponentInfo={opponentInfo}
        killCount={gameState.killCount}
        playerEnergy={playerEnergy}
        opponentEnergy={opponentEnergy}
        onPlayAgain={() => {
          setGameState(null);
          setRoomId(null);
          setPlayerRole(null);
          setOpponentInfo({ name: 'Waiting...', avatar: OpponentProfile });
        }}
      />
    );
  }

  // If game is in progress, show game board
  if (gameState && roomId && playerRole) {
    console.log('Rendering GameBoard with gameState:', gameState, 'roomId:', roomId, 'playerRole:', playerRole);
    return (
      <DndProvider backend={HTML5Backend}>
        <div className="game-container">
          <GameBoard
            gameState={gameState}
            onCardPlay={handleCardPlay}
            setGameState={setGameState}
            playerInfo={playerInfo}
            opponentInfo={opponentInfo}
            combatLog={gameState.combatLog}
            addCombatLogEntry={addCombatLogEntry}
            killCount={gameState.killCount}
            playerRole={playerRole}
            roomId={roomId}
            socket={socket}
            onCardDefeated={(defeatedPlayerKey) => handleCardDefeated(defeatedPlayerKey)}
          />
        </div>
      </DndProvider>
    );
  }

  // If no game is in progress, show lobby
  return (
    <div className="lobby">
      <div className="user-profile">
        <img src={user?.picture || PlayerProfile} alt="Profile" className="profile-image" />
        <h2>Welcome, {user?.name || 'Player'}!</h2>
        <LogoutButton
          className="logout-button-lobby"
          onSignOut={() => {
            socket.emit('logout', user?.sub);
            signOut();
            setOpponentInfo({ name: 'Waiting...', avatar: OpponentProfile });
          }}
        />
      </div>

      <h1>Suimon Card Game</h1>

      <LeaderboardTable players={players} games={games} />
      <div className="room-controls">
        <button onClick={createRoom} className="create-room-btn">
          Create New Game
        </button>
        <div className="join-room-container">
          <input
            type="text"
            value={joinRoomInput}
            onChange={(e) => setJoinRoomInput(e.target.value)}
            placeholder="Enter Room ID"
            className="room-input"
          />
          <button onClick={joinRoom} disabled={!joinRoomInput} className="join-room-btn">
            Join Game
          </button>
        </div>
      </div>
      {roomId && (
        <RoomInfoBox
          roomId={roomId}
          playerRole={playerRole}
          gameState={gameState}
          onCopyRoomId={() => {
            navigator.clipboard.writeText(roomId);
            setDialogMessage('Room ID copied to clipboard!');
            setTimeout(() => setDialogMessage(null), 2000);
          }}
          onSignOut={() => {
            socket.emit('logout', user?.sub);
            signOut();
            setOpponentInfo({ name: 'Waiting...', avatar: OpponentProfile });
          }}
        />
      )}
      {dialogMessage && <div className="dialog-message">{dialogMessage}</div>}
    </div>
  );
}

export default App;