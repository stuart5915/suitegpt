'use client';

import { motion } from 'framer-motion';
import { useSimStore, Asset } from '@/store/useSimStore';
import { useState, useEffect } from 'react';
import FirstTimeModal from '@/components/simulator/FirstTimeModal';

export default function DeFiView() {
  const { defi, wallet, transfer, platformsUsed, markPlatformUsed } = useSimStore();
  const [amount, setAmount] = useState<string>('100');
  const [selectedAsset, setSelectedAsset] = useState<Asset>('USDC');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!platformsUsed.includes('defi')) {
      setShowModal(true);
    }
  }, [platformsUsed]);

  const handleModalClose = () => {
    setShowModal(false);
    markPlatformUsed('defi');
  };

  const handleSupply = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      transfer('wallet', 'defi', selectedAsset, numAmount);
    }
  };

  const handleWithdraw = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      transfer('defi', 'wallet', selectedAsset, numAmount);
    }
  };

  const pools = [
    { pair: 'ETH/USDC', apy: '12.5%', tvl: '$2.43M', volume: '$1.2M' },
    { pair: 'BTC/USDC', apy: '8.2%', tvl: '$5.20M', volume: '$2.8M' },
    { pair: 'ETH/BTC', apy: '15.8%', tvl: '$0.88M', volume: '$450K' },
  ];

  return (
    <div className="defi-interface">
      <FirstTimeModal
        isOpen={showModal}
        onClose={handleModalClose}
        platform={{
          icon: '🌐',
          name: 'DeFi Protocol',
          title: 'Welcome to DeFi!',
          keyPoints: [
            'Non-custodial - you control your funds',
            'No account required, just connect wallet',
            'Earn yield through liquidity pools',
            'Pay gas fees for each transaction'
          ],
          learnMoreLink: '/learn'
        }}
      />

      {/* Top Bar */}
      <div className="top-bar">
        <div className="protocol-branding">
          <div className="protocol-logo">🌐</div>
          <span className="protocol-name">Uniswap</span>
        </div>
        <nav className="top-nav">
          <a href="#" className="nav-link active">Swap</a>
          <a href="#" className="nav-link">Pools</a>
          <a href="#" className="nav-link">Tokens</a>
        </nav>
        <div className="wallet-connect">
          <div className="connected-badge">
            <span className="status-dot" />
            Connected
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-container">
        {/* Header */}
        <div className="page-header">
          <h1>DeFi Protocol</h1>
          <p className="subtitle">Supply assets and earn competitive yields</p>
        </div>

        {/* Liquidity Pools */}
        <div className="pools-section">
          <h2>Liquidity Pools</h2>
          <div className="pools-grid">
            {pools.map((pool, i) => (
              <div key={i} className="pool-card">
                <div className="pool-header">
                  <div className="pool-pair">{pool.pair}</div>
                  <div className="pool-apy">{pool.apy} APY</div>
                </div>
                <div className="pool-stats">
                  <div className="stat">
                    <span className="stat-label">TVL</span>
                    <span className="stat-value">{pool.tvl}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Volume (24h)</span>
                    <span className="stat-value">{pool.volume}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Protocol Balance */}
        <div className="balance-section">
          <h2>Your Position</h2>
          <div className="balance-card">
            {(Object.keys(defi.balances) as Asset[]).map((asset) => (
              <motion.div
                key={asset}
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                className="balance-row"
              >
                <div className="asset-info">
                  <div className="asset-icon">{asset === 'USDC' ? '💵' : asset === 'ETH' ? '💎' : '₿'}</div>
                  <div>
                    <div className="asset-name">{asset}</div>
                    <div className="asset-type">Supplied</div>
                  </div>
                </div>
                <div className="asset-balance">{defi.balances[asset].toFixed(6)}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Supply/Withdraw Panel */}
        <div className="action-panel">
          <div className="panel-tabs">
            <button className="tab active">💰 Supply</button>
            <button className="tab">📤 Withdraw</button>
          </div>

          <div className="action-form">
            <div className="form-row">
              <label>Asset</label>
              <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value as Asset)}>
                <option value="USD">USD</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
              </select>
            </div>

            <div className="form-row">
              <label>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <div className="wallet-balance">
                Wallet: {wallet.balances[selectedAsset].toFixed(4)} {selectedAsset}
              </div>
            </div>

            <div className="action-buttons">
              <button
                onClick={handleSupply}
                disabled={wallet.balances[selectedAsset] < parseFloat(amount || '0')}
                className="action-btn supply"
              >
                💸 Supply to Pool
              </button>
              <button
                onClick={handleWithdraw}
                disabled={defi.balances[selectedAsset] < parseFloat(amount || '0')}
                className="action-btn withdraw"
              >
                📥 Withdraw to Wallet
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .defi-interface {
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
          height: 100%;
          color: #e1e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .top-bar {
          background: #0d0d1f;
          border-bottom: 1px solid #2a2a4a;
          padding: 14px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .protocol-branding {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .protocol-logo {
          font-size: 24px;
        }

        .protocol-name {
          font-size: 20px;
          font-weight: 700;
          background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .top-nav {
          display: flex;
          gap: 24px;
        }

        .nav-link {
          color: #94a3b8;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-link:hover {
          color: #f1f5f9;
        }

        .nav-link.active {
          color: #a855f7;
        }

        .wallet-connect {
          display: flex;
          gap: 12px;
        }

        .connected-badge {
          background: #22c55e20;
          color: #22c55e;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .main-container {
          flex: 1;
          padding: 32px;
          overflow-y: auto;
        }

        .page-header h1 {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 8px 0;
          background: linear-gradient(135deg, #f1f5f9 0%, #a855f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          color: #64748b;
          font-size: 14px;
          margin: 0 0 32px 0;
        }

        .pools-section h2,
        .balance-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 16px 0;
        }

        .pools-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .pool-card {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 12px;
          padding: 20px;
          transition: all 0.2s;
        }

        .pool-card:hover {
          border-color: #a855f780;
          transform: translateY(-2px);
        }

        .pool-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .pool-pair {
          font-size: 16px;
          font-weight: 600;
          color: #f1f5f9;
        }

        .pool-apy {
          font-size: 14px;
          font-weight: 700;
          color: #22c55e;
        }

        .pool-stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat {
          display: flex;
          justify-content: space-between;
        }

        .stat-label {
          font-size: 12px;
          color: #64748b;
        }

        .stat-value {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 500;
        }

        .balance-section {
          margin-bottom: 32px;
        }

        .balance-card {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 12px;
          padding: 20px;
        }

        .balance-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #3d3d5c50;
        }

        .balance-row:last-child {
          border-bottom: none;
        }

        .asset-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .asset-icon {
          font-size: 24px;
        }

        .asset-name {
          font-size: 15px;
          font-weight: 600;
          color: #f1f5f9;
        }

        .asset-type {
          font-size: 12px;
          color: #64748b;
        }

        .asset-balance {
          font-size: 16px;
          font-weight: 600;
          color: #22c55e;
        }

        .action-panel {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 12px;
          overflow: hidden;
        }

        .panel-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #0d0d1f;
          border-bottom: 1px solid #3d3d5c;
        }

        .tab {
          padding: 14px;
          background: none;
          border: none;
          color: #64748b;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #f1f5f9;
        }

        .tab.active {
          color: #a855f7;
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
        }

        .action-form {
          padding: 24px;
        }

        .form-row {
          margin-bottom: 20px;
        }

        .form-row label {
          display: block;
          font-size: 13px;
          color: #94a3b8;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .form-row select,
        .form-row input {
          width: 100%;
          background: #0d0d1f;
          border: 1px solid #3d3d5c;
          border-radius: 8px;
          padding: 14px 16px;
          color: #f1f5f9;
          font-size: 15px;
          outline: none;
          transition: border 0.2s;
        }

        .form-row select:focus,
        .form-row input:focus {
          border-color: #a855f7;
        }

        .wallet-balance {
          font-size: 12px;
          color: #64748b;
          margin-top: 6px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .action-btn {
          flex: 1;
          padding: 16px;
          border-radius: 10px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn.supply {
          background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
          color: white;
        }

        .action-btn.withdraw {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(168, 85, 247, 0.3);
        }
      `}</style>
    </div>
  );
}
