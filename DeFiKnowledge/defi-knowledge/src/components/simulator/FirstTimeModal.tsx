'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface FirstTimeModalProps {
    isOpen: boolean;
    onClose: () => void;
    platform: {
        icon: string;
        name: string;
        title: string;
        keyPoints: string[];
        learnMoreLink?: string;
    };
}

export default function FirstTimeModal({ isOpen, onClose, platform }: FirstTimeModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="modal-overlay" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="modal-content"
                >
                    <div className="modal-header">
                        <span className="modal-icon">{platform.icon}</span>
                        <h2>{platform.title}</h2>
                    </div>

                    <div className="modal-body">
                        <p className="modal-subtitle">Key points:</p>
                        <ul className="key-points">
                            {platform.keyPoints.map((point, i) => (
                                <li key={i}>{point}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="modal-footer">
                        <button onClick={onClose} className="btn-primary">
                            Skip to Simulation
                        </button>
                        {platform.learnMoreLink && (
                            <Link href={platform.learnMoreLink} className="btn-secondary" onClick={onClose}>
                                Learn More
                            </Link>
                        )}
                    </div>
                </motion.div>

                <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            padding: 20px;
          }

          :global(.modal-content) {
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 1px solid #3d3d5c;
            border-radius: 20px;
            max-width: 500px;
            width: 100%;
            padding: 32px;
          }

          .modal-header {
            text-align: center;
            margin-bottom: 24px;
          }

          .modal-icon {
            font-size: 64px;
            display: block;
            margin-bottom: 16px;
          }

          .modal-header h2 {
            font-size: 28px;
            font-weight: 700;
            color: #f1f5f9;
            margin: 0;
          }

          .modal-body {
            margin-bottom: 32px;
          }

          .modal-subtitle {
            font-size: 14px;
            color: #94a3b8;
            margin: 0 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .key-points {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .key-points li {
            padding: 12px 16px;
            background: #ffffff08;
            border-radius: 8px;
            margin-bottom: 8px;
            color: #f1f5f9;
            font-size: 15px;
            line-height: 1.5;
          }

          .key-points li::before {
            content: '•';
            color: #a855f7;
            font-weight: bold;
            display: inline-block;
            width: 1em;
            margin-right: 8px;
          }

          .modal-footer {
            display: flex;
            gap: 12px;
            flex-direction: column;
          }

          .btn-primary {
            padding: 14px 24px;
            background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
          }

          .btn-primary:hover {
            transform: translateY(-2px);
          }

          :global(.btn-secondary) {
            padding: 14px 24px;
            background: transparent;
            color: #94a3b8;
            border: 1px solid #3d3d5c;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            text-align: center;
            transition: all 0.2s;
          }

          :global(.btn-secondary:hover) {
            background: #ffffff10;
            color: #f1f5f9;
          }
        `}</style>
            </div>
        </AnimatePresence>
    );
}
