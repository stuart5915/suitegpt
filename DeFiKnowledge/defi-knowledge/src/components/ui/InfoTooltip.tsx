'use client';

import { useState } from 'react';

interface InfoTooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function InfoTooltip({ content, position = 'top' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="tooltip-container">
      <button
        className="tooltip-trigger"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
      >
        ℹ️
      </button>

      {isVisible && (
        <div className={`tooltip-content tooltip-${position}`}>
          {content}
        </div>
      )}

      <style jsx>{`
        .tooltip-container {
          position: relative;
          display: inline-block;
        }

        .tooltip-trigger {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 22px;
          opacity: 0.7;
          transition: opacity 0.2s;
          padding: 0 6px;
        }

        .tooltip-trigger:hover {
          opacity: 1;
        }

        .tooltip-content {
          position: absolute;
          background: #1e1e2f;
          border: 1px solid #3d3d5c;
          border-radius: 8px;
          padding: 14px 18px;
          color: #f1f5f9;
          font-size: 14px;
          line-height: 1.6;
          max-width: 280px;
          white-space: normal;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .tooltip-top {
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
        }

        .tooltip-bottom {
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
        }

        .tooltip-left {
          right: calc(100% + 8px);
          top: 50%;
          transform: translateY(-50%);
        }

        .tooltip-right {
          left: calc(100% + 8px);
          top: 50%;
          transform: translateY(-50%);
        }

        .tooltip-content::before {
          content: '';
          position: absolute;
          border: 6px solid transparent;
        }

        .tooltip-top::before {
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-top-color: #3d3d5c;
        }

        .tooltip-bottom::before {
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-bottom-color: #3d3d5c;
        }

        .tooltip-left::before {
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-left-color: #3d3d5c;
        }

        .tooltip-right::before {
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-right-color: #3d3d5c;
        }
      `}</style>
    </div>
  );
}
