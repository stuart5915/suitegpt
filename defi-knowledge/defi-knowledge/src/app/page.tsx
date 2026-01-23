'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div>Loading...</div>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0a0a0f;
            color: #a855f7;
          }
        `}</style>
      </div>
    );
  }

  if (session) {
    return null; // Redirecting
  }

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="hero-content"
        >
          <div className="logo">💹</div>
          <h1>Learn DeFi Risk-Free</h1>
          <p className="tagline">
            Master decentralized finance through realistic simulations—before putting real money at stake
          </p>
          <div className="cta-buttons">
            <Link href="/login" className="btn-primary">
              Get Started Free
            </Link>
            <a href="#how-it-works" className="btn-secondary">
              How It Works
            </a>
          </div>
        </motion.div>
      </section>

      {/* Value Props */}
      <section id="how-it-works" className="features">
        <h2>Your Journey to DeFi</h2>
        <div className="features-grid">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="feature-card"
          >
            <div className="feature-icon">🎓</div>
            <h3>Learn</h3>
            <p>Understand DeFi concepts through interactive guides and clear explanations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="feature-card"
          >
            <div className="feature-icon">🎮</div>
            <h3>Practice</h3>
            <p>Experiment with mock funds across banks, exchanges, and DeFi protocols</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="feature-card"
          >
            <div className="feature-icon">🚀</div>
            <h3>Graduate</h3>
            <p>Get curated recommendations for trusted wallets, exchanges, and protocols</p>
          </motion.div>
        </div>
      </section>

      {/* Platforms Preview */}
      <section className="platforms">
        <h2>Experience All Three Ecosystems</h2>
        <div className="platforms-grid">
          <div className="platform-preview bank">
            <span className="preview-icon">🏦</span>
            <span className="preview-label">Traditional Banking</span>
          </div>
          <div className="platform-preview cex">
            <span className="preview-icon">📊</span>
            <span className="preview-label">Centralized Exchange</span>
          </div>
          <div className="platform-preview defi">
            <span className="preview-icon">🌐</span>
            <span className="preview-label">DeFi Protocol</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="cta">
        <h2>Ready to Begin?</h2>
        <p>Start learning DeFi today—no wallet required</p>
        <Link href="/login" className="btn-primary large">
          Sign Up with Google
        </Link>
      </section>

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
        }

        .hero {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .hero-content {
          max-width: 800px;
        }

        .logo {
          font-size: 80px;
          margin-bottom: 24px;
        }

        .hero h1 {
          font-size: 56px;
          font-weight: 800;
          color: #f1f5f9;
          margin: 0 0 16px 0;
          line-height: 1.1;
        }

        .tagline {
          font-size: 20px;
          color: #94a3b8;
          margin: 0 0 40px 0;
          line-height: 1.6;
        }

        .cta-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        :global(.btn-primary),
        :global(.btn-secondary) {
          padding: 16px 32px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          display: inline-block;
        }

        :global(.btn-primary) {
          background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
          color: white;
        }

        :global(.btn-primary:hover) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(168, 85, 247, 0.4);
        }

        :global(.btn-secondary) {
          background: #ffffff10;
          color: #f1f5f9;
          border: 1px solid #3d3d5c;
        }

        :global(.btn-secondary:hover) {
          background: #ffffff20;
        }

        :global(.btn-primary.large) {
          padding: 20px 48px;
          font-size: 18px;
        }

        .features,
        .platforms,
        .cta {
          padding: 80px 20px;
          text-align: center;
        }

        .features h2,
        .platforms h2,
        .cta h2 {
          font-size: 40px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 48px 0;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        :global(.feature-card) {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 16px;
          padding: 32px;
          text-align: center;
        }

        .feature-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        :global(.feature-card h3) {
          font-size: 24px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 12px 0;
        }

        :global(.feature-card p) {
          font-size: 16px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.6;
        }

        .platforms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .platform-preview {
          background: #ffffff08;
          border-radius: 12px;
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .preview-icon {
          font-size: 40px;
        }

        .preview-label {
          font-size: 14px;
          color: #94a3b8;
        }

        .platform-preview.bank {
          border: 1px solid #3b82f640;
        }

        .platform-preview.cex {
          border: 1px solid #64748b40;
        }

        .platform-preview.defi {
          border: 1px solid #a855f740;
        }

        .cta p {
          font-size: 18px;
          color: #94a3b8;
          margin: 0 0 32px 0;
        }

        @media (max-width: 768px) {
          .hero h1 {
            font-size: 36px;
          }
          .tagline {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}
