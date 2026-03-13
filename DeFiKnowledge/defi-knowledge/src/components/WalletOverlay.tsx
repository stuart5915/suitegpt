'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSimStore, Asset } from '@/store/useSimStore';

export default function WalletOverlay() {
    const { wallet, disconnectWallet, connectWallet, transactions } = useSimStore();

    const formatAddress = (address: string) =>
        `${address.slice(0, 6)}...${address.slice(-4)}`;

    const formatBalance = (value: number, decimals: number = 4) =>
        value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: decimals,
        });

    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="wallet-overlay"
        >
            <div className="wallet-header">
                <div className="wallet-icon">🦊</div>
                <div className="wallet-info">
                    <span className="wallet-label">Mock Wallet</span>
                    <span className="wallet-address">{formatAddress(wallet.address)}</span>
                </div>
                <button
                    onClick={wallet.connected ? disconnectWallet : connectWallet}
                    className={`status-btn ${wallet.connected ? 'connected' : 'disconnected'}`}
                >
                    {wallet.connected ? '🟢' : '🔴'}
                </button>
            </div>

            <div className="wallet-balances">
                <AnimatePresence mode="popLayout">
                    {(Object.entries(wallet.balances) as [Asset, number][]).map(([asset, balance]) => (
                        <motion.div
                            key={asset}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="balance-row"
                        >
                            <span className="asset-icon">
                                {asset === 'ETH' ? '◈' : asset === 'BTC' ? '₿' : asset === 'USDC' ? '💵' : '💰'}
                            </span>
                            <span className="asset-name">{asset}</span>
                            <motion.span
                                key={balance}
                                initial={{ scale: 1.2, color: '#a855f7' }}
                                animate={{ scale: 1, color: '#f1f5f9' }}
                                className="asset-balance"
                            >
                                {formatBalance(balance, asset === 'USD' || asset === 'USDC' ? 2 : 4)}
                            </motion.span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <div className="transaction-count">
                <span className="tx-label">Transactions</span>
                <span className="tx-value">{transactions.length}</span>
            </div>

            <style jsx>{`
        .wallet-overlay {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 280px;
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 1000;
        }

        .wallet-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #3d3d5c;
          margin-bottom: 12px;
        }

        .wallet-icon {
          font-size: 28px;
        }

        .wallet-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .wallet-label {
          font-size: 12px;
          color: #94a3b8;
        }

        .wallet-address {
          font-size: 14px;
          font-weight: 600;
          color: #f1f5f9;
          font-family: monospace;
        }

        .status-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 12px;
          padding: 4px;
          transition: transform 0.2s;
        }

        .status-btn:hover {
          transform: scale(1.2);
        }

        .wallet-balances {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .balance-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #ffffff08;
          border-radius: 8px;
        }

        .asset-icon {
          font-size: 16px;
          width: 24px;
          text-align: center;
        }

        .asset-name {
          font-size: 12px;
          color: #94a3b8;
          width: 40px;
        }

        .asset-balance {
          flex: 1;
          text-align: right;
          font-size: 14px;
          font-weight: 600;
          color: #f1f5f9;
          font-family: monospace;
        }

        .transaction-count {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #3d3d5c;
        }

        .tx-label {
          font-size: 12px;
          color: #94a3b8;
        }

        .tx-value {
          font-size: 14px;
          font-weight: 600;
          color: #a855f7;
          background: #a855f720;
          padding: 2px 8px;
          border-radius: 12px;
        }
      `}</style>
        </motion.div>
    );
}
