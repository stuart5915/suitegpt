'use client';

import { motion } from 'framer-motion';
import { useSimStore, Asset } from '@/store/useSimStore';
import { useState, useEffect } from 'react';
import FirstTimeModal from '@/components/simulator/FirstTimeModal';

export default function CexView() {
  const { cex, wallet, transfer, platformsUsed, markPlatformUsed } = useSimStore();
  const [amount, setAmount] = useState<string>('100');
  const [selectedAsset, setSelectedAsset] = useState<Asset>('USDC');
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('spot');

  useEffect(() => {
    if (!platformsUsed.includes('cex')) {
      setShowModal(true);
    }
  }, [platformsUsed]);

  const handleModalClose = () => {
    setShowModal(false);
    markPlatformUsed('cex');
  };

  const handleDeposit = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      transfer('wallet', 'cex', selectedAsset, numAmount);
    }
  };

  const handleWithdraw = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      transfer('cex', 'wallet', selectedAsset, numAmount);
    }
  };

  return (
    <div className="cex-interface">
      <FirstTimeModal
        isOpen={showModal}
        onClose={handleModalClose}
        platform={{
          icon: '📊',
          name: 'Central Exchange',
          title: 'Welcome to Centralized Exchanges!',
          keyPoints: [
            'Buy and sell crypto with fiat currency',
            'Platform holds your funds (custodial)',
            'Requires KYC verification in real life',
            'Example: Coinbase, Binance, Kraken'
          ],
          learnMoreLink: '/learn'
        }}
      />

      {/* Top Nav */}
      <div className="top-nav">
        <div className="nav-left">
          <div className="exchange-logo">📊 Coinbase</div>
          <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'spot' ? 'active' : ''}`} onClick={() => setActiveTab('spot')}>Spot</button>
            <button className="nav-tab">Futures</button>
            <button className="nav-tab">Staking</button>
          </div>
        </div>
        <div className="nav-right">
          <span className="user-badge">👤 user@example.com</span>
        </div>
      </div>

      {/* Main Trading Area */}
      <div className="trading-area">
        {/* Left Panel - Markets */}
        <div className="markets-panel">
          <div className="panel-header">
            <h3>Markets</h3>
            <div className="search-box">
              <span>🔍</span>
              <input placeholder="Search..." />
            </div>
          </div>

          <div className="market-list">
            <div className="market-item active">
              <div className="market-pair">BTC/USD</div>
              <div className="market-price positive">$43,238.50</div>
              <div className="market-change">+2.34%</div>
            </div>
            <div className="market-item">
              <div className="market-pair">ETH/USD</div>
              <div className="market-price">$2,245.30</div>
              <div className="market-change negative">-1.23%</div>
            </div>
            <div className="market-item">
              <div className="market-pair">USDC/USD</div>
              <div className="market-price">$1.00</div>
              <div className="market-change">+0.00%</div>
            </div>
          </div>
        </div>

        {/* Center - Chart & Order Book */}
        <div className="center-panel">
          {/* Chart Placeholder */}
          <div className="chart-container">
            <div className="chart-header">
              <div className="pair-info">
                <h2>BTC/USDC</h2>
                <span className="price">$43,238.50</span>
                <span className="change positive">+2.34%</span>
              </div>
              <div className="chart-controls">
                <button>1H</button>
                <button className="active">24H</button>
                <button>1W</button>
              </div>
            </div>
            <div className="chart-placeholder">
              <div className="chart-line" />
              <span className="chart-label">Trading Chart (Educational Simulation)</span>
            </div>
          </div>

          {/* Balances */}
          <div className="balances-section">
            <h3>Exchange Balance</h3>
            <div className="balance-grid">
              {(Object.keys(cex.balances) as Asset[]).map((asset) => (
                <motion.div
                  key={asset}
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  className="balance-item"
                >
                  <span className="asset-name">{asset}</span>
                  <span className="asset-amount">{cex.balances[asset].toFixed(4)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Buy/Sell */}
        <div className="trade-panel">
          <div className="trade-tabs">
            <button className="trade-tab active">Deposit</button>
            <button className="trade-tab">Withdraw</button>
          </div>

          <div className="trade-form">
            <div className="form-group">
              <label>Asset</label>
              <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value as Asset)}>
                <option value="USD">USD</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
              </select>
            </div>

            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <div className="available">
                Available: {wallet.balances[selectedAsset].toFixed(4)} {selectedAsset}
              </div>
            </div>

            <button
              onClick={handleDeposit}
              disabled={wallet.balances[selectedAsset] < parseFloat(amount || '0')}
              className="trade-button deposit"
            >
              Deposit to Exchange
            </button>

            <button
              onClick={handleWithdraw}
              disabled={cex.balances[selectedAsset] < parseFloat(amount || '0')}
              className="trade-button withdraw"
            >
              Withdraw to Wallet
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cex-interface {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0b0e11;
          color: #e1e3e6;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .top-nav {
          background: #151922;
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #252930;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .exchange-logo {
          font-size: 18px;
          font-weight: 700;
          color: #f1f5f9;
        }

        .nav-tabs {
          display: flex;
          gap: 8px;
        }

        .nav-tab {
          background: none;
          border: none;
          color: #848e9c;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .nav-tab:hover {
          color: #f1f5f9;
          background: #252930;
        }

        .nav-tab.active {
          color: #f0b90b;
          background: #f0b90b20;
        }

        .user-badge {
          font-size: 12px;
          color: #848e9c;
        }

        .trading-area {
          flex: 1;
          display: grid;
          grid-template-columns: 250px 1fr 280px;
          gap: 1px;
          background: #252930;
          overflow: hidden;
        }

        .markets-panel,
        .center-panel,
        .trade-panel {
          background: #0b0e11;
          overflow-y: auto;
        }

        .panel-header {
          padding: 16px;
          border-bottom: 1px solid #252930;
        }

        .panel-header h3 {
          font-size: 14px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 12px 0;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #1e2329;
          border-radius: 4px;
          padding: 8px 12px;
        }

        .search-box input {
          flex: 1;
          background: none;
          border: none;
          color: #f1f5f9;
          font-size: 13px;
          outline: none;
        }

        .market-list {
          padding: 8px;
        }

        .market-item {
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .market-item:hover {
          background: #1e2329;
        }

        .market-item.active {
          background: #252930;
        }

        .market-pair {
          font-size: 13px;
          font-weight: 600;
          color: #f1f5f9;
          margin-bottom: 4px;
        }

        .market-price {
          font-size: 12px;
          margin-bottom: 2px;
        }

        .market-price.positive {
          color: #0ecb81;
        }

        .market-change {
          font-size: 11px;
        }

        .market-change.positive {
          color: #0ecb81;
        }

        .market-change.negative {
          color: #f6465d;
        }

        .chart-container {
          padding: 16px;
          border-bottom: 1px solid #252930;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .pair-info {
          display: flex;
          align-items: baseline;
          gap: 12px;
        }

        .pair-info h2 {
          font-size: 16px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0;
        }

        .price {
          font-size: 14px;
          color: #f1f5f9;
        }

        .change {
          font-size: 13px;
        }

        .change.positive {
          color: #0ecb81;
        }

        .chart-controls button {
          background: none;
          border: none;
          color: #848e9c;
          padding: 6px 12px;
          margin-left: 4px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .chart-controls button.active {
          background: #252930;
          color: #f1f5f9;
        }

        .chart-placeholder {
          height: 200px;
          background: linear-gradient(180deg, #1e232910 0%, #1e232930 100%);
          border-radius: 8px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chart-line {
          position: absolute;
          bottom: 20%;
          left: 10%;
          right: 10%;
          height: 2px;
          background: linear-gradient(90deg, #0ecb81 0%, #0ecb8180 50%, #0ecb81 100%);
          box-shadow: 0 0 20px #0ecb8150;
        }

        .chart-label {
          font-size: 12px;
          color: #848e9c;
          z-index: 1;
        }

        .balances-section {
          padding: 16px;
        }

        .balances-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 12px 0;
        }

        .balance-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .balance-item {
          background: #1e2329;
          padding: 12px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .asset-name {
          font-size: 12px;
          color: #848e9c;
          font-weight: 500;
        }

        .asset-amount {
          font-size: 14px;
          color: #f1f5f9;
          font-weight: 600;
        }

        .trade-panel {
          padding: 16px;
        }

        .trade-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .trade-tab {
          flex: 1;
          background: #1e2329;
          border: none;
          color: #848e9c;
          padding: 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .trade-tab.active {
          background: #0ecb8120;
          color: #0ecb81;
        }

        .trade-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 12px;
          color: #848e9c;
          font-weight: 500;
        }

        .form-group select,
        .form-group input {
          background: #1e2329;
          border: 1px solid #252930;
          border-radius: 4px;
          padding: 12px;
          color: #f1f5f9;
          font-size: 14px;
          outline: none;
        }

        .available {
          font-size: 11px;
          color: #848e9c;
          margin-top: 4px;
        }

        .trade-button {
          padding: 14px;
          border-radius: 4px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .trade-button.deposit {
          background: #0ecb81;
          color: white;
        }

        .trade-button.withdraw {
          background: #f0b90b;
          color: white;
        }

        .trade-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .trade-button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
