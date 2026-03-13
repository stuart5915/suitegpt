'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Quiz from '@/components/Quiz';
import { getCourseById } from '@lib/courses';
import type { Course, Module, Lesson } from '@lib/courses';

// Find lesson location within a course
function findLessonContext(course: Course, lessonId: string) {
  for (let mi = 0; mi < course.modules.length; mi++) {
    const module = course.modules[mi];
    for (let li = 0; li < module.lessons.length; li++) {
      if (module.lessons[li].id === lessonId) {
        return { module, moduleIndex: mi, lessonIndex: li };
      }
    }
  }
  return null;
}

// Get prev/next lesson across modules
function getAdjacentLessons(course: Course, lessonId: string) {
  const allLessons: { lesson: Lesson; module: Module; moduleIndex: number }[] = [];
  for (let mi = 0; mi < course.modules.length; mi++) {
    for (const lesson of course.modules[mi].lessons) {
      allLessons.push({ lesson, module: course.modules[mi], moduleIndex: mi });
    }
  }

  const currentIdx = allLessons.findIndex(l => l.lesson.id === lessonId);
  return {
    prev: currentIdx > 0 ? allLessons[currentIdx - 1] : null,
    next: currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null,
    isLastInModule: (() => {
      const ctx = findLessonContext(course, lessonId);
      if (!ctx) return false;
      return ctx.lessonIndex === ctx.module.lessons.length - 1;
    })(),
  };
}

// Simple markdown-like renderer
function renderContent(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];
  let key = 0;

  function flushList() {
    if (inList && listItems.length > 0) {
      elements.push(<ul key={`list-${key++}`} className="content-list">{listItems}</ul>);
      listItems = [];
      inList = false;
    }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      elements.push(
        <div key={`table-wrap-${key++}`} className="table-wrapper">
          <table className="content-table">
            {tableHeader.length > 0 && (
              <thead>
                <tr>
                  {tableHeader.map((h, i) => (
                    <th key={i}>{renderInline(h.trim())}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderInline(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      tableHeader = [];
      inTable = false;
    }
  }

  function renderInline(text: string): React.ReactNode {
    // Handle [[term]] links, **bold**, and inline content
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let inlineKey = 0;

    while (remaining.length > 0) {
      // Check for [[term]]
      const termMatch = remaining.match(/\[\[([^\]]+)\]\]/);
      // Check for **bold**
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

      let firstMatch: { index: number; length: number; type: 'term' | 'bold'; content: string } | null = null;

      if (termMatch && termMatch.index !== undefined) {
        firstMatch = { index: termMatch.index, length: termMatch[0].length, type: 'term', content: termMatch[1] };
      }
      if (boldMatch && boldMatch.index !== undefined) {
        if (!firstMatch || boldMatch.index < firstMatch.index) {
          firstMatch = { index: boldMatch.index, length: boldMatch[0].length, type: 'bold', content: boldMatch[1] };
        }
      }

      if (!firstMatch) {
        parts.push(remaining);
        break;
      }

      // Add text before the match
      if (firstMatch.index > 0) {
        parts.push(remaining.substring(0, firstMatch.index));
      }

      if (firstMatch.type === 'term') {
        const termSlug = firstMatch.content.toLowerCase().replace(/\s+/g, '-');
        parts.push(
          <Link
            key={`term-${inlineKey++}`}
            href={`/glossary?term=${encodeURIComponent(termSlug)}`}
            className="term-link"
          >
            {firstMatch.content}
          </Link>
        );
      } else {
        parts.push(<strong key={`bold-${inlineKey++}`}>{firstMatch.content}</strong>);
      }

      remaining = remaining.substring(firstMatch.index + firstMatch.length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line = paragraph break
    if (trimmed === '') {
      flushList();
      flushTable();
      continue;
    }

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed.slice(1, -1).split('|');

      // Skip separator rows (|---|---|)
      if (cells.every(c => /^[\s-:]+$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Heading
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${key++}`} className="content-h2">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${key++}`} className="content-h1">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`bq-${key++}`} className="content-blockquote">
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // List item
    if (trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
      inList = true;
      const text = trimmed.startsWith('- ')
        ? trimmed.slice(2)
        : trimmed.replace(/^\d+\.\s/, '');
      listItems.push(
        <li key={`li-${key++}`}>{renderInline(text)}</li>
      );
      continue;
    }

    // Paragraph
    flushList();
    elements.push(
      <p key={`p-${key++}`} className="content-paragraph">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();
  flushTable();

  return elements;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;

  const course = getCourseById(courseId);
  const [showQuiz, setShowQuiz] = useState(false);

  const context = useMemo(() => {
    if (!course) return null;
    return findLessonContext(course, lessonId);
  }, [course, lessonId]);

  const adjacent = useMemo(() => {
    if (!course) return null;
    return getAdjacentLessons(course, lessonId);
  }, [course, lessonId]);

  if (!course || !context) {
    return (
      <>
        <Navbar />
        <div className="error-page">
          <h1>Lesson Not Found</h1>
          <p>This lesson does not exist.</p>
          <Link href="/learn" className="back-link">Back to Courses</Link>
          <style jsx>{`
            .error-page {
              min-height: 100vh;
              background: #0a0a0f;
              padding: 120px 20px;
              text-align: center;
              color: #f1f5f9;
            }
            .error-page h1 { font-size: 32px; margin-bottom: 12px; }
            .error-page p { color: #94a3b8; margin-bottom: 24px; }
            :global(.back-link) { color: #a855f7; text-decoration: none; font-weight: 600; }
          `}</style>
        </div>
      </>
    );
  }

  const { module, lessonIndex } = context;
  const lesson = module.lessons[lessonIndex];

  const isLastLessonInModule = lessonIndex === module.lessons.length - 1;
  const hasQuiz = module.quiz && module.quiz.length > 0;

  function handleQuizContinue() {
    if (adjacent?.next) {
      router.push(`/learn/${courseId}/${adjacent.next.lesson.id}`);
    } else {
      router.push(`/learn/${courseId}`);
    }
  }

  return (
    <>
      <Navbar />
      <div className="lesson-page">
        <div className="lesson-container">
          {/* Breadcrumbs */}
          <nav className="breadcrumbs">
            <Link href="/learn" className="breadcrumb-link">Learn</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/learn/${courseId}`} className="breadcrumb-link">{course.title}</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{lesson.title}</span>
          </nav>

          {/* Lesson Content */}
          <motion.article
            className="lesson-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="lesson-meta-bar">
              <span className="module-label">{module.emoji} {module.title}</span>
              <span className="duration-label">{lesson.duration}</span>
            </div>

            <div className="content-body">
              {renderContent(lesson.content)}
            </div>

            {/* Quiz section */}
            {isLastLessonInModule && hasQuiz && !showQuiz && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="quiz-prompt"
              >
                <p>You have completed all lessons in this module!</p>
                <button className="start-quiz-btn" onClick={() => setShowQuiz(true)}>
                  Take the Quiz &#8594;
                </button>
              </motion.div>
            )}

            {showQuiz && (
              <Quiz
                questions={module.quiz}
                moduleTitle={module.title}
                onContinue={handleQuizContinue}
              />
            )}
          </motion.article>

          {/* Navigation */}
          {!showQuiz && (
            <div className="lesson-nav">
              {adjacent?.prev ? (
                <Link
                  href={`/learn/${courseId}/${adjacent.prev.lesson.id}`}
                  className="nav-btn prev-btn"
                >
                  <span className="nav-arrow">&#8592;</span>
                  <div className="nav-label">
                    <span className="nav-direction">Previous</span>
                    <span className="nav-title">{adjacent.prev.lesson.title}</span>
                  </div>
                </Link>
              ) : (
                <div />
              )}
              {adjacent?.next && !(isLastLessonInModule && hasQuiz) ? (
                <Link
                  href={`/learn/${courseId}/${adjacent.next.lesson.id}`}
                  className="nav-btn next-btn"
                >
                  <div className="nav-label" style={{ textAlign: 'right' }}>
                    <span className="nav-direction">Next</span>
                    <span className="nav-title">{adjacent.next.lesson.title}</span>
                  </div>
                  <span className="nav-arrow">&#8594;</span>
                </Link>
              ) : !isLastLessonInModule || !hasQuiz ? (
                <Link
                  href={`/learn/${courseId}`}
                  className="nav-btn next-btn"
                >
                  <div className="nav-label" style={{ textAlign: 'right' }}>
                    <span className="nav-direction">Back to</span>
                    <span className="nav-title">Course Overview</span>
                  </div>
                  <span className="nav-arrow">&#8594;</span>
                </Link>
              ) : (
                <div />
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .lesson-page {
            min-height: 100vh;
            background: #0a0a0f;
            padding: 100px 20px 60px 20px;
          }

          .lesson-container {
            max-width: 800px;
            margin: 0 auto;
          }

          .breadcrumbs {
            margin-bottom: 32px;
            font-size: 14px;
          }

          :global(.breadcrumb-link) {
            color: #a855f7;
            text-decoration: none;
          }
          :global(.breadcrumb-link:hover) {
            text-decoration: underline;
          }

          .breadcrumb-sep {
            color: #64748b;
            margin: 0 8px;
          }

          .breadcrumb-current {
            color: #94a3b8;
          }

          .lesson-content {
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 1px solid #3d3d5c;
            border-radius: 16px;
            padding: 36px;
          }

          .lesson-meta-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #3d3d5c;
            flex-wrap: wrap;
            gap: 8px;
          }

          .module-label {
            font-size: 14px;
            color: #a855f7;
            font-weight: 600;
          }

          .duration-label {
            font-size: 13px;
            color: #64748b;
            background: #0a0a0f;
            padding: 4px 12px;
            border-radius: 20px;
          }

          .content-body {
            color: #f1f5f9;
            line-height: 1.7;
          }

          .content-body :global(.content-h1) {
            font-size: 28px;
            font-weight: 700;
            color: #f1f5f9;
            margin: 0 0 20px 0;
          }

          .content-body :global(.content-h2) {
            font-size: 22px;
            font-weight: 600;
            color: #e2e8f0;
            margin: 28px 0 14px 0;
          }

          .content-body :global(.content-paragraph) {
            font-size: 16px;
            color: #cbd5e1;
            margin: 0 0 16px 0;
            line-height: 1.7;
          }

          .content-body :global(.content-blockquote) {
            border-left: 3px solid #a855f7;
            padding: 12px 20px;
            margin: 20px 0;
            background: #a855f710;
            border-radius: 0 8px 8px 0;
            font-style: italic;
            color: #94a3b8;
          }

          .content-body :global(.content-list) {
            margin: 12px 0 20px 0;
            padding-left: 24px;
          }

          .content-body :global(.content-list li) {
            font-size: 16px;
            color: #cbd5e1;
            margin-bottom: 8px;
            line-height: 1.6;
          }

          .content-body :global(.term-link) {
            color: #a855f7;
            text-decoration: none;
            font-weight: 500;
            border-bottom: 1px dashed #a855f750;
            transition: border-color 0.2s;
          }
          .content-body :global(.term-link:hover) {
            border-bottom-color: #a855f7;
          }

          .content-body :global(.table-wrapper) {
            overflow-x: auto;
            margin: 20px 0;
          }

          .content-body :global(.content-table) {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }

          .content-body :global(.content-table th) {
            background: #0a0a0f;
            color: #a855f7;
            font-weight: 600;
            padding: 10px 14px;
            text-align: left;
            border: 1px solid #3d3d5c;
          }

          .content-body :global(.content-table td) {
            padding: 10px 14px;
            border: 1px solid #3d3d5c;
            color: #cbd5e1;
          }

          .quiz-prompt {
            margin-top: 40px;
            border-top: 2px solid #3d3d5c;
            padding-top: 32px;
            text-align: center;
          }

          .quiz-prompt p {
            font-size: 16px;
            color: #94a3b8;
            margin: 0 0 20px 0;
          }

          .start-quiz-btn {
            background: linear-gradient(135deg, #a855f7, #6366f1);
            border: none;
            border-radius: 12px;
            padding: 14px 28px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s, transform 0.2s;
          }

          .start-quiz-btn:hover {
            opacity: 0.9;
            transform: translateY(-2px);
          }

          .lesson-nav {
            display: flex;
            justify-content: space-between;
            margin-top: 32px;
            gap: 16px;
          }

          :global(.nav-btn) {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 20px;
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 1px solid #3d3d5c;
            border-radius: 12px;
            text-decoration: none;
            transition: all 0.15s;
            max-width: 48%;
          }

          :global(.nav-btn:hover) {
            border-color: #a855f7;
            transform: translateY(-2px);
          }

          .nav-arrow {
            font-size: 20px;
            color: #a855f7;
            flex-shrink: 0;
          }

          .nav-label {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .nav-direction {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .nav-title {
            font-size: 14px;
            color: #f1f5f9;
            font-weight: 500;
          }

          @media (max-width: 768px) {
            .lesson-content {
              padding: 24px 20px;
            }

            .lesson-nav {
              flex-direction: column;
            }

            :global(.nav-btn) {
              max-width: 100%;
            }

            .content-body :global(.content-h1) {
              font-size: 24px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
