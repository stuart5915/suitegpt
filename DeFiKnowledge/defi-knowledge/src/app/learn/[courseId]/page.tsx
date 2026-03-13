'use client';

import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { getCourseById, getTotalLessons } from '@lib/courses';

const difficultyColors: Record<string, string> = {
  beginner: '#22c55e',
  intermediate: '#eab308',
  advanced: '#ef4444',
};

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const course = getCourseById(courseId);

  if (!course) {
    return (
      <>
        <Navbar />
        <div className="error-page">
          <h1>Course Not Found</h1>
          <p>The course you are looking for does not exist.</p>
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
            :global(.back-link) {
              color: #a855f7;
              text-decoration: none;
              font-weight: 600;
            }
            :global(.back-link:hover) { text-decoration: underline; }
          `}</style>
        </div>
      </>
    );
  }

  const totalLessons = getTotalLessons(course);

  return (
    <>
      <Navbar />
      <div className="course-page">
        <div className="course-container">
          {/* Breadcrumbs */}
          <nav className="breadcrumbs">
            <Link href="/learn" className="breadcrumb-link">Learn</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{course.title}</span>
          </nav>

          {/* Course Header */}
          <motion.div
            className="course-header"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="course-emoji">{course.emoji}</span>
            <h1 className="course-title">{course.title}</h1>
            <p className="course-description">{course.description}</p>
            <div className="course-meta">
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
              <span className="meta-text">{totalLessons} lessons</span>
              <span className="meta-dot">&#183;</span>
              <span className="meta-text">{course.duration}</span>
              <span className="meta-dot">&#183;</span>
              <span className="meta-text">{course.modules.length} modules</span>
            </div>
          </motion.div>

          {/* Modules */}
          <div className="modules-list">
            {course.modules.map((module, moduleIndex) => (
              <motion.div
                key={module.id}
                className="module-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: moduleIndex * 0.1 }}
              >
                <div className="module-header">
                  <span className="module-emoji">{module.emoji}</span>
                  <div className="module-info">
                    <h2 className="module-title">
                      Module {moduleIndex + 1}: {module.title}
                    </h2>
                    <span className="module-meta">
                      {module.lessons.length} lessons
                      {module.quiz.length > 0 ? ` + ${module.quiz.length} quiz question${module.quiz.length > 1 ? 's' : ''}` : ''}
                    </span>
                  </div>
                </div>
                <div className="lessons-list">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <Link
                      key={lesson.id}
                      href={`/learn/${courseId}/${lesson.id}`}
                      className="lesson-item"
                    >
                      <div className="lesson-number">{lessonIndex + 1}</div>
                      <div className="lesson-info">
                        <span className="lesson-title">{lesson.title}</span>
                        <span className="lesson-duration">{lesson.duration}</span>
                      </div>
                      <span className="lesson-arrow">&#8594;</span>
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <style jsx>{`
          .course-page {
            min-height: 100vh;
            background: #0a0a0f;
            padding: 100px 20px 60px 20px;
          }

          .course-container {
            max-width: 900px;
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

          .course-header {
            margin-bottom: 48px;
          }

          .course-emoji {
            font-size: 56px;
            display: block;
            margin-bottom: 16px;
          }

          .course-title {
            font-size: 36px;
            font-weight: 700;
            color: #f1f5f9;
            margin: 0 0 12px 0;
          }

          .course-description {
            font-size: 18px;
            color: #94a3b8;
            margin: 0 0 20px 0;
            line-height: 1.6;
          }

          .course-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .difficulty-badge {
            padding: 4px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            text-transform: capitalize;
          }

          .meta-text {
            font-size: 14px;
            color: #64748b;
          }

          .meta-dot {
            color: #3d3d5c;
          }

          .modules-list {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .module-card {
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 1px solid #3d3d5c;
            border-radius: 16px;
            overflow: hidden;
          }

          .module-header {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 24px 28px;
            border-bottom: 1px solid #3d3d5c;
          }

          .module-emoji {
            font-size: 32px;
          }

          .module-info {
            flex: 1;
          }

          .module-title {
            font-size: 18px;
            font-weight: 600;
            color: #f1f5f9;
            margin: 0 0 4px 0;
          }

          .module-meta {
            font-size: 13px;
            color: #64748b;
          }

          .lessons-list {
            display: flex;
            flex-direction: column;
          }

          :global(.lesson-item) {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px 28px;
            text-decoration: none;
            border-bottom: 1px solid #2a2a4a;
            transition: background 0.15s;
          }

          :global(.lesson-item:last-child) {
            border-bottom: none;
          }

          :global(.lesson-item:hover) {
            background: #ffffff08;
          }

          .lesson-number {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #3d3d5c;
            color: #94a3b8;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 600;
            flex-shrink: 0;
          }

          .lesson-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .lesson-title {
            font-size: 15px;
            color: #f1f5f9;
            font-weight: 500;
          }

          .lesson-duration {
            font-size: 12px;
            color: #64748b;
          }

          .lesson-arrow {
            color: #64748b;
            font-size: 16px;
            transition: transform 0.15s;
          }

          :global(.lesson-item:hover) .lesson-arrow {
            transform: translateX(3px);
            color: #a855f7;
          }

          @media (max-width: 768px) {
            .course-title {
              font-size: 28px;
            }
            .course-emoji {
              font-size: 40px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
