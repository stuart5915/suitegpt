'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { DEFI_ACTIONS, CATEGORIES, ECOSYSTEMS, RISK_INFO } from '@lib/defiActions';
import type { ActivityCategory, Ecosystem, DeFiAction } from '@lib/defiActions';

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState<'all' | ActivityCategory>('all');
  const [activeEcosystem, setActiveEcosystem] = useState<'all' | Ecosystem>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredActions = useMemo(() => {
    let actions = DEFI_ACTIONS;

    if (activeCategory !== 'all') {
      actions = actions.filter(a => a.category === activeCategory);
    }

    if (activeEcosystem !== 'all') {
      actions = actions.filter(a => a.ecosystems.includes(activeEcosystem));
    }

    return actions;
  }, [activeCategory, activeEcosystem]);

  function toggleExpand(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <>
      <Navbar />
      <div className="explore-page">
        <div className="explore-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="page-title">Explore DeFi</h1>
            <p className="page-subtitle">
              Discover protocols, learn what they do, and understand the risks before you try them.
            </p>
          </motion.div>

          {/* Category tabs */}
          <div className="category-tabs">
            <button
              className={`tab-btn ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>

          {/* Ecosystem pills */}
          <div className="ecosystem-filters">
            <button
              className={`eco-pill ${activeEcosystem === 'all' ? 'active' : ''}`}
              onClick={() => setActiveEcosystem('all')}
            >
              All Chains
            </button>
            {ECOSYSTEMS.map((eco) => (
              <button
                key={eco.id}
                className={`eco-pill ${activeEcosystem === eco.id ? 'active' : ''}`}
                onClick={() => setActiveEcosystem(eco.id)}
                style={{
                  ...(activeEcosystem === eco.id ? {
                    borderColor: eco.color,
                    color: eco.color,
                    background: `${eco.color}15`,
                  } : {})
                }}
              >
                {eco.icon} {eco.name}
              </button>
            ))}
          </div>

          {/* Results count */}
          <p className="results-count">{filteredActions.length} protocols</p>

          {/* Protocol cards */}
          <div className="protocols-list">
            {filteredActions.map((action, index) => {
              const isExpanded = expandedId === action.id;
              const riskInfo = RISK_INFO[action.risk];
              const catInfo = CATEGORIES.find(c => c.id === action.category);

              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
                  className={`protocol-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => toggleExpand(action.id)}
                >
                  <div className="card-header">
                    <div className="card-left">
                      <h3 className="protocol-name">{action.name}</h3>
                      <p className="protocol-desc">{action.description}</p>
                      <div className="card-badges">
                        <span
                          className="risk-badge"
                          style={{
                            background: `${riskInfo.color}20`,
                            color: riskInfo.color,
                            border: `1px solid ${riskInfo.color}40`,
                          }}
                        >
                          {riskInfo.emoji} {riskInfo.label}
                        </span>
                        {catInfo && (
                          <span className="cat-label">
                            {catInfo.emoji} {catInfo.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="card-right">
                      <div className="eco-badges">
                        {action.ecosystems.map(ecoId => {
                          const eco = ECOSYSTEMS.find(e => e.id === ecoId);
                          return eco ? (
                            <span
                              key={ecoId}
                              className="eco-badge"
                              title={eco.name}
                              style={{
                                background: `${eco.color}20`,
                                color: eco.color,
                                border: `1px solid ${eco.color}30`,
                              }}
                            >
                              {eco.icon}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <span className={`expand-chevron ${isExpanded ? 'rotated' : ''}`}>
                        &#9660;
                      </span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="card-expanded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="expanded-content">
                          <div className="explainer-section">
                            <h4>What It Does</h4>
                            <p>{action.explainer.whatItDoes}</p>
                          </div>
                          <div className="explainer-section">
                            <h4>How It Works</h4>
                            <p>{action.explainer.howItWorks}</p>
                          </div>
                          <div className="explainer-section">
                            <h4>Fees</h4>
                            <p>{action.explainer.fees}</p>
                          </div>
                          {action.explainer.tips.length > 0 && (
                            <div className="explainer-section">
                              <h4>Tips</h4>
                              <ul className="tips-list">
                                {action.explainer.tips.map((tip, i) => (
                                  <li key={i}>{tip}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="explainer-section eco-list">
                            <h4>Available On</h4>
                            <div className="eco-names">
                              {action.ecosystems.map(ecoId => {
                                const eco = ECOSYSTEMS.find(e => e.id === ecoId);
                                return eco ? (
                                  <span key={ecoId} className="eco-name-badge" style={{ color: eco.color }}>
                                    {eco.icon} {eco.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                          <a
                            href={action.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="visit-btn"
                          >
                            Visit {action.protocol} &#8599;
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {filteredActions.length === 0 && (
              <div className="no-results">
                <span className="no-results-icon">&#128301;</span>
                <p>No protocols match your filters.</p>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .explore-page {
            min-height: 100vh;
            background: #0a0a0f;
            padding: 100px 20px 60px 20px;
          }

          .explore-container {
            max-width: 1000px;
            margin: 0 auto;
          }

          .page-title {
            font-size: 36px;
            font-weight: 700;
            color: #f1f5f9;
            margin: 0 0 12px 0;
          }

          .page-subtitle {
            font-size: 18px;
            color: #94a3b8;
            margin: 0 0 32px 0;
          }

          .category-tabs {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            margin-bottom: 16px;
            background: #1e1e2f;
            border-radius: 12px;
            padding: 4px;
            border: 1px solid #3d3d5c;
          }

          .tab-btn {
            padding: 10px 16px;
            border-radius: 8px;
            border: none;
            background: none;
            color: #94a3b8;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
          }

          .tab-btn:hover {
            color: #f1f5f9;
            background: #ffffff10;
          }

          .tab-btn.active {
            background: #a855f720;
            color: #a855f7;
          }

          .ecosystem-filters {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 20px;
          }

          .eco-pill {
            padding: 6px 14px;
            border-radius: 20px;
            border: 1px solid #3d3d5c;
            background: #0a0a0f;
            color: #94a3b8;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
          }

          .eco-pill:hover {
            border-color: #a855f7;
            color: #f1f5f9;
          }

          .eco-pill.active {
            background: #a855f715;
            border-color: #a855f7;
            color: #a855f7;
          }

          .results-count {
            font-size: 14px;
            color: #64748b;
            margin: 0 0 16px 0;
          }

          .protocols-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .protocol-card {
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 1px solid #3d3d5c;
            border-radius: 16px;
            padding: 24px;
            cursor: pointer;
            transition: all 0.15s;
          }

          .protocol-card:hover {
            border-color: #a855f750;
          }

          .protocol-card.expanded {
            border-color: #a855f7;
          }

          .card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .card-left {
            flex: 1;
          }

          .protocol-name {
            font-size: 18px;
            font-weight: 600;
            color: #f1f5f9;
            margin: 0 0 6px 0;
          }

          .protocol-desc {
            font-size: 14px;
            color: #94a3b8;
            margin: 0 0 12px 0;
            line-height: 1.5;
          }

          .card-badges {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
          }

          .risk-badge {
            padding: 3px 10px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
          }

          .cat-label {
            font-size: 12px;
            color: #64748b;
          }

          .card-right {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 12px;
          }

          .eco-badges {
            display: flex;
            gap: 4px;
          }

          .eco-badge {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          }

          .expand-chevron {
            color: #64748b;
            font-size: 10px;
            transition: transform 0.3s;
          }

          .expand-chevron.rotated {
            transform: rotate(180deg);
          }

          .card-expanded {
            overflow: hidden;
          }

          .expanded-content {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #3d3d5c;
          }

          .explainer-section {
            margin-bottom: 20px;
          }

          .explainer-section:last-of-type {
            margin-bottom: 24px;
          }

          .explainer-section h4 {
            font-size: 14px;
            font-weight: 600;
            color: #a855f7;
            margin: 0 0 8px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .explainer-section p {
            font-size: 15px;
            color: #cbd5e1;
            margin: 0;
            line-height: 1.7;
          }

          .tips-list {
            margin: 0;
            padding-left: 20px;
          }

          .tips-list li {
            font-size: 14px;
            color: #cbd5e1;
            margin-bottom: 6px;
            line-height: 1.6;
          }

          .eco-names {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }

          .eco-name-badge {
            font-size: 13px;
            font-weight: 500;
          }

          .visit-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #a855f7, #6366f1);
            border-radius: 10px;
            color: white;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            transition: opacity 0.2s, transform 0.2s;
          }

          .visit-btn:hover {
            opacity: 0.9;
            transform: translateY(-2px);
          }

          .no-results {
            text-align: center;
            padding: 48px;
            color: #64748b;
          }

          .no-results-icon {
            font-size: 48px;
            display: block;
            margin-bottom: 12px;
            opacity: 0.5;
          }

          .no-results p {
            margin: 0;
            font-size: 16px;
          }

          @media (max-width: 768px) {
            .page-title { font-size: 28px; }
            .category-tabs {
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }
            .card-header { flex-direction: column; }
            .card-right {
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              width: 100%;
            }
          }
        `}</style>
      </div>
    </>
  );
}
