'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuizQuestion } from '@lib/courses';

interface QuizProps {
  questions: QuizQuestion[];
  moduleTitle: string;
  onContinue: () => void;
}

export default function Quiz({ questions, moduleTitle, onContinue }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answered, setAnswered] = useState(false);

  const currentQuestion = questions[currentIndex];

  function handleSelect(optionIndex: number) {
    if (answered) return;
    setSelectedIndex(optionIndex);
    setAnswered(true);
    if (optionIndex === currentQuestion.correctIndex) {
      setScore(s => s + 1);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelectedIndex(null);
      setAnswered(false);
    } else {
      setShowResult(true);
    }
  }

  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    const passed = percentage >= 70;

    return (
      <div className="quiz-container">
        <motion.div
          className="quiz-result"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="result-emoji">{passed ? '🎉' : '📖'}</span>
          <h3 className="result-title">
            {passed ? 'Quiz Complete!' : 'Keep Learning!'}
          </h3>
          <p className="result-score">
            You scored <strong>{score}/{questions.length}</strong> ({percentage}%)
          </p>
          <p className="result-message">
            {passed
              ? `Great job! You've mastered "${moduleTitle}".`
              : `Review the material and try again to strengthen your understanding.`
            }
          </p>
          <button className="continue-btn" onClick={onContinue}>
            Continue to Next Module &#8594;
          </button>
        </motion.div>

        <style jsx>{`
          .quiz-container {
            margin-top: 40px;
          }
          .quiz-result {
            background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
            border: 1px solid #3d3d5c;
            border-radius: 16px;
            padding: 48px 32px;
            text-align: center;
          }
          .result-emoji {
            font-size: 64px;
            display: block;
            margin-bottom: 16px;
          }
          .result-title {
            font-size: 28px;
            font-weight: 700;
            color: #f1f5f9;
            margin: 0 0 12px 0;
          }
          .result-score {
            font-size: 18px;
            color: #94a3b8;
            margin: 0 0 8px 0;
          }
          .result-score strong {
            color: #a855f7;
          }
          .result-message {
            font-size: 15px;
            color: #64748b;
            margin: 0 0 32px 0;
          }
          .continue-btn {
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
          .continue-btn:hover {
            opacity: 0.9;
            transform: translateY(-2px);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h3 className="quiz-title">Quiz: {moduleTitle}</h3>
        <span className="quiz-progress">
          Question {currentIndex + 1} of {questions.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="quiz-question"
        >
          <p className="question-text">{currentQuestion.question}</p>
          <div className="options-list">
            {currentQuestion.options.map((option, i) => {
              let optionClass = 'option-btn';
              if (answered) {
                if (i === currentQuestion.correctIndex) {
                  optionClass += ' correct';
                } else if (i === selectedIndex) {
                  optionClass += ' incorrect';
                }
              } else if (i === selectedIndex) {
                optionClass += ' selected';
              }

              return (
                <button
                  key={i}
                  className={optionClass}
                  onClick={() => handleSelect(i)}
                  disabled={answered}
                >
                  <span className="option-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="option-text">{option}</span>
                </button>
              );
            })}
          </div>

          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="answer-feedback"
            >
              <p className={selectedIndex === currentQuestion.correctIndex ? 'feedback-correct' : 'feedback-incorrect'}>
                {selectedIndex === currentQuestion.correctIndex
                  ? 'Correct!'
                  : `Incorrect. The answer is: ${currentQuestion.options[currentQuestion.correctIndex]}`
                }
              </p>
              <button className="next-btn" onClick={handleNext}>
                {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'} &#8594;
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <style jsx>{`
        .quiz-container {
          margin-top: 40px;
          border-top: 2px solid #3d3d5c;
          padding-top: 32px;
        }
        .quiz-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .quiz-title {
          font-size: 22px;
          font-weight: 700;
          color: #a855f7;
          margin: 0;
        }
        .quiz-progress {
          font-size: 14px;
          color: #64748b;
          background: #1e1e2f;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid #3d3d5c;
        }
        .quiz-question {
          background: linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%);
          border: 1px solid #3d3d5c;
          border-radius: 16px;
          padding: 28px;
        }
        .question-text {
          font-size: 18px;
          color: #f1f5f9;
          font-weight: 600;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }
        .options-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .option-btn {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          background: #0a0a0f;
          border: 1px solid #3d3d5c;
          border-radius: 12px;
          color: #f1f5f9;
          font-size: 15px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
          width: 100%;
        }
        .option-btn:hover:not(:disabled) {
          border-color: #a855f7;
          background: #a855f710;
        }
        .option-btn:disabled {
          cursor: default;
        }
        .option-btn.correct {
          border-color: #22c55e;
          background: #22c55e15;
        }
        .option-btn.incorrect {
          border-color: #ef4444;
          background: #ef444415;
        }
        .option-letter {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #3d3d5c;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .option-btn.correct .option-letter {
          background: #22c55e;
          color: white;
        }
        .option-btn.incorrect .option-letter {
          background: #ef4444;
          color: white;
        }
        .option-text {
          flex: 1;
        }
        .answer-feedback {
          margin-top: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .feedback-correct {
          color: #22c55e;
          font-weight: 600;
          margin: 0;
        }
        .feedback-incorrect {
          color: #ef4444;
          font-weight: 500;
          margin: 0;
          font-size: 14px;
        }
        .next-btn {
          background: #a855f7;
          border: none;
          border-radius: 10px;
          padding: 10px 20px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .next-btn:hover {
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
