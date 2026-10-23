// App.jsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { startExam, getQuestions, submitAnswer, submitExam } from './api'
import './App.css'

const EXAM_DURATION_SECONDS = 20 * 60; // 20 minutes

// Screens: 'setup' → 'login' → 'exam' → 'results'
function App() {
  // Proctoring state
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [timer, setTimer] = useState('');

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const timerIntervalRef = useRef(null);
  const [showTimeUpOverlay, setShowTimeUpOverlay] = useState(false);

  // Exam flow state
  const [screen, setScreen] = useState('setup'); // 'setup' | 'login' | 'exam' | 'results'
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answers, setAnswers] = useState({}); // { questionId: { selected, isCorrect } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [screenshotToast, setScreenshotToast] = useState('');

  // Refs
  const videoRef = useRef(null);
  const sessionIdRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Keep sessionId ref in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Re-apply camera stream whenever screen changes and the video element remounts
  useEffect(() => {
    if (videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [screen]);

  // Check if running inside Electron
  const isElectron = typeof window !== 'undefined' && window.athena;

  // Auto-submit exam when time runs out
  const handleAutoSubmit = useCallback(async () => {
    setTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    setShowTimeUpOverlay(true);

    try {
      const res = await submitExam(currentSessionId);
      // Short delay for the user to see the "Time's Up" overlay
      setTimeout(() => {
        setShowTimeUpOverlay(false);
        setResults(res.result);
        setScreen('results');
      }, 3000);
    } catch (err) {
      // If the exam was already submitted, just show results screen
      setTimeout(() => {
        setShowTimeUpOverlay(false);
        setScreen('results');
      }, 3000);
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!timerActive) return;

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerActive, handleAutoSubmit]);

  // Format seconds into mm:ss
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Get timer status class
  function getTimerStatus() {
    if (timeLeft <= 60) return 'danger';
    if (timeLeft <= 5 * 60) return 'warning';
    return '';
  }

  // Timer ring SVG progress
  function getTimerProgress() {
    const progress = timeLeft / EXAM_DURATION_SECONDS;
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - progress);
    return { circumference, offset };
  }

  function getTimerStrokeColor() {
    if (timeLeft <= 60) return '#ef4444';
    if (timeLeft <= 5 * 60) return '#f59e0b';
    return '#6366f1';
  }

  // Screenshot capture function
  async function takeScreenshot() {
    if (isElectron && window.athena?.takeScreenshot) {
      try {
        const res = await window.athena.takeScreenshot();
        if (res && res.success) {
          setScreenshotToast(`📸 Screenshot saved: ${res.fileName || 'Success'}`);
        } else {
          setScreenshotToast(`⚠️ Failed to capture screenshot: ${res?.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error("Screenshot capture error:", err);
        setScreenshotToast('❌ Screenshot capture error');
      }
    } else {
      setScreenshotToast('ℹ️ Screenshot is active in Electron desktop mode');
    }
    setTimeout(() => setScreenshotToast(''), 3500);
  }

  useEffect(() => {
    // Expose takeScreenshot globally so it can be called from console or shortcuts
    window.takeScreenshot = takeScreenshot;

    const handleKeyDown = (e) => {
      // Hotkey: Ctrl+S or Cmd+S or PrtScn to take screenshot
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        takeScreenshot();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    if (!isElectron) {
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    // Register Listener for handling Timer Tick from Main
    const removeTimerTickListener = window.athena.registerListenerForTimerTickFromMain(setTimer);

    // Register Listener for handling Camera Snap Request from Main
    const removeCameraSnapListener = window.athena.registerListenerForCameraSnapFromMain(saveVideoScreenShots);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      removeTimerTickListener();
      removeCameraSnapListener();
    };
  }, [isElectron]);

  async function saveVideoScreenShots() {
    if (!videoRef.current || !videoRef.current.srcObject) {
      return;
    }

    try {
      const track = videoRef.current.srcObject.getVideoTracks()[0];
      if (!track) return;

      // Use ImageCapture API
      const imageCapture = new ImageCapture(track);
      const blob = await imageCapture.takePhoto();
      const arrayBuffer = await blob.arrayBuffer();

      // Send raw binary buffer to main process
      window.athena.storeCameraSnapImageOnDisk(arrayBuffer);
    } catch (error) {
      console.error("Failed to capture image via ImageCapture:", error);
    }
  }

  async function getCameraAccess() {
    try {
      const videoData = await navigator.mediaDevices.getUserMedia({
        video: true
      });

      mediaStreamRef.current = videoData;
      if (videoRef.current) {
        videoRef.current.srcObject = videoData
      }
      setCameraEnabled(true);
    } catch (error) {
      alert('Cannot access Camera');
    }
  }

  async function enableFullScreen() {
    try {
      await document.documentElement.requestFullscreen();
      setFullScreen(true);
    } catch (error) {
      alert('Cannot access full screen');
    }
  }

  // --- Exam Flow Handlers ---

  async function handleStartExam() {
    if (!studentName.trim() || !studentId.trim()) {
      setError('Please enter both your name and student ID.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Start session on backend
      const sessionRes = await startExam(studentId.trim(), studentName.trim());
      setSessionId(sessionRes.sessionId);

      // Fetch all questions
      const questionsRes = await getQuestions();
      setQuestions(questionsRes);
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswers({});

      // Reset and start the 20-minute countdown
      setTimeLeft(EXAM_DURATION_SECONDS);
      setTimerActive(true);

      // Start Electron timer if available
      if (isElectron) {
        try {
          await window.athena.startTimerOnMain();
        } catch (e) {
          // Timer might already be running
        }
      }

      setScreen('exam');
    } catch (err) {
      setError(err.message || 'Failed to start exam. Is the backend running on port 3000?');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswer() {
    if (selectedOption === null) return;

    const question = questions[currentIndex];
    setLoading(true);
    setError('');

    try {
      const res = await submitAnswer(sessionId, question.id, selectedOption);
      setAnswers(prev => ({
        ...prev,
        [question.id]: { selected: selectedOption, isCorrect: res.isCorrect }
      }));
      setSelectedOption(null);

      // Auto-advance to next question
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitExam() {
    setLoading(true);
    setError('');

    // Stop the countdown timer
    setTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      const res = await submitExam(sessionId);
      setResults(res.result);
      setScreen('results');
    } catch (err) {
      setError(err.message || 'Failed to submit exam');
    } finally {
      setLoading(false);
    }
  }

  function goToQuestion(index) {
    setCurrentIndex(index);
    setSelectedOption(null);
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  // ==================== RENDER ====================

  // --- Time Up Overlay ---
  const timeUpOverlay = showTimeUpOverlay ? (
    <div className="time-up-overlay">
      <div className="time-up-modal">
        <div className="time-up-icon">⏰</div>
        <h2>Time's Up!</h2>
        <p>Your exam has been automatically submitted.</p>
        <p>Preparing your results...</p>
      </div>
    </div>
  ) : null;

  // --- SCREEN: Setup (Camera + Fullscreen) ---
  if (screen === 'setup') {
    return (
      <>
        <div className="app-bg" />
        <div className="page-container">
          {screenshotToast && <div className="screenshot-toast">{screenshotToast}</div>}
          <div className="header-section">
            <div className="logo-icon">🛡️</div>
            <h1>Athena Exam</h1>
            <p>Configure permissions before starting your exam</p>
          </div>

          <div className="card-container">
            {/* Camera Section */}
            <div className="permission-item">
              <div className="permission-content">
                <h3>
                  <span className="step-badge">1</span>
                  Configure Camera
                </h3>
                <p>Your camera is required for proctoring during the exam.</p>
                <div className="action-row">
                  <button
                    className={`btn ${cameraEnabled ? 'btn-success' : 'btn-black'}`}
                    disabled={cameraEnabled}
                    onClick={getCameraAccess}
                  >
                    {cameraEnabled ? '✓ Camera Connected' : '📷 Get Camera Access'}
                  </button>

                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="video-preview"
                  />
                </div>
              </div>
            </div>

            <div className="divider"></div>

            {/* Fullscreen Section */}
            <div className="permission-item">
              <div className="permission-content">
                <h3>
                  <span className="step-badge">2</span>
                  Switch to Full Screen
                </h3>
                <p>Full-screen mode prevents switching to other applications.</p>
                <button
                  className={`btn ${fullScreen ? 'btn-success' : 'btn-primary'}`}
                  disabled={fullScreen}
                  onClick={enableFullScreen}
                >
                  {fullScreen ? '✓ Full Screen Enabled' : '🖥️ Enable Full Screen'}
                </button>
              </div>
            </div>
          </div>

          <div className="bottom-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={takeScreenshot}
              title="Test screenshot capture"
            >
              📸 Test Screenshot
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={!cameraEnabled || !fullScreen}
              onClick={() => setScreen('login')}
            >
              Continue to Login →
            </button>
          </div>

          {(!cameraEnabled || !fullScreen) && (
            <p className="hint-text">Please complete both steps above to continue</p>
          )}
        </div>
      </>
    );
  }

  // --- SCREEN: Login ---
  if (screen === 'login') {
    return (
      <>
        <div className="app-bg" />
        <div className="page-container">
          {screenshotToast && <div className="screenshot-toast">{screenshotToast}</div>}
          <div className="header-section">
            <div className="logo-icon">📝</div>
            <h1>Student Login</h1>
            <p>Enter your details to begin the exam</p>
          </div>

          <div className="card-container login-card">
            <div className="form-group">
              <label htmlFor="studentName">Full Name</label>
              <input
                id="studentName"
                type="text"
                placeholder="Enter your full name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="form-input"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="studentId">Student ID</label>
              <input
                id="studentId"
                type="text"
                placeholder="Enter your student ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="form-input"
                onKeyDown={(e) => e.key === 'Enter' && handleStartExam()}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={handleStartExam}
              disabled={loading}
            >
              {loading ? 'Starting Exam...' : 'Start Exam 🚀'}
            </button>
          </div>

          <button
            className="btn btn-outline"
            onClick={() => setScreen('setup')}
          >
            ← Back to Setup
          </button>
        </div>
      </>
    );
  }

  // --- SCREEN: Exam ---
  if (screen === 'exam') {
    const { circumference, offset } = getTimerProgress();
    const timerStatus = getTimerStatus();
    const strokeColor = getTimerStrokeColor();

    return (
      <>
        <div className="app-bg" />
        <div className="page-container exam-page">
          {screenshotToast && <div className="screenshot-toast">{screenshotToast}</div>}
          {timeUpOverlay}

          {/* Top Bar */}
          <div className="exam-topbar">
            <div className="exam-topbar-left">
              <span className="exam-logo">🛡️ Athena</span>
              <span className="exam-student-name">{studentName}</span>
            </div>

            <div className="exam-topbar-center">
              {/* Countdown Timer */}
              <div className={`timer-container ${timerStatus}`}>
                <svg className="timer-ring-svg" viewBox="0 0 36 36">
                  <circle
                    className="timer-ring-bg"
                    cx="18" cy="18" r="14"
                  />
                  <circle
                    className="timer-ring-progress"
                    cx="18" cy="18" r="14"
                    stroke={strokeColor}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className="timer-text">
                  <span className="timer-time">{formatTime(timeLeft)}</span>
                  <span className="timer-label">remaining</span>
                </div>
              </div>
            </div>

            <div className="exam-topbar-right">
              <button
                type="button"
                className="btn-screenshot"
                onClick={takeScreenshot}
                title="Capture Exam Screenshot (Ctrl+Shift+S / Cmd+Shift+S)"
              >
                📸 Screenshot
              </button>
              <span className="exam-progress">
                {answeredCount}/{questions.length} answered
              </span>
            </div>
          </div>

          <div className="exam-layout">
            {/* Question Navigation Sidebar */}
            <div className="question-nav">
              <h4>Questions</h4>
              <div className="question-nav-grid">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    className={`question-nav-btn ${
                      i === currentIndex ? 'active' : ''
                    } ${answers[q.id] ? (answers[q.id].isCorrect ? 'correct' : 'wrong') : ''}`}
                    onClick={() => goToQuestion(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="progress-bar-container">
                <div className="progress-bar-label">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="nav-legend">
                <span><span className="legend-dot current"></span> Current</span>
                <span><span className="legend-dot answered"></span> Answered</span>
                <span><span className="legend-dot unanswered"></span> Unanswered</span>
              </div>

              {questions.length - answeredCount > 0 && (
                <div className="unanswered-badge" style={{ marginTop: '16px', textAlign: 'center' }}>
                  {questions.length - answeredCount} remaining
                </div>
              )}
            </div>

            {/* Main Question Area */}
            <div className="question-area">
              {currentQuestion && (
                <div className="question-card" key={currentQuestion.id}>
                  <div className="question-header">
                    <span className="question-number">Question {currentIndex + 1} of {questions.length}</span>
                  </div>

                  <h2 className="question-text">{currentQuestion.question}</h2>

                  <div className="options-list">
                    {currentQuestion.options.map((option, optIndex) => {
                      const isAnswered = answers[currentQuestion.id] !== undefined;
                      const wasSelected = isAnswered && answers[currentQuestion.id].selected === optIndex;

                      return (
                        <button
                          key={optIndex}
                          className={`option-btn ${
                            selectedOption === optIndex ? 'selected' : ''
                          } ${wasSelected ? (answers[currentQuestion.id].isCorrect ? 'correct-answer' : 'wrong-answer') : ''}`}
                          onClick={() => {
                            if (!isAnswered) setSelectedOption(optIndex);
                          }}
                          disabled={isAnswered}
                        >
                          <span className="option-letter">
                            {String.fromCharCode(65 + optIndex)}
                          </span>
                          <span className="option-text">{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <div className="question-actions">
                    <button
                      className="btn btn-outline"
                      disabled={currentIndex === 0}
                      onClick={() => goToQuestion(currentIndex - 1)}
                    >
                      ← Previous
                    </button>

                    {!answers[currentQuestion.id] && (
                      <button
                        className="btn btn-primary"
                        disabled={selectedOption === null || loading}
                        onClick={handleSubmitAnswer}
                      >
                        {loading ? 'Submitting...' : 'Submit Answer'}
                      </button>
                    )}

                    {currentIndex < questions.length - 1 ? (
                      <button
                        className="btn btn-outline"
                        onClick={() => goToQuestion(currentIndex + 1)}
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        className="btn btn-submit-exam"
                        disabled={!allAnswered || loading}
                        onClick={handleSubmitExam}
                      >
                        {loading ? 'Submitting...' : '🏁 Submit Exam'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Camera feed (small overlay) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="video-preview-small"
          />
        </div>
      </>
    );
  }

  // --- SCREEN: Results ---
  if (screen === 'results') {
    const totalQuestions = questions.length || results?.attempted || 0;
    const correctCount = results?.correct || 0;
    const wrongCount = results?.wrong || 0;
    const attempted = results?.attempted || 0;
    const percentage = attempted > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const timeUsed = EXAM_DURATION_SECONDS - timeLeft;

    return (
      <>
        <div className="app-bg" />
        <div className="page-container">
          {screenshotToast && <div className="screenshot-toast">{screenshotToast}</div>}
          <div className="header-section">
            <div className="logo-icon">{percentage >= 60 ? '🎉' : '📊'}</div>
            <h1>Exam Complete!</h1>
            <p>Here are your results, {studentName}</p>
          </div>

          <div className="card-container results-card">
            <div className="results-score">
              <div className={`score-circle ${percentage >= 60 ? 'pass' : 'fail'}`}>
                <span className="score-number">{percentage}%</span>
                <span className="score-label">{percentage >= 60 ? 'PASSED' : 'NEEDS WORK'}</span>
              </div>
            </div>

            <div className="results-detail-grid">
              <div className="detail-stat-card total-card">
                <div className="detail-stat-icon">📋</div>
                <div className="stat-value">{attempted}</div>
                <div className="stat-label">Attempted</div>
              </div>
              <div className="detail-stat-card correct-card">
                <div className="detail-stat-icon">✅</div>
                <div className="stat-value" style={{ color: '#34d399' }}>{correctCount}</div>
                <div className="stat-label">Correct</div>
              </div>
              <div className="detail-stat-card wrong-card">
                <div className="detail-stat-icon">❌</div>
                <div className="stat-value" style={{ color: '#f87171' }}>{wrongCount}</div>
                <div className="stat-label">Wrong</div>
              </div>
            </div>

            <p className="time-taken">
              ⏱ Time used: {formatTime(timeUsed)} / {formatTime(EXAM_DURATION_SECONDS)}
            </p>
          </div>

          <button
            className="btn btn-outline"
            onClick={() => {
              // Reset everything for a new attempt
              setScreen('login');
              setSessionId(null);
              setQuestions([]);
              setCurrentIndex(0);
              setSelectedOption(null);
              setAnswers({});
              setResults(null);
              setError('');
              setStudentName('');
              setStudentId('');
              setTimeLeft(EXAM_DURATION_SECONDS);
              setTimerActive(false);
            }}
          >
            Take Another Exam
          </button>
        </div>
      </>
    );
  }

  return null;
}

export default App
