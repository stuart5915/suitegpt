'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { COURSES, getTotalLessons } from '@lib/courses';

const difficultyColors: Record<string, string> = {
  beginner: '#22c55e',
  intermediate: '#eab308',
  advanced: '#ef4444',
};

export default function LearnPage() {
  return (
    <>
      <Navbar />
      <div className="learn-page">
        <div className="learn-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="page-title">Learn DeFi</h1>
            <p className="page-subtitle">
              {COURSES.length} structured courses from beginner to advanced. Learn at your own pace.
            </p>
          </motion.div>

          <div className="courses-grid">
            {COURSES.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Link href={`/learn/${course.id}`} className="course-card-link">
                  <div className="course-card">
                    <div className="card-top">
                      <span className="course-emoji">{course.emoji}</span>
                      <span
                        className="difficulty-badge"
                        style={{
                          background: `${difficultyColors[course.difficulty]}20`,
                          color: difficultyColors[course.difficulty],
                          border: `1px solid ${difficultyColors[course.difficulty]}40`,
                        }}
                      >
                        {course.difficulty}
                      </span>
                    </div>
                    <h3 className="course-title">{course.title}</h3>
                    <p className="course-description">{course.description}</p>
                    <div className="course-meta">
                      <span className="meta-item">
                        <span className="meta-icon">&#128218;</span> {getTotalLessons(course)} lessons
                      </span>
                      <span className="meta-item">
                        <span className="meta-icon">&#9202;</span> {course.duration}
                      </span>
                      <span className="meta-item">
                        <span className="meta-icon">&#128221;</span> {course.modules.length} modules
                      </span>
                    </div>
                    <div className="card-arrow">&#8594;</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        <style jsx>{`
          .learn-page {
            min-height: 100vh;
            background: #0a0a0f;
            padding: 100px 20px 60px 20px;
          }

          .learn-container {
            max-width: 1200px;
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
            margin: 0 0 48px 0;
          }

          .courses-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
            gap: 24px;
          }

          :global(.course-card-link) {
            text-decoration: none;
            display: block;
          }

          .course-card {
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 1px solid #3d3d5c;
            border-radius: 16px;
            padding: 28px;
            position: relative;
            transition: all 0.2s;
            cursor: pointer;
            height: 100%;
          }

          .course-card:hover {
            border-color: #a855f7;
            transform: translateY(-4px);
            box-shadow: 0 8px 32px rgba(168, 85, 247, 0.15);
          }

          .card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }

          .course-emoji {
            font-size: 40px;
          }

          .difficulty-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: capitalize;
          }

          .course-title {
            font-size: 20px;
            font-weight: 600;
            color: #f1f5f9;
            margin: 0 0 10px 0;
            line-height: 1.3;
          }

          .course-description {
            font-size: 14px;
            color: #94a3b8;
            margin: 0 0 20px 0;
            line-height: 1.6;
          }

          .course-meta {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
          }

          .meta-item {
            font-size: 13px;
            color: #64748b;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .meta-icon {
            font-size: 14px;
          }

          .card-arrow {
            position: absolute;
            bottom: 24px;
            right: 24px;
            font-size: 20px;
            color: #64748b;
            transition: transform 0.2s;
          }

          .course-card:hover .card-arrow {
            transform: translateX(4px);
            color: #a855f7;
          }

          @media (max-width: 768px) {
            .courses-grid {
              grid-template-columns: 1fr;
            }

            .page-title {
              font-size: 28px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
