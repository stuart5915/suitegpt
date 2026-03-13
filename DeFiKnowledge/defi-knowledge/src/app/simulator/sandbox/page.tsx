'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BankView from '@/components/platforms/BankView';
import CexView from '@/components/platforms/CexView';
import DeFiView from '@/components/platforms/DeFiView';
import WalletOverlay from '@/components/WalletOverlay';
import Navbar from '@/components/Navbar';
import TransactionFlowBanner from '@/components/simulator/TransactionFlowBanner';
import BrowserFrame from '@/components/simulator/BrowserFrame';
import InfoTooltip from '@/components/ui/InfoTooltip';
import Link from 'next/link';
import { useSimStore } from '@/store/useSimStore';

export default function SandboxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { resetSimulation } = useSimStore();
  const [hoveredPlatform, setHoveredPlatform] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div className="spinner">Loading...</div>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0a0a0f;
            color: #a855f7;
            font-size: 18px;
          }
        `}</style>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Navbar />
      <main className="sandbox-main">
        {/* Transaction Flow Banner */}
        <div className="banner-container">
          <TransactionFlowBanner />
        </div>

        {/* Expandable Platform Grid */}
        <div className="platforms-container">
          <div
            className={`platform-wrapper ${hoveredPlatform === 0 ? 'expanded' : hoveredPlatform !== null ? 'collapsed' : ''}`}
            onMouseEnter={() => setHoveredPlatform(0)}
            onMouseLeave={() => setHoveredPlatform(null)}
          >
            <div className="platform-header blue">
              <div className="header-left">
                <div className="header-icon">🏦</div>
                <div className="header-text">
                  <h3 className="platform-title">TRADITIONAL BANKING</h3>
                  <p className="platform-subtitle">Fiat currency storage & management</p>
                </div>
              </div>
              <div className="header-actions">
                <InfoTooltip content="Where you hold your fiat currency (USD). Like your real checking/savings account." position="bottom" />
                <Link href="/learn" className="learn-link">Learn More</Link>
              </div>
            </div>
            <BrowserFrame title="Chase Bank" url="https://chase.com/banking">
              <BankView />
            </BrowserFrame>
          </div>

          <div
            className={`platform-wrapper ${hoveredPlatform === 1 ? 'expanded' : hoveredPlatform !== null ? 'collapsed' : ''}`}
            onMouseEnter={() => setHoveredPlatform(1)}
            onMouseLeave={() => setHoveredPlatform(null)}
          >
            <div className="platform-header red">
              <div className="header-left">
                <div className="header-icon">📊</div>
                <div className="header-text">
                  <h3 className="platform-title">CENTRALIZED EXCHANGE (CEX)</h3>
                  <p className="platform-subtitle">Buy, sell & trade cryptocurrencies</p>
                </div>
              </div>
              <div className="header-actions">
                <InfoTooltip content="Platform to buy/sell crypto with fiat. Examples: Coinbase, Binance. Requires KYC verification." position="bottom" />
                <Link href="/learn" className="learn-link">Learn More</Link>
              </div>
            </div>
            <BrowserFrame title="Coinbase Exchange" url="https://coinbase.com/trade">
              <CexView />
            </BrowserFrame>
          </div>

          <div
            className={`platform-wrapper ${hoveredPlatform === 2 ? 'expanded' : hoveredPlatform !== null ? 'collapsed' : ''}`}
            onMouseEnter={() => setHoveredPlatform(2)}
            onMouseLeave={() => setHoveredPlatform(null)}
          >
            <div className="platform-header purple">
              <div className="header-left">
                <div className="header-icon">🌐</div>
                <div className="header-text">
                  <h3 className="platform-title">DECENTRALIZED PROTOCOL (DeFi)</h3>
                  <p className="platform-subtitle">Earn yield, swap & borrow on-chain</p>
                </div>
              </div>
              <div className="header-actions">
                <InfoTooltip content="Decentralized Finance - no middleman, you control your funds. Earn yield, swap tokens, borrow/lend." position="bottom" />
                <Link href="/learn" className="learn-link">Learn More</Link>
              </div>
            </div>
            <BrowserFrame title="Uniswap Protocol" url="https://app.uniswap.org">
              <DeFiView />
            </BrowserFrame>
          </div>
        </div>

        {/* Wallet Overlay */}
        <WalletOverlay />

        {/* Reset Button */}
        <button onClick={resetSimulation} className="reset-button">
          🔄 Reset Simulation
        </button>

        <style jsx>{`
          .sandbox-main {
            background: #0a0a0f;
            min-height: 100vh;
            padding-top: 60px;
            display: flex;
            flex-direction: column;
          }

          .banner-container {
            padding: 16px 20px 0 20px;
            max-width: 100%;
          }

          .platforms-container {
            flex: 1;
            display: flex;
            gap: 8px;
            padding: 16px 20px 20px 20px;
            min-height: 0;
          }

          .platform-wrapper {
            flex: 1;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            min-width: 0;
            position: relative;
            display: flex;
            flex-direction: column;
          }

          .platform-wrapper.expanded {
            flex: 2.5;
          }

          .platform-wrapper.collapsed {
            flex: 0.75;
          }

          .platform-wrapper:hover {
            z-index: 10;
          }

          .platform-header {
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 2px solid #3d3d5c;
            border-radius: 12px;
            padding: 16px 20px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .platform-header.blue {
            border-color: #3b82f6;
            background: linear-gradient(135deg, #1e3a5f 0%, #2d2d44 100%);
          }

          .platform-header.red {
            border-color: #ef4444;
            background: linear-gradient(135deg, #3a1e1e 0%, #2d2d44 100%);
          }

          .platform-header.purple {
            border-color: #a855f7;
            background: linear-gradient(135deg, #2d1e3a 0%, #2d2d44 100%);
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .header-icon {
            font-size: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .header-text {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .platform-title {
            font-size: 18px;
            font-weight: 800;
            color: #f1f5f9;
            margin: 0;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }

          .platform-subtitle {
            font-size: 12px;
            color: #94a3b8;
            margin: 0;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .learn-link {
            font-size: 13px;
            color: #a855f7;
            text-decoration: none;
            font-weight: 600;
            transition: color 0.2s;
            white-space: nowrap;
          }

          .learn-link:hover {
            color: #c084fc;
          }

          .reset-button {
            position: fixed;
            bottom: 20px;
            left: 20px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            transition: transform 0.2s;
          }

          .reset-button:hover {
            transform: translateY(-2px);
          }

          @media (max-width: 1200px) {
            .platforms-container {
              flex-direction: column;
              gap: 12px;
            }

            .platform-wrapper {
              flex: none !important;
              height: 400px;
            }

            .platform-wrapper.expanded {
              height: 600px;
            }

            .platform-wrapper.collapsed {
              height: 300px;
            }
          }
        `}</style>
      </main>
    </>
  );
}
