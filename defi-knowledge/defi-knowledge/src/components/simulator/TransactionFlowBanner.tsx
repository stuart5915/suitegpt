'use client';

import { motion } from 'framer-motion';
import { useSimStore } from '@/store/useSimStore';

export default function TransactionFlowBanner() {
    const { transactions } = useSimStore();
    const latestTransaction = transactions[transactions.length - 1];

    if (!latestTransaction) {
        return (
            <div className="flow-banner">
                <h2>Reactive Value Flow Banner</h2>
                <p className="hint">Make a transaction to see the flow visualization</p>
                <style jsx>{`
          .flow-banner {
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            border: 1px solid #2a2a4a;
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            margin-bottom: 24px;
          }
          h2 {
            font-size: 24px;
            font-weight: 700;
            color: #f1f5f9;
            margin: 0 0 8px 0;
          }
          .hint {
            color: #64748b;
            font-size: 14px;
            margin: 0;
          }
        `}</style>
            </div>
        );
    }

    const getPlatformLabel = (platform: string) => {
        const labels: Record<string, string> = {
            wallet: 'WALLET',
            bank: 'TRADITIONAL BANK',
            cex: 'CENTRAL EXCHANGE',
            defi: 'DEFI PROTOCOL',
        };
        return labels[platform] || platform.toUpperCase();
    };

    return (
        <div className="flow-banner">
            <h2>Reactive Value Flow Banner</h2>

            <div className="flow-diagram">
                {/* Source Platform */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flow-block source"
                >
                    <div className="block-label">[{getPlatformLabel(latestTransaction.from)}]</div>
                    <div className="block-value negative">-${latestTransaction.amount.toFixed(2)} {latestTransaction.asset}</div>
                </motion.div>

                {/* Arrow */}
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flow-arrow"
                >
                    <div className="arrow-line" />
                    <div className="arrow-head">→</div>
                </motion.div>

                {/* Destination Platform */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flow-block destination"
                >
                    <div className="block-label">[{getPlatformLabel(latestTransaction.to)}]</div>
                    <div className="block-value positive">+${latestTransaction.amount.toFixed(2)} {latestTransaction.asset}</div>
                </motion.div>
            </div>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="success-message"
            >
                Success: Moved fiat from {getPlatformLabel(latestTransaction.from).toLowerCase()} to {getPlatformLabel(latestTransaction.to).toLowerCase()}.
            </motion.p>

            <style jsx>{`
        .flow-banner {
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
          border: 1px solid #2a2a4a;
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 24px;
        }

        h2 {
          font-size: 24px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 24px 0;
          text-align: center;
        }

        .flow-diagram {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          margin-bottom: 16px;
        }

        .flow-block {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 2px solid #3d3d5c;
          border-radius: 12px;
          padding: 20px 32px;
          min-width: 280px;
          text-align: center;
        }

        .flow-block.source {
          border-color: #ef444480;
        }

        .flow-block.destination {
          border-color: #22c55e80;
        }

        .block-label {
          font-size: 11px;
          color: #94a3b8;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .block-value {
          font-size: 24px;
          font-weight: 700;
        }

        .block-value.negative {
          color: #ef4444;
        }

        .block-value.positive {
          color: #22c55e;
        }

        .flow-arrow {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .arrow-line {
          width: 80px;
          height: 3px;
          background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
          box-shadow: 0 0 12px #3b82f680;
        }

        .arrow-head {
          font-size: 32px;
          color: #6366f1;
          text-shadow: 0 0 12px #6366f180;
        }

        .success-message {
          text-align: center;
          color: #94a3b8;
          font-size: 14px;
          margin: 0;
        }
      `}</style>
        </div>
    );
}
