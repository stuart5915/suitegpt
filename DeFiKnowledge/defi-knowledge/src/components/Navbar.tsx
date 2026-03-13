'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  if (!session) return null;

  return (
    <nav className="navbar">
      <Link href="/dashboard" className="logo">
        <span className="logo-icon">💹</span>
        <span className="logo-text">DeFiKnowledge</span>
      </Link>

      <div className="nav-links">
        <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
          Dashboard
        </Link>
        <Link href="/simulator" className={`nav-link ${pathname === '/simulator' ? 'active' : ''}`}>
          Simulator
        </Link>
        <Link href="/learn" className={`nav-link ${pathname === '/learn' ? 'active' : ''}`}>
          Learn
        </Link>
        <Link href="/get-started" className={`nav-link ${pathname === '/get-started' ? 'active' : ''}`}>
          Get Started
        </Link>
      </div>

      <div className="nav-right">
        <div className="user-menu" onClick={() => setMenuOpen(!menuOpen)}>
          {session.user?.image ? (
            <img src={session.user.image} alt="" className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">
              {session.user?.name?.[0] || '?'}
            </div>
          )}
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="dropdown"
            >
              <div className="dropdown-header">
                <span className="user-name">{session.user?.name}</span>
                <span className="user-email">{session.user?.email}</span>
              </div>
              <div className="dropdown-divider" />
              <Link href="/profile" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                👤 Profile
              </Link>
              <button
                className="dropdown-item signout"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                🚪 Sign Out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: #0a0a0f;
          border-bottom: 1px solid #2a2a4a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          z-index: 1001;
          gap: 24px;
        }

        :global(.logo) {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #f1f5f9;
        }

        .logo-icon {
          font-size: 24px;
        }

        .logo-text {
          font-size: 18px;
          font-weight: 700;
        }

        .nav-links {
          display: flex;
          gap: 8px;
          flex: 1;
        }

        :global(.nav-link) {
          padding: 8px 16px;
          border-radius: 8px;
          text-decoration: none;
          color: #94a3b8;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        :global(.nav-link:hover) {
          background: #ffffff10;
          color: #f1f5f9;
        }

        :global(.nav-link.active) {
          background: #a855f720;
          color: #a855f7;
        }

        .nav-right {
          position: relative;
        }

        .user-menu {
          cursor: pointer;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid #a855f7;
        }

        .user-avatar-placeholder {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
        }

        :global(.dropdown) {
          position: absolute;
          top: 48px;
          right: 0;
          background: #1e1e2f;
          border: 1px solid #3d3d5c;
          border-radius: 12px;
          min-width: 200px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }

        .dropdown-header {
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-name {
          font-weight: 600;
          color: #f1f5f9;
          font-size: 14px;
        }

        .user-email {
          font-size: 12px;
          color: #64748b;
        }

        .dropdown-divider {
          height: 1px;
          background: #3d3d5c;
        }

        :global(.dropdown-item) {
          display: block;
          width: 100%;
          padding: 12px 16px;
          text-align: left;
          background: none;
          border: none;
         color: #94a3b8;
          font-size: 14px;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.2s;
        }

        :global(.dropdown-item:hover) {
          background: #ffffff10;
          color: #f1f5f9;
        }

        :global(.dropdown-item.signout) {
          color: #f87171;
        }

        @media (max-width: 768px) {
          .nav-links {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}
