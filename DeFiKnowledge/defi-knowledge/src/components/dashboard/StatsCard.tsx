'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
    value: string | number;
    label: string;
    icon?: string;
}

export default function StatsCard({ value, label, icon }: StatsCardProps) {
    return (
        <div className="stats-card">
            {icon && <div className="stat-icon">{icon}</div>}
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>

            <style jsx>{`
        .stats-card {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        .stat-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #f1f5f9;
          display: block;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
        </div>
    );
}
