'use client';

import { ReactNode } from 'react';

interface BrowserFrameProps {
    title: string;
    url: string;
    children: ReactNode;
}

export default function BrowserFrame({ title, url, children }: BrowserFrameProps) {
    return (
        <div className="browser-frame">
            {/* Browser Chrome */}
            <div className="browser-chrome">
                <div className="browser-controls">
                    <div className="control-dot red" />
                    <div className="control-dot yellow" />
                    <div className="control-dot green" />
                </div>
                <div className="browser-tabs">
                    <div className="browser-tab active">
                        <span>{title}</span>
                    </div>
                </div>
                <div className="browser-actions">
                    <span>⋯</span>
                </div>
            </div>

            {/* URL Bar */}
            <div className="browser-url-bar">
                <div className="url-input">
                    <span className="lock-icon">🔒</span>
                    <span className="url-text">{url}</span>
                </div>
                <div className="url-actions">
                    <span>⭐</span>
                    <span>⚙️</span>
                </div>
            </div>

            {/* Content */}
            <div className="browser-content">
                {children}
            </div>

            <style jsx>{`
        .browser-frame {
          background: #1e1e2e;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .browser-chrome {
          background: #0f0f1a;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-bottom: 1px solid #2a2a3a;
        }

        .browser-controls {
          display: flex;
          gap: 6px;
        }

        .control-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .control-dot.red {
          background: #ff5f57;
        }

        .control-dot.yellow {
          background: #ffbd2e;
        }

        .control-dot.green {
          background: #28c840;
        }

        .browser-tabs {
          flex: 1;
          display: flex;
          gap: 4px;
        }

        .browser-tab {
          background: #1e1e2e;
          padding: 6px 16px;
          border-radius: 8px 8px 0 0;
          font-size: 13px;
          color: #94a3b8;
          border: 1px solid #2a2a3a;
          border-bottom: none;
        }

        .browser-tab.active {
          color: #f1f5f9;
        }

        .browser-actions {
          font-size: 16px;
          color: #64748b;
          cursor: pointer;
        }

        .browser-url-bar {
          background: #0f0f1a;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-bottom: 1px solid #2a2a3a;
        }

        .url-input {
          flex: 1;
          background: #1e1e2e;
          border: 1px solid #2a2a3a;
          border-radius: 8px;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .lock-icon {
          font-size: 12px;
        }

        .url-text {
          font-size: 13px;
          color: #94a3b8;
          font-family: monospace;
        }

        .url-actions {
          display: flex;
          gap: 12px;
          font-size: 14px;
          color: #64748b;
        }

        .browser-content {
          flex: 1;
          background: #0a0a0f;
          overflow-y: auto;
        }

        .browser-content::-webkit-scrollbar {
          width: 8px;
        }

        .browser-content::-webkit-scrollbar-track {
          background: #0a0a0f;
        }

        .browser-content::-webkit-scrollbar-thumb {
          background: #2a2a3a;
          border-radius: 4px;
        }
      `}</style>
        </div>
    );
}
