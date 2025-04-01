import React, { useState, useEffect, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './App.css';
import './styles/room-info.css';
import './styles/game-modes.css';
import GameBoard from '@components/GameBoard';
import GameOver from '@components/GameOver';
import { GameState, CardType } from './types/game';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { io, Socket } from 'socket.io-client';
import PlayerProfile from './assets/ui/Player_Profile.jpg';
import OpponentProfile from './assets/ui/AIPlayer_Profile.jpg';
import { useAuth } from './context/AuthContext';
import LeaderboardTable from '@components/LeaderboardTable';
import RoomInfoBox from '@components/RoomInfoBox';
import ParticlesBackground from '@components/Particles';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { SuiWalletProvider, useSuiWallet } from './context/SuiWalletContext';
import WalletConnection from './components/WalletConnection';
import GameOptions from './components/GameOptions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Define the network type explicitly
type SuiNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

// Define network configurations directly without createNetworkConfig
const networks = {
  testnet: { url: getFullnodeUrl('testnet' as SuiNetwork), name: 'Sui Testnet' },
  mainnet: { url: getFullnodeUrl('mainnet' as SuiNetwork), name: 'Sui Mainnet' },
  devnet: { url: getFullnodeUrl('devnet' as SuiNetwork), name: 'Sui Devnet' },
};

// Create a single QueryClient instance
const queryClient = new QueryClient();

const SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

const socket: Socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  autoConnect: false,
});

const LoginScreen: React.FC = () => {
  const { isLoading, error } = useAuth();
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const decoded: any = jwtDecode(credentialResponse.credential);
      const userData = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        sub: decoded.sub,
      };

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

      setIsFadingOut(true);
      setTimeout(() => {
        localStorage.setItem('google_credential', credentialResponse.credential);
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error processing Google sign-in:', error);
    }
  };

  return (
    <div className="login-container">
      <ParticlesBackground className={`particles ${isFadingOut ? 'particles-fade-out' : ''}`} />
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
  const MAX_ENERGY = 700;
  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const { isConnected, suiBalance, suimonBalance } = useSuiWallet();

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
  const [opponentInfo, setOpponentInfo] = useState<{ name: string; avatar: string } | null>(null);

  const playerInfo = {
    name: user?.name || 'Player',
    avatar: user?.picture || PlayerProfile,
  };

  const addCombatLogEntry = useCallback((message: string, type: string) => {
    setGameState((prevState) => {
      if (!prevState) return prevState;
      return {
        ...prevState,
        combatLog: [
          ...prevState.combatLog,
          { timestamp: Date.now(), message, type },
        ],
      };
    });
  }, []);

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
        setPlayers(Array.isArray(playersData) ? playersData : []);

        const gamesResponse = await fetch(`${SERVER_URL}/games`, {
          credentials: 'include',
        });
        if (!gamesResponse.ok) {
          throw new Error(`HTTP error! status: ${gamesResponse.status}`);
        }
        const gamesData = await gamesResponse.json();
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
      if (roomId) {
        socket.emit('reconnect', { playerId: user?.sub, roomId });
        socket.emit('joinRoom', { roomId, playerData: { playerId: user?.sub, playerName: user?.name, avatar: user?.picture } });
      }
    });

    socket.io.on('reconnect_failed', () => {
      setDialogMessage('Failed to reconnect. Please refresh the page.');
    });
  }, [user, roomId]);

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
        setOpponentInfo(null);
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
        setOpponentInfo(null);
      });

      socket.on('gameStarted', (data: { player1: { name: string; avatar: string }; player2: { name: string; avatar: string } }) => {
        console.log('Game started event received for socket ID:', socket.id, 'data:', data);
        setDialogMessage('Game has started!');
      });

      socket.on('updateOpponentInfo', (opponentData: { name: string; avatar: string }) => {
        console.log('Received updateOpponentInfo for socket ID:', socket.id, 'opponentData:', opponentData);
        if (opponentData && opponentData.name) {
          const opponentName = opponentData.name === 'Player 2' ? 'Opponent' : opponentData.name;
          setOpponentInfo({
            name: opponentName,
            avatar: opponentData.avatar || '',
          });
          console.log('Updated opponent info:', { name: opponentName, avatar: opponentData.avatar || '' });
        } else {
          console.warn('Received invalid opponent data:', opponentData);
        }
      });

      socket.on(
        'gameStateUpdated',
        (data: { gameState: GameState; playerRole?: 'player1' | 'player2' }) => {
          if (data.playerRole) {
            setPlayerRole(data.playerRole);
          }

          if (data.gameState) {
            setGameState(data.gameState);
            if (data.gameState.gameStatus === 'finished') {
              const winner = data.gameState.player1.energy <= 0 ? 'player2' : 'player1';
              const winnerName =
                data.gameState.winner?.name ||
                (winner === 'player1' ? (playerRole === 'player1' ? playerInfo.name : opponentInfo?.name) : (playerRole === 'player2' ? playerInfo.name : opponentInfo?.name));
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
          }
        }
      );

      socket.on('error', (msg: string) => {
        console.log('Error received for socket ID:', socket.id, 'message:', msg);
        setDialogMessage(`Failed to connect: ${msg}. Please try again.`);
        if (msg.includes('Room does not exist') || msg.includes('Room is full') || msg.includes('Player 1 is disconnected')) {
          setRoomId(null);
          setPlayerRole(null);
          setGameState(null);
          setOpponentInfo(null);
        }
      });

      socket.on('playerDisconnected', () => {
        console.log('Player disconnected event received for socket ID:', socket.id);
        setDialogMessage('Opponent disconnected. Game ended.');
        setRoomId(null);
        setPlayerRole(null);
        setGameState(null);
        setOpponentInfo(null);
      });

      socket.on('connect_error', (error) => {
        console.log('Connection error for socket ID:', socket.id, 'error:', error.message);
        setDialogMessage(`Connection failed: ${error.message}. Please try again or check network.`);
        setRoomId(null);
        setPlayerRole(null);
        setGameState(null);
        setOpponentInfo(null);
      });

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
      socket.disconnect();
    }
  }, [isAuthenticated, user]);

  const handleCardPlay = (card: CardType) => {
    if (!gameState || !roomId || !playerRole) return;

    const isPlayerTurn =
      playerRole === 'player1' ? gameState.currentTurn === 'player1' : gameState.currentTurn === 'player2';
    if (!isPlayerTurn) return;

    socket.emit('cardPlayed', { roomId, card, playerRole });
  };

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

  const createRoom = (gameType = 'free', tokenType: string | null = null, tokenAmount: number | null = null) => {
    if (!isAuthenticated || !user?.sub || !user?.name) {
      setDialogMessage('Please ensure you are properly logged in.');
      return;
    }
    const playerData = {
      playerId: user.sub,
      playerName: user.name,
      avatar: user.picture,
      gameType,
      tokenType,
      tokenAmount,
    };
    socket.emit('createRoom', playerData);
  };

  const joinRoom = () => {
    if (!isAuthenticated || !joinRoomInput) return;
    socket.emit('joinRoom', { roomId: joinRoomInput, playerData: { playerId: user?.sub, playerName: user?.name, avatar: user?.picture } });
  };

  if (!isAuthenticated && !authLoading) {
    return <LoginScreen />;
  }

  if (authLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (gameState && gameState.gameStatus === 'finished') {
    const playerEnergy = playerRole === 'player1' ? gameState.player1.energy : gameState.player2.energy;
    const opponentEnergy = playerRole === 'player1' ? gameState.player2.energy : gameState.player1.energy;
    const winner = gameState.player1.energy <= 0 ? 'player2' : 'player1';

    fetch(`${SERVER_URL}/games`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setGames(data))
      .catch((error) => console.error('Error fetching games:', error));

    fetch(`${SERVER_URL}/players`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setPlayers(data))
      .catch((error) => console.error('Error fetching players:', error));

    return (
      <div className="game-over-container">
        <ParticlesBackground className="particles game-over-particles" variant="green" />
        <GameOver
          winner={winner}
          playerRole={playerRole!}
          playerInfo={playerInfo}
          opponentInfo={opponentInfo || { name: 'Opponent', avatar: OpponentProfile }}
          killCount={gameState.killCount}
          playerEnergy={playerEnergy}
          opponentEnergy={opponentEnergy}
          onPlayAgain={() => {
            setGameState(null);
            setRoomId(null);
            setPlayerRole(null);
            setOpponentInfo(null);
          }}
        />
      </div>
    );
  }

  if (gameState && roomId && playerRole) {
    return (
      <DndProvider backend={HTML5Backend}>
        <div className="game-container">
          <GameBoard
            gameState={gameState}
            onCardPlay={handleCardPlay}
            setGameState={setGameState}
            playerInfo={playerInfo}
            opponentInfo={opponentInfo || { name: 'Opponent', avatar: OpponentProfile }}
            combatLog={gameState.combatLog}
            addCombatLogEntry={addCombatLogEntry}
            killCount={gameState.killCount}
            playerRole={playerRole}
            roomId={roomId}
            socket={socket}
            onCardDefeated={(defeatedPlayerKey) => handleCardDefeated(defeatedPlayerKey)}
            onSignOut={() => {
              socket.emit('logout', user?.sub);
              signOut();
              setOpponentInfo(null);
              setGameState(null);
              setRoomId(null);
              setPlayerRole(null);
            }}
          />
        </div>
      </DndProvider>
    );
  }

  return (
    <div className="lobby">
      {isConnected && (
        <div className="token-balances">
          <p>SUI Balance: {parseFloat(suiBalance) / 1e9} SUI</p>
          <p>SUIMON Balance: {parseFloat(suimonBalance)} SUIMON</p>
        </div>
      )}
      <ParticlesBackground className="particles lobby-particles" />
      <div className="user-profile">
        <img src={playerInfo.avatar} alt="Profile" className="profile-image" crossOrigin="anonymous" referrerPolicy="no-referrer" />
        <h2>Welcome, {user?.name || 'Player'}!</h2>
      </div>

      <h1>Suimon Card Game</h1>
      <div className="game-modes-container">
        <div className="game-mode-section free-game-section">
          <h3>Free Game</h3>
          <p>Play without staking any tokens</p>
          <button onClick={() => createRoom()} className="create-room-btn">
            Create Free Game
          </button>
        </div>

        <div className="game-mode-section paid-game-section">
          <h3>Paid On-Chain Game</h3>
          <p>Stake tokens to play and win more</p>
          {!isConnected ? (
            <div className="connect-wallet-container">
              <WalletConnection />
              <div style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}>
                <button disabled className="stake-button" style={{ width: '100%' }}>
                  Create Paid On-Chain Game
                  <span className="gas-fee">Wallet connection required</span>
                </button>
              </div>
            </div>
          ) : (
            <GameOptions
              onCreateGame={(tokenType, amount) => {
                const playerData = {
                  playerId: user?.sub,
                  playerName: user?.name,
                  avatar: user?.picture,
                  gameType: 'paid',
                  tokenType,
                  tokenAmount: amount,
                };
                socket.emit('createRoom', playerData);
              }}
            />
          )}
        </div>

        <div className="join-room-container">
          <h3>Join Existing Game</h3>
          <div className="join-input-group">
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
            setOpponentInfo(null);
          }}
        />
      )}
      {dialogMessage && <div className="dialog-message">{dialogMessage}</div>}
      <LeaderboardTable players={players} games={games} />
    </div>
  );
}

const AppWrapper = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider
          autoConnect
          preferredWallets={[
            'Sui Wallet',
            'Suiet',
            'Ethos Wallet',
            'Martian Sui Wallet',
            'Glass Wallet',
            'Morphis Wallet',
            'OneKey Wallet',
            'Wave Wallet',
          ]}
        >
          <SuiWalletProvider>
            <App />
          </SuiWalletProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
};

export default AppWrapper;