'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface ModeCardProps {
    icon: string;
    title: string;
    description: string;
    href: string;
    badge?: string;
    color?: 'purple' | 'blue' | 'green' | 'orange';
}

export default function ModeCard({ icon, title, description, href, badge, color = 'purple' }: ModeCardProps) {
    const colorClasses = {
        purple: 'card-purple',
        blue: 'card-blue',
        green: 'card-green',
        orange: 'card-orange',
    };

    return (
        <Link href={href} className="mode-card-link">
            <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className={`mode-card ${colorClasses[color]}`}
            >
                {badge && <div className="badge">{badge}</div>}
                <div className="card-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="card-arrow">→</div>
            </motion.div>

            <style jsx>{`
        :global(.mode-card-link) {
          text-decoration: none;
          display: block;
        }

        .mode-card {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 16px;
          padding: 32px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.2s;
          min-height: 200px;
        }

        .mode-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .mode-card.card-purple::before {
          background: linear-gradient(90deg, #a855f7 0%, #6366f1 100%);
        }

        .mode-card.card-blue::before {
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
        }

        .mode-card.card-green::before {
          background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
        }

        .mode-card.card-orange::before {
          background: linear-gradient(90deg, #f97316 0%, #ea580c 100%);
        }

        .badge {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #a855f720;
          color: #a855f7;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .card-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .mode-card h3 {
          font-size: 24px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 8px 0;
        }

        .mode-card p {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.6;
        }

        .card-arrow {
          position: absolute;
          bottom: 24px;
          right: 24px;
          font-size: 24px;
          color: #64748b;
          transition: transform 0.2s;
        }

        .mode-card:hover .card-arrow {
          transform: translateX(4px);
        }
      `}</style>
        </Link>
    );
}
