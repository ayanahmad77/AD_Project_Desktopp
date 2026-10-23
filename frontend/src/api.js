// api.js — Centralized API service for the Athena Exam Backend
const BASE_URL = 'http://localhost:3000';

/**
 * Start a new exam session
 * @param {string} userId 
 * @param {string} name 
 * @returns {Promise<{message: string, sessionId: string}>}
 */
export async function startExam(userId, name) {
  const res = await fetch(`${BASE_URL}/exam/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, name }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to start exam');
  }

  return res.json();
}

/**
 * Get all MCQ questions (without correct answers)
 * @returns {Promise<Array<{id: number, question: string, options: string[]}>>}
 */
export async function getQuestions() {
  const res = await fetch(`${BASE_URL}/exam/mcq`);

  if (!res.ok) {
    throw new Error('Failed to fetch questions');
  }

  return res.json();
}

/**
 * Get a single MCQ question by ID
 * @param {number} id 
 * @returns {Promise<{id: number, question: string, options: string[]}>}
 */
export async function getQuestion(id) {
  const res = await fetch(`${BASE_URL}/exam/mcq/${id}`);

  if (!res.ok) {
    throw new Error('Failed to fetch question');
  }

  return res.json();
}

/**
 * Submit an answer for a question
 * @param {string} sessionId 
 * @param {number} questionId 
 * @param {number} selectedAnswer - index of the selected option
 * @returns {Promise<{message: string, isCorrect: boolean, attempted: number, correct: number, wrong: number}>}
 */
export async function submitAnswer(sessionId, questionId, selectedAnswer) {
  const res = await fetch(`${BASE_URL}/exam/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, questionId, selectedAnswer }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to submit answer');
  }

  return res.json();
}

/**
 * Get session progress
 * @param {string} sessionId 
 * @returns {Promise<Object>}
 */
export async function getSession(sessionId) {
  const res = await fetch(`${BASE_URL}/exam/session/${sessionId}`);

  if (!res.ok) {
    throw new Error('Failed to fetch session');
  }

  return res.json();
}

/**
 * Submit the entire exam
 * @param {string} sessionId 
 * @returns {Promise<{message: string, result: {attempted: number, correct: number, wrong: number}}>}
 */
export async function submitExam(sessionId) {
  const res = await fetch(`${BASE_URL}/exam/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to submit exam');
  }

  return res.json();
}
