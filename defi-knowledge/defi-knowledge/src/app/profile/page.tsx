'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status === 'loading') {
        return (
            <div className="profile-container">
                <div className="loading">Loading...</div>
                <style jsx>{`
          .profile-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
          }
          .loading { color: #a855f7; font-size: 18px; }
        `}</style>
            </div>
        );
    }

    if (!session) {
        router.push('/login');
        return null;
    }

    return (
        <div className="profile-container">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="profile-card"
            >
                <Link href="/" className="back-link">
                    ← Back to Workspace
                </Link>

                <div className="avatar-section">
                    {session.user?.image ? (
                        <img
                            src={session.user.image}
                            alt="Profile"
                            className="avatar"
                        />
                    ) : (
                        <div className="avatar-placeholder">
                            {session.user?.name?.[0] || '?'}
                        </div>
                    )}
                </div>

                <div className="user-info">
                    <h1>{session.user?.name}</h1>
                    <p className="email">{session.user?.email}</p>
                </div>

                <div className="stats-grid">
                    <div className="stat-item">
                        <span className="stat-value">0</span>
                        <span className="stat-label">Simulations</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">0</span>
                        <span className="stat-label">Transactions</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">New</span>
                        <span className="stat-label">Status</span>
                    </div>
                </div>

                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="signout-btn"
                >
                    Sign Out
                </button>
            </motion.div>

            <style jsx>{`
        .profile-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
          padding: 20px;
        }

        .profile-card {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 24px;
          padding: 32px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        :global(.back-link) {
          display: inline-block;
          color: #a855f7;
          text-decoration: none;
          font-size: 14px;
          margin-bottom: 24px;
          transition: color 0.2s;
        }

        :global(.back-link:hover) {
          color: #c084fc;
        }

        .avatar-section {
          margin-bottom: 20px;
        }

        .avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          border: 3px solid #a855f7;
        }

        .avatar-placeholder {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          font-weight: 700;
          color: white;
          margin: 0 auto;
        }

        .user-info h1 {
          font-size: 24px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 8px 0;
        }

        .email {
          color: #94a3b8;
          font-size: 14px;
          margin: 0 0 24px 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat-item {
          background: #ffffff08;
          padding: 16px 12px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #f1f5f9;
        }

        .stat-label {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
        }

        .signout-btn {
          width: 100%;
          padding: 14px;
          background: #ef444420;
          border: 1px solid #ef4444;
          border-radius: 12px;
          color: #f87171;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .signout-btn:hover {
          background: #ef444440;
        }
      `}</style>
        </div>
    );
}
