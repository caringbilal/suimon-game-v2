import React, { useState, useEffect, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './App.css';
import GameBoard from '@components/GameBoard';
import GameOver from '@components/GameOver';
import { GameState, CardType } from './types/game';
import { getInitialHand } from '@data/monsters';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { io, Socket } from 'socket.io-client';
import PlayerProfile from './assets/ui/Player_Profile.jpg';
import OpponentProfile from './assets/ui/AIPlayer_Profile.jpg';
import { useAuth } from './context/AuthContext';
import LogoutButton from './components/LogoutButton';
import LeaderboardTable from './components/LeaderboardTable';

// Define the server URL for AWS deployment
const SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002'; // Local development server
const socket: Socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: false,
  forceNew: true
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
            playerName: decoded.name
          })
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
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // State variables
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<'player1' | 'player2' | null>(null);
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);
  const [players, setPlayers] = useState<Array<{ playerId: string; playerName: string; createdAt: number; updatedAt: number; }>>([]);
  const [games, setGames] = useState<Array<{ gameId: string; startTime: number; player1Id: string; player2Id: string; gameState: string; winner: string; }>>([]);

  // Player info constants
  const player1Info = {
    name: playerRole === 'player1' ? (user?.name || 'Player 1') : 'Opponent',
    avatar: playerRole === 'player1' ? (user?.picture || PlayerProfile) : OpponentProfile
  };

  const player2Info = {
    name: playerRole === 'player2' ? (user?.name || 'Player 2') : 'Opponent',
    avatar: playerRole === 'player2' ? (user?.picture || PlayerProfile) : OpponentProfile
  };

  // Determine current player and opponent info based on role
  const currentPlayerInfo = playerRole === 'player1' ? player1Info : player2Info;
  const currentOpponentInfo = playerRole === 'player1' ? player2Info : player1Info;
  
  // Memoized function to add combat log entries
  const addCombatLogEntry = useCallback((message: string, type: string = 'info') => {
    setGameState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        combatLog: [
          ...prev.combatLog,
          { timestamp: Date.now(), message, type },
        ],
      };
    });
  }, []);

  // Load players and games data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch players data
        const playersResponse = await fetch(`${SERVER_URL}/players`);
        if (!playersResponse.ok) {
          throw new Error(`HTTP error! status: ${playersResponse.status}`);
        }
        const playersData = await playersResponse.json();
        console.log('Fetched players data:', playersData);
        setPlayers(Array.isArray(playersData) ? playersData : []);

        // Fetch games data
        const gamesResponse = await fetch(`${SERVER_URL}/games`);
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


  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    // Disconnect existing connection if any
    if (socket.connected) {
      socket.disconnect();
    }
    
    // Set query parameters to include player ID if authenticated
    if (user && user.sub) {
      socket.io.opts.query = { playerId: user.sub };
    }
    
    socket.connect();
    socket.io.on("reconnect_attempt", () => {
      setDialogMessage("Attempting to reconnect...");
    });
    
    socket.io.on("reconnect", () => {
      setDialogMessage("Reconnected to server!");
      setTimeout(() => setDialogMessage(null), 3000);
    });
    
    socket.io.on("reconnect_failed", () => {
      setDialogMessage("Failed to reconnect. Please refresh the page.");
    });
  }, [user]);

  // Handle Socket.IO events
  useEffect(() => {
    // Only initialize socket if user is authenticated
    if (isAuthenticated) {
      // Initialize socket connection
      initializeSocket();
      socket.on('connect', () => {
        console.log('Connected to server at', SERVER_URL);
      });

      socket.on('roomCreated', (id: string) => {
        console.log('Room created event received:', id);
        setDialogMessage('Room created successfully. Waiting for opponent...');
        setRoomId(id);
        setPlayerRole('player1');
      });

      socket.on('joinSuccess', (id: string) => {
        console.log('Join success event received:', id);
        setDialogMessage('Successfully joined the room. Game will start soon...');
        setRoomId(id);
        // Ensure Player 1 knows a player has joined
        if (playerRole === 'player1') {
          setDialogMessage('Player 2 has joined! Game starting...');
        }
      });

      socket.on('startGame', (id: string) => {
        console.log('Start game event received:', id);
        setDialogMessage('Game starting...');
        setRoomId(id);
        if (!playerRole) {
          console.log('Setting player role to player2');
          setPlayerRole('player2');
        }
        const initialState: GameState = {
          players: {
            player: { id: 'player1', energy: MAX_ENERGY, deck: [], hand: getInitialHand() },
            opponent: { id: 'player2', energy: MAX_ENERGY, deck: [], hand: getInitialHand() },
          },
          battlefield: { player: [], opponent: [] },
          currentTurn: 'player',
          gameStatus: 'playing',
          playerMaxHealth: MAX_ENERGY,
          opponentMaxHealth: MAX_ENERGY,
          combatLog: [],
          killCount: { player: 0, opponent: 0 },
        };
        console.log('Setting initial game state:', initialState);
        setGameState(initialState);
        if (playerRole === 'player1') {
          console.log('Player1 emitting initial game state');
          socket.emit('updateGameState', id, initialState);
        }
      });

      socket.on('gameStateUpdate', (newState: GameState) => {
        console.log('Game state update received:', newState);
        setGameState(newState);
        setDialogMessage(null);
      });

      socket.on('error', (msg: string) => {
        console.log('Error received:', msg);
        setDialogMessage(`Failed to connect: ${msg}. Please try again.`);
        if (msg.includes('Room does not exist') || msg.includes('Room is full')) {
          setRoomId(null);
          setPlayerRole(null);
          setGameState(null);
        }
      });

      socket.on('playerDisconnected', () => {
        console.log('Player disconnected');
        setDialogMessage('Opponent disconnected. Game ended.');
        setRoomId(null);
        setPlayerRole(null);
        setGameState(null);
      });

      socket.on('connect_error', (error) => {
        console.log('Connection error:', error.message);
        setDialogMessage(`Connection failed: ${error.message}. Please try again or check network.`);
        socket.disconnect();
        setRoomId(null);
        setPlayerRole(null);
        setGameState(null);
      });

      // Cleanup listeners on unmount or when auth state changes
      return () => {
        socket.off('connect');
        socket.off('roomCreated');
        socket.off('joinSuccess');
        socket.off('startGame');
        socket.off('gameStateUpdate');
        socket.off('error');
        socket.off('playerDisconnected');
        socket.off('connect_error');
        socket.offAny();
      };
    }
  }, [playerRole, initializeSocket, isAuthenticated]);

  // Handle player card play
  const handleCardPlay = (card: CardType) => {
    if (!gameState || !roomId || !playerRole) return;

    const isPlayerTurn =
      playerRole === 'player1'
        ? gameState.currentTurn === 'player'
        : gameState.currentTurn === 'opponent';
    if (!isPlayerTurn) return;

    const playerKey = playerRole === 'player1' ? 'player' : 'opponent';
    const opponentKey = playerKey === 'player' ? 'opponent' : 'player';
    const updatedHand = gameState.players[playerKey].hand.filter((c) => c.id !== card.id);
    const updatedBattlefield = { ...gameState.battlefield, [playerKey]: [card] };
    const totalCards = updatedHand.length + updatedBattlefield[playerKey].length;
    const cardsToDraw = Math.max(0, 4 - totalCards);
    const newCards = getInitialHand(cardsToDraw).map(card => ({ ...card, hp: card.maxHp }));
    const finalHand = [...updatedHand, ...newCards];

    const newState: GameState = {
      ...gameState,
      players: {
        ...gameState.players,
        [playerKey]: { ...gameState.players[playerKey], hand: finalHand },
      },
      battlefield: updatedBattlefield,
      currentTurn: opponentKey,
      gameStatus: 'playing',
    };

    setGameState(newState);
    socket.emit('updateGameState', roomId, newState);
  };

  // Handle card defeated event
  const handleCardDefeated = useCallback((defeatedPlayerKey: 'player' | 'opponent') => {
    console.log(`Card defeated for ${defeatedPlayerKey}`);
    setGameState((prevState) => {
      if (!prevState) return prevState;
      const newKillCount = { ...prevState.killCount };
      const killerKey = defeatedPlayerKey === 'player' ? 'opponent' : 'player';
      newKillCount[killerKey] += 1;
      return {
        ...prevState,
        killCount: newKillCount
      };
    });
  }, []);

  // Render login screen if not authenticated
  if (!isAuthenticated && !authLoading) {
    return <LoginScreen />;
  }

  // Create a new game room
  const createRoom = () => {
    if (!isAuthenticated) return;
    socket.emit('createRoom');
  };

  // Join an existing game room
  const joinRoom = () => {
    if (!isAuthenticated || !joinRoomInput) return;
    socket.emit('joinRoom', joinRoomInput);
  };

  // If auth is still loading, show a loading indicator
  if (authLoading) {
    return <div className="loading">Loading...</div>;
  }

  // If user is not authenticated, show login screen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // If game is over, show game over screen
  if (gameState && gameState.gameStatus === 'finished') {
    const playerEnergy = gameState.players.player.energy;
    const opponentEnergy = gameState.players.opponent.energy;
    // Determine winner based on who has zero energy
    const winner = playerEnergy <= 0 ? 'opponent' : 'player';

    // Update game result in the database
    if (user && roomId) {
      const gameData = {
        gameId: roomId,
        startTime: Date.now(),
        player1Id: playerRole === 'player1' ? user.sub : '',
        player2Id: playerRole === 'player2' ? user.sub : '',
        gameState: 'finished',
        winner: winner === 'player' ? (playerRole === 'player1' ? user.sub : '') : (playerRole === 'player2' ? user.sub : '')
      };

      // Send game result to backend
      fetch(`${SERVER_URL}/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gameData)
      })
      .then(response => response.json())
      .then(() => {
        // Refresh leaderboard data
        fetch(`${SERVER_URL}/games`)
          .then(response => response.json())
          .then(data => setGames(data))
          .catch(error => console.error('Error fetching games:', error));

        fetch(`${SERVER_URL}/players`)
          .then(response => response.json())
          .then(data => setPlayers(data))
          .catch(error => console.error('Error fetching players:', error));
      })
      .catch(error => console.error('Error updating game result:', error));
    }

    return (
      <GameOver
        winner={winner}
        playerInfo={currentPlayerInfo}
        opponentInfo={currentOpponentInfo}
        killCount={gameState.killCount}
        playerEnergy={playerEnergy}
        opponentEnergy={opponentEnergy}
        onPlayAgain={() => {
          setGameState(null);
          setRoomId(null);
          setPlayerRole(null);
        }}
      />
    );
  }

  // If game is in progress, show game board
  if (gameState && roomId) {
    return (
      <DndProvider backend={HTML5Backend}>
        <div className="game-container">
          <LogoutButton className="logout-button-game" />
          <GameBoard
            gameState={gameState}
            onCardPlay={handleCardPlay}
            setGameState={setGameState}
            playerInfo={currentPlayerInfo}
            opponentInfo={currentOpponentInfo}
            combatLog={gameState.combatLog}
            addCombatLogEntry={addCombatLogEntry}
            killCount={gameState.killCount}
            playerRole={playerRole || 'player1'}
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
        <LogoutButton className="logout-button-lobby" />
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
        <div className="room-info">
          <p>Room ID: <span className="room-id">{roomId}</span></p>
          <div className="room-details">
            <p>Your Role: <span className="role">{playerRole === 'player1' ? 'Host (Player 1)' : playerRole === 'player2' ? 'Guest (Player 2)' : 'Not assigned yet'}</span></p>
            <p>Game Status: <span className="status">{gameState ? gameState.gameStatus : 'Waiting for players'}</span></p>
            <p>Current Turn: <span className="turn">{gameState ? (gameState.currentTurn === 'player' ? 'Player 1' : 'Player 2') : 'Game not started'}</span></p>
            {playerRole === 'player1' && <p className="waiting-message">Waiting for Player 2 to join...</p>}
            {playerRole === 'player2' && <p className="waiting-message">Connected as Player 2</p>}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomId);
              setDialogMessage('Room ID copied to clipboard!');
              setTimeout(() => setDialogMessage(null), 2000);
            }}
            className="copy-room-btn"
          >
            Copy Room ID
          </button>
        </div>
      )}
      {dialogMessage && <div className="dialog-message">{dialogMessage}</div>}
    </div>
  );
}

export default App;