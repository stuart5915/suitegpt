'use client';

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { TERMINOLOGY, CATEGORY_INFO, findTerm } from '@lib/terminology';
import type { Term } from '@lib/terminology';

const ALL_CATEGORIES = ['all', 'basics', 'blockchain', 'defi', 'trading', 'security'] as const;

function renderFullDef(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const match = remaining.match(/\[\[([^\]]+)\]\]/);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    if (match.index > 0) {
      parts.push(remaining.substring(0, match.index));
    }

    const termName = match[1];
    const termSlug = termName.toLowerCase().replace(/\s+/g, '-');
    parts.push(
      <Link
        key={`def-link-${key++}`}
        href={`/glossary?term=${encodeURIComponent(termSlug)}`}
        className="def-term-link"
        onClick={(e) => {
          e.preventDefault();
          // Update URL and scroll to the term
          window.history.pushState({}, '', `/glossary?term=${encodeURIComponent(termSlug)}`);
          window.dispatchEvent(new CustomEvent('glossary-navigate', { detail: termSlug }));
        }}
      >
        {termName}
      </Link>
    );

    remaining = remaining.substring(match.index + match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function GlossaryContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const termRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Handle initial ?term= param and custom nav events
  const scrollToTerm = useCallback((termSlug: string) => {
    // Find the term by slug
    const found = TERMINOLOGY.find(t => t.id === termSlug);
    if (found) {
      setActiveCategory('all');
      setSearch('');
      setExpandedId(found.id);
      setTimeout(() => {
        termRefs.current[found.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, []);

  useEffect(() => {
    const termParam = searchParams.get('term');
    if (termParam) {
      scrollToTerm(termParam);
    }
  }, [searchParams, scrollToTerm]);

  useEffect(() => {
    function handleNav(e: Event) {
      const termSlug = (e as CustomEvent).detail;
      scrollToTerm(termSlug);
    }
    window.addEventListener('glossary-navigate', handleNav);
    return () => window.removeEventListener('glossary-navigate', handleNav);
  }, [scrollToTerm]);

  const filteredTerms = useMemo(() => {
    let terms = TERMINOLOGY;

    if (activeCategory !== 'all') {
      terms = terms.filter(t => t.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      terms = terms.filter(
        t =>
          t.term.toLowerCase().includes(q) ||
          t.shortDef.toLowerCase().includes(q)
      );
    }

    return terms;
  }, [activeCategory, search]);

  function toggleExpand(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <>
      <Navbar />
      <div className="glossary-page">
        <div className="glossary-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="page-title">DeFi Glossary</h1>
            <p className="page-subtitle">
              {TERMINOLOGY.length} terms and definitions to help you navigate the world of DeFi.
            </p>
          </motion.div>

          {/* Search */}
          <div className="search-bar">
            <span className="search-icon">&#128269;</span>
            <input
              type="text"
              placeholder="Search terms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button className="clear-btn" onClick={() => setSearch('')}>
                &#10005;
              </button>
            )}
          </div>

          {/* Category filters */}
          <div className="category-filters">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'all' ? 'All' : `${CATEGORY_INFO[cat as Term['category']].emoji} ${CATEGORY_INFO[cat as Term['category']].label}`}
              </button>
            ))}
          </div>

          {/* Results count */}
          <p className="results-count">{filteredTerms.length} terms</p>

          {/* Terms list */}
          <div className="terms-list">
            {filteredTerms.map((term, index) => {
              const isExpanded = expandedId === term.id;
              const catInfo = CATEGORY_INFO[term.category];

              return (
                <motion.div
                  key={term.id}
                  ref={(el) => { termRefs.current[term.id] = el; }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.5) }}
                  className={`term-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => toggleExpand(term.id)}
                >
                  <div className="term-header">
                    <div className="term-left">
                      <h3 className="term-name">{term.term}</h3>
                      <p className="term-short">{term.shortDef}</p>
                    </div>
                    <div className="term-right">
                      <span
                        className="cat-badge"
                        style={{
                          background: '#a855f720',
                          color: '#a855f7',
                        }}
                      >
                        {catInfo.emoji} {catInfo.label}
                      </span>
                      <span className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>
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
                        className="term-expanded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="full-def">
                          {renderFullDef(term.fullDef)}
                        </div>

                        {term.relatedTerms.length > 0 && (
                          <div className="related-terms">
                            <span className="related-label">Related:</span>
                            <div className="related-chips">
                              {term.relatedTerms.map((rt) => {
                                const found = findTerm(rt);
                                const slug = found ? found.id : rt.toLowerCase().replace(/\s+/g, '-');
                                return (
                                  <Link
                                    key={rt}
                                    href={`/glossary?term=${encodeURIComponent(slug)}`}
                                    className="related-chip"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.history.pushState({}, '', `/glossary?term=${encodeURIComponent(slug)}`);
                                      scrollToTerm(slug);
                                    }}
                                  >
                                    {rt}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {filteredTerms.length === 0 && (
              <div className="no-results">
                <span className="no-results-icon">&#128270;</span>
                <p>No terms found matching your search.</p>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .glossary-page {
            min-height: 100vh;
            background: #0a0a0f;
            padding: 100px 20px 60px 20px;
          }

          .glossary-container {
            max-width: 900px;
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

          .search-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #1e1e2f;
            border: 1px solid #3d3d5c;
            border-radius: 12px;
            padding: 0 16px;
            margin-bottom: 20px;
            transition: border-color 0.2s;
          }

          .search-bar:focus-within {
            border-color: #a855f7;
          }

          .search-icon {
            font-size: 18px;
            color: #64748b;
          }

          .search-input {
            flex: 1;
            background: none;
            border: none;
            outline: none;
            color: #f1f5f9;
            font-size: 16px;
            padding: 14px 0;
          }

          .search-input::placeholder {
            color: #64748b;
          }

          .clear-btn {
            background: none;
            border: none;
            color: #64748b;
            cursor: pointer;
            font-size: 16px;
            padding: 4px;
          }

          .clear-btn:hover {
            color: #f1f5f9;
          }

          .category-filters {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 20px;
          }

          .category-pill {
            padding: 8px 16px;
            border-radius: 20px;
            border: 1px solid #3d3d5c;
            background: #1e1e2f;
            color: #94a3b8;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
          }

          .category-pill:hover {
            border-color: #a855f7;
            color: #f1f5f9;
          }

          .category-pill.active {
            background: #a855f720;
            border-color: #a855f7;
            color: #a855f7;
          }

          .results-count {
            font-size: 14px;
            color: #64748b;
            margin: 0 0 16px 0;
          }

          .terms-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .term-card {
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 1px solid #3d3d5c;
            border-radius: 12px;
            padding: 20px 24px;
            cursor: pointer;
            transition: all 0.15s;
          }

          .term-card:hover {
            border-color: #a855f750;
          }

          .term-card.expanded {
            border-color: #a855f7;
          }

          .term-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }

          .term-left {
            flex: 1;
          }

          .term-name {
            font-size: 17px;
            font-weight: 600;
            color: #f1f5f9;
            margin: 0 0 4px 0;
          }

          .term-short {
            font-size: 14px;
            color: #94a3b8;
            margin: 0;
            line-height: 1.5;
          }

          .term-right {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
          }

          .cat-badge {
            padding: 4px 10px;
            border-radius: 16px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
          }

          .expand-icon {
            color: #64748b;
            font-size: 10px;
            transition: transform 0.3s;
          }

          .expand-icon.rotated {
            transform: rotate(180deg);
          }

          .term-expanded {
            overflow: hidden;
          }

          .full-def {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #3d3d5c;
            font-size: 15px;
            color: #cbd5e1;
            line-height: 1.7;
          }

          :global(.def-term-link) {
            color: #a855f7;
            text-decoration: none;
            font-weight: 500;
            border-bottom: 1px dashed #a855f750;
          }

          :global(.def-term-link:hover) {
            border-bottom-color: #a855f7;
          }

          .related-terms {
            margin-top: 16px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            flex-wrap: wrap;
          }

          .related-label {
            font-size: 13px;
            color: #64748b;
            padding-top: 4px;
          }

          .related-chips {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }

          :global(.related-chip) {
            padding: 4px 12px;
            border-radius: 16px;
            background: #0a0a0f;
            border: 1px solid #3d3d5c;
            color: #94a3b8;
            font-size: 12px;
            text-decoration: none;
            transition: all 0.15s;
          }

          :global(.related-chip:hover) {
            border-color: #a855f7;
            color: #a855f7;
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
            .term-header { flex-direction: column; }
            .term-right { align-self: flex-start; }
            .cat-badge { display: none; }
          }
        `}</style>
      </div>
    </>
  );
}

export default function GlossaryPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        Loading glossary...
      </div>
    }>
      <GlossaryContent />
    </Suspense>
  );
}
