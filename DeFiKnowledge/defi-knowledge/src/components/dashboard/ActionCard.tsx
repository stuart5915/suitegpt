'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface ActionCardProps {
    icon: string;
    title: string;
    description: string;
    href: string;
    color?: 'purple' | 'blue' | 'green';
}

export default function ActionCard({ icon, title, description, href, color = 'purple' }: ActionCardProps) {
    const colorClasses = {
        purple: 'card-purple',
        blue: 'card-blue',
        green: 'card-green',
    };

    return (
        <Link href={href} className="action-card-link">
            <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className={`action-card ${colorClasses[color]}`}
            >
                <div className="card-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="card-arrow">→</div>
            </motion.div>

            <style jsx>{`
        :global(.action-card-link) {
          text-decoration: none;
          display: block;
        }

        .action-card {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 16px;
          padding: 32px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.2s;
        }

        .action-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .action-card.card-purple::before {
          background: linear-gradient(90deg, #a855f7 0%, #6366f1 100%);
        }

        .action-card.card-blue::before {
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
        }

        .action-card.card-green::before {
          background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
        }

        .card-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .action-card h3 {
          font-size: 24px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 8px 0;
        }

        .action-card p {
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

        .action-card:hover .card-arrow {
          transform: translateX(4px);
        }
      `}</style>
        </Link>
    );
}
