'use client';

import { motion } from 'framer-motion';
import { useSimStore, Asset } from '@/store/useSimStore';
import { useState, useEffect } from 'react';
import FirstTimeModal from '@/components/simulator/FirstTimeModal';

export default function BankView() {
  const { bank, wallet, transfer, platformsUsed, markPlatformUsed } = useSimStore();
  const [amount, setAmount] = useState<string>('100');
  const [selectedAsset] = useState<Asset>('USD');
  const [showModal, setShowModal] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    if (!platformsUsed.includes('bank')) {
      setShowModal(true);
    }
  }, [platformsUsed]);

  const handleModalClose = () => {
    setShowModal(false);
    markPlatformUsed('bank');
  };

  const handleDeposit = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      transfer('wallet', 'bank', selectedAsset, numAmount);
    }
  };

  const handleWithdraw = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      transfer('bank', 'wallet', selectedAsset, numAmount);
    }
  };

  return (
    <div className="bank-interface">
      <FirstTimeModal
        isOpen={showModal}
        onClose={handleModalClose}
        platform={{
          icon: '🏦',
          name: 'Traditional Bank',
          title: 'Welcome to Traditional Banking!',
          keyPoints: [
            'Your savings account - safe and insured by FDIC',
            'Low interest rate (~0.5% APY)',
            'Free deposits and withdrawals',
            'This is where your paycheck goes in real life'
          ],
          learnMoreLink: '/learn'
        }}
      />

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="bank-logo">💳 Chase</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('dashboard')}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </button>
          <button
            className={`nav-item ${activeSection === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveSection('accounts')}
          >
            <span className="nav-icon">💰</span>
            Accounts
          </button>
          <button className="nav-item">
            <span className="nav-icon">💳</span>
            Cards
          </button>
          <button className="nav-item">
            <span className="nav-icon">📱</span>
            Payments
          </button>
          <button className="nav-item">
            <span className="nav-icon">⚙️</span>
            Settings
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="content-header">
          <h1>Good afternoon</h1>
          <p className="subtitle">Here's your account summary</p>
        </div>

        {/* Account Balance Card */}
        <div className="account-card">
          <div className="card-header">
            <div>
              <div className="account-type">Chase Total Checking</div>
              <div className="account-number">••••1234</div>
            </div>
            <div className="fdic-badge">FDIC Insured</div>
          </div>

          <motion.div
            key={bank.balances.USD}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            className="balance-amount"
          >
            ${bank.balances.USD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.div>

          <div className="balance-label">Available Balance</div>

          <div className="card-actions">
            <button className="action-btn primary" onClick={() => setActiveSection('transfer')}>
              Transfer Money
            </button>
            <button className="action-btn secondary">
              View Statements
            </button>
          </div>
        </div>

        {/* Quick Transfer Section */}
        {activeSection === 'transfer' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="transfer-section"
          >
            <h2>Quick Transfer</h2>

            <div className="transfer-form">
              <div className="form-group">
                <label>Amount</label>
                <div className="input-with-currency">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <span className="currency-code">USD</span>
                </div>
              </div>

              <div className="transfer-buttons">
                <button
                  onClick={handleDeposit}
                  disabled={wallet.balances.USD < parseFloat(amount || '0')}
                  className="transfer-btn deposit"
                >
                  ⬇️ Deposit from Wallet
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={bank.balances.USD < parseFloat(amount || '0')}
                  className="transfer-btn withdraw"
                >
                  ⬆️ Withdraw to Wallet
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Account Details */}
        <div className="details-grid">
          <div className="detail-card">
            <div className="detail-label">Interest Rate (APY)</div>
            <div className="detail-value">0.50%</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Account Type</div>
            <div className="detail-value">Savings</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">Monthly Fee</div>
            <div className="detail-value">$0.00</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .bank-interface {
          display: flex;
          height: 100%;
          background: #f5f7fa;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .sidebar {
          width: 240px;
          background: #1a1d29;
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid #2a2d39;
        }

        .bank-logo {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
        }

        .sidebar-nav {
          flex: 1;
          padding: 12px 0;
        }

        .nav-item {
          width: 100%;
          padding: 14px 20px;
          background: none;
          border: none;
          color: #a0a4b4;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s;
          text-align: left;
        }

        .nav-item:hover {
          background: #2a2d39;
          color: #ffffff;
        }

        .nav-item.active {
          background: #2563eb20;
          color: #3b82f6;
          border-left: 3px solid #3b82f6;
        }

        .nav-icon {
          font-size: 16px;
        }

        .main-content {
          flex: 1;
          padding: 32px;
          overflow-y: auto;
        }

        .content-header h1 {
          font-size: 28px;
          font-weight: 600;
          color: #1a1d29;
          margin: 0 0 4px 0;
        }

        .subtitle {
          color: #6b7280;
          font-size: 14px;
          margin: 0 0 24px 0;
        }

        .account-card {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border-radius: 16px;
          padding: 28px;
          color: white;
          margin-bottom: 24px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .account-type {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 4px;
        }

        .account-number {
          font-size: 12px;
          opacity: 0.7;
        }

        .fdic-badge {
          background: #ffffff20;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .balance-amount {
          font-size: 42px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .balance-label {
          font-size: 13px;
          opacity: 0.8;
          margin-bottom: 24px;
        }

        .card-actions {
          display: flex;
          gap: 12px;
        }

        .action-btn {
          flex: 1;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .action-btn.primary {
          background: white;
          color: #2563eb;
        }

        .action-btn.secondary {
          background: #ffffff20;
          color: white;
        }

        .action-btn:hover {
          transform: translateY(-2px);
        }

        .transfer-section {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .transfer-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #1a1d29;
          margin: 0 0 20px 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .input-with-currency {
          display: flex;
          align-items: center;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 0 16px;
        }

        .currency-symbol {
          color: #6b7280;
          margin-right: 8px;
        }

        .input-with-currency input {
          flex: 1;
          background: none;
          border: none;
          padding: 14px 0;
          font-size: 16px;
          color: #1a1d29;
          outline: none;
        }

        .currency-code {
          color: #9ca3af;
          font-size: 14px;
        }

        .transfer-buttons {
          display: flex;
          gap: 12px;
        }

        .transfer-btn {
          flex: 1;
          padding: 14px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .transfer-btn.deposit {
          background: #10b981;
          color: white;
        }

        .transfer-btn.withdraw {
          background: #f59e0b;
          color: white;
        }

        .transfer-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .transfer-btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .detail-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .detail-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .detail-value {
          font-size: 18px;
          font-weight: 600;
          color: #1a1d29;
        }
      `}</style>
    </div>
  );
}
