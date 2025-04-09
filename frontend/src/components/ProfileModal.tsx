import React, { useState, useEffect } from 'react';
import { useSuiWallet } from '../context/SuiWalletContext';
import { useAuth } from '../context/AuthContext';
import '../styles/ProfileModal.css';

interface GameHistoryItem {
  gameId: string;
  type: 'Free' | 'Paid';
  tokenType?: 'SUI' | 'SUIMON';
  amount?: string;
  status: 'In progress' | 'Completed' | 'Abandoned' | 'Failed';
  startTime: Date;
  endTime?: Date;
  result?: 'Win' | 'Loss' | 'Error' | '-';
  transactionHash?: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { walletAddress, suiBalance, suimonBalance } = useSuiWallet();
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<GameHistoryItem[]>([]);
  const [filter, setFilter] = useState<{
    status: string;
    tokenType: string;
    dateRange: string;
  }>({ status: 'all', tokenType: 'all', dateRange: 'all' });

  // Mock data for demonstration - in a real app, this would come from your backend
  useEffect(() => {
    // This would be replaced with an API call to fetch the user's game history
    const mockGameHistory: GameHistoryItem[] = [
      {
        gameId: '#1148',
        type: 'Paid',
        tokenType: 'SUI',
        amount: '0.01',
        status: 'In progress',
        startTime: new Date(Date.now() - 2 * 60 * 1000), // 2 mins ago
        result: '-',
        transactionHash: '0x123abc...'
      },
      {
        gameId: '#1147',
        type: 'Paid',
        tokenType: 'SUIMON',
        amount: '0.005',
        status: 'Completed',
        startTime: new Date(),
        endTime: new Date(),
        result: 'Win',
        transactionHash: '0x456def...'
      },
      {
        gameId: '#1132',
        type: 'Free',
        status: 'Abandoned',
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        endTime: new Date(Date.now() - 23 * 60 * 60 * 1000),
        result: '-'
      },
      {
        gameId: '#1129',
        type: 'Paid',
        tokenType: 'SUI',
        amount: '0.05',
        status: 'Failed',
        startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        result: 'Error',
        transactionHash: '0x789ghi...'
      }
    ];

    setGameHistory(mockGameHistory);
    setFilteredHistory(mockGameHistory);
  }, []);

  useEffect(() => {
    // Apply filters
    let filtered = [...gameHistory];

    if (filter.status !== 'all') {
      filtered = filtered.filter(game => game.status === filter.status);
    }

    if (filter.tokenType !== 'all') {
      filtered = filtered.filter(game => {
        if (filter.tokenType === 'Free') return game.type === 'Free';
        if (filter.tokenType === 'SUI') return game.tokenType === 'SUI';
        if (filter.tokenType === 'SUIMON') return game.tokenType === 'SUIMON';
        return true;
      });
    }

    if (filter.dateRange !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      
      if (filter.dateRange === 'today') {
        cutoff.setHours(0, 0, 0, 0);
      } else if (filter.dateRange === 'week') {
        cutoff.setDate(now.getDate() - 7);
      } else if (filter.dateRange === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
      }
      
      filtered = filtered.filter(game => game.startTime >= cutoff);
    }

    setFilteredHistory(filtered);
  }, [filter, gameHistory]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than a minute
    if (diff < 60 * 1000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diff < 60 * 60 * 1000) {
      const mins = Math.floor(diff / (60 * 1000));
      return `${mins} min${mins !== 1 ? 's' : ''} ago`;
    }
    
    // Less than a day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    
    // Less than a week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    
    // Format as date
    return date.toLocaleDateString();
  };

  const formatTimeRange = (startTime: Date, endTime?: Date) => {
    if (!endTime) return formatDate(startTime);
    return `${formatDate(startTime)}`;
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'In progress': return 'status-in-progress';
      case 'Completed': return 'status-completed';
      case 'Abandoned': return 'status-abandoned';
      case 'Failed': return 'status-failed';
      default: return '';
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilter(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const formatWalletAddress = (address: string | null) => {
    if (!address) return 'Not connected';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatBalance = (balance: string | null | undefined, tokenType = 'SUI') => {
    if (!balance) return '0';
    try {
      const num =
        tokenType === 'SUI'
          ? parseFloat(balance) / 1_000_000_000
          : parseFloat(balance);
      if (isNaN(num)) return '0';
      if (num === 0) return '0';
      if (num < 0.0001 && num > 0) return '< 0.0001';
      if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
      if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
      return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    } catch {
      return 'Error';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>Player Profile & Game History</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="profile-content">
          <div className="profile-info-section">
            <div className="profile-avatar">
              <img 
                src={user?.picture || '/default-avatar.png'} 
                alt="Profile" 
                crossOrigin="anonymous" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="profile-details">
              <h3>{user?.name || 'Player'}</h3>
              <div className="wallet-info">
                <div className="wallet-address">
                  <span className="label">Wallet:</span>
                  <span className="value">{formatWalletAddress(walletAddress)}</span>
                  {walletAddress && (
                    <button 
                      className="copy-button"
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddress);
                        // Could add a toast notification here
                      }}
                    >
                      Copy
                    </button>
                  )}
                </div>
                <div className="balance-info">
                  <div className="balance-item">
                    <span className="label">SUI Balance:</span>
                    <span className="value">{formatBalance(suiBalance, 'SUI')} SUI</span>
                  </div>
                  <div className="balance-item">
                    <span className="label">SUIMON Balance:</span>
                    <span className="value">{formatBalance(suimonBalance, 'SUIMON')} SUIMON</span>
                  </div>
                </div>
                <div className="account-info">
                  <div className="joined-date">
                    <span className="label">Joined:</span>
                    <span className="value">2 weeks ago</span> {/* This would come from your user data */}
                  </div>
                  <div className="last-active">
                    <span className="label">Last active:</span>
                    <span className="value">Just now</span> {/* This would be updated based on activity */}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="game-history-section">
            <h3>Game History</h3>
            
            <div className="filter-controls">
              <div className="filter-group">
                <label>Status:</label>
                <select 
                  value={filter.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="In progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Abandoned">Abandoned</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Token Type:</label>
                <select 
                  value={filter.tokenType}
                  onChange={(e) => handleFilterChange('tokenType', e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="Free">Free Games</option>
                  <option value="SUI">SUI Games</option>
                  <option value="SUIMON">SUIMON Games</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Time Period:</label>
                <select 
                  value={filter.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
            
            <div className="game-history-table-container">
              <table className="game-history-table">
                <thead>
                  <tr>
                    <th>Game ID</th>
                    <th>Type</th>
                    <th>Token & Amount</th>
                    <th>Status</th>
                    <th>Started / Ended</th>
                    <th>Result</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((game) => (
                      <tr key={game.gameId}>
                        <td>{game.gameId}</td>
                        <td>{game.type}</td>
                        <td>
                          {game.type === 'Paid' ? (
                            <>
                              {game.amount} {game.tokenType}
                            </>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${getStatusClass(game.status)}`}>
                            {game.status}
                          </span>
                        </td>
                        <td>{formatTimeRange(game.startTime, game.endTime)}</td>
                        <td>{game.result}</td>
                        <td>
                          {game.status === 'In progress' ? (
                            <button className="action-button resume-button">Resume</button>
                          ) : (
                            <button className="action-button view-button">View</button>
                          )}
                          {game.status === 'Abandoned' && (
                            <button className="action-button delete-button">Delete</button>
                          )}
                          {game.transactionHash && (
                            <a 
                              href={`https://explorer.sui.io/txblock/${game.transactionHash}?network=testnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="action-button explorer-link"
                            >
                              Explorer
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="no-games-message">
                        No games match the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;