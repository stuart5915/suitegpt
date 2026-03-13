'use client';

import { motion } from 'framer-motion';
import StatsCard from '@/components/dashboard/StatsCard';
import ActionCard from '@/components/dashboard/ActionCard';
import Navbar from '@/components/Navbar';

export default function DashboardPage() {

  return (
    <>
      <Navbar />
      <div className="dashboard-page">
        {/* Welcome Section */}
        <section className="welcome">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="welcome-content"
          >
            <h1>Welcome to DeFiKnowledge 👋</h1>
            <p>Ready to continue your DeFi journey?</p>
          </motion.div>
        </section>

        {/* Quick Stats */}
        <section className="stats">
          <div className="stats-grid">
            <StatsCard value="0" label="Simulations" icon="🎮" />
            <StatsCard value="0h" label="Practice Time" icon="⏱️" />
            <StatsCard value="0d" label="Streak" icon="🔥" />
          </div>
        </section>

        {/* Quick Actions */}
        <section className="actions">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            <ActionCard
              icon="🎮"
              title="Simulator"
              description="Practice with mock funds across all platforms"
              href="/simulator"
              color="purple"
            />
            <ActionCard
              icon="📚"
              title="Learn DeFi"
              description="Educational guides and concept explainers"
              href="/learn"
              color="blue"
            />
            <ActionCard
              icon="🚀"
              title="Get Started"
              description="Ready for real DeFi? See recommended platforms"
              href="/get-started"
              color="green"
            />
          </div>
        </section>

        {/* Recent Activity */}
        <section className="activity">
          <h2>Recent Activity</h2>
          <div className="activity-empty">
            <span className="empty-icon">📊</span>
            <p>No activity yet. Start your first simulation!</p>
          </div>
        </section>

        <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          background: #0a0a0f;
          padding: 80px 20px 40px 20px;
        }

        .welcome {
          max-width: 1200px;
          margin: 0 auto 40px auto;
        }

        .welcome-content h1 {
          font-size: 36px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 8px 0;
        }

        .welcome-content p {
          font-size: 18px;
          color: #64748b;
          margin: 0;
        }

        .stats {
          max-width: 1200px;
          margin: 0 auto 60px auto;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
        }

        .actions {
          max-width: 1200px;
          margin: 0 auto 60px auto;
        }

        .actions h2,
        .activity h2 {
          font-size: 24px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 24px 0;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .activity {
          max-width: 1200px;
          margin: 0 auto;
        }

        .activity-empty {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 16px;
          padding: 48px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .activity-empty p {
          color: #64748b;
          font-size: 16px;
          margin: 0;
        }

        @media (max-width: 768px) {
          .welcome-content h1 {
            font-size: 28px;
          }
          .actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      </div>
    </>
  );
}
