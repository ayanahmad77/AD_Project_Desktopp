// App.jsx
import { useEffect, useRef, useState } from 'react'
import { startExam, getQuestions, submitAnswer, submitExam } from './api'
import './App.css'

// Screens: 'setup' → 'login' → 'exam' → 'results'
function App() {
  // Proctoring state
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [timer, setTimer] = useState('');

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

  // Check if running inside Electron
  const isElectron = typeof window !== 'undefined' && window.athena;

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

  // ==================== RENDER ====================

  // --- SCREEN: Setup (Camera + Fullscreen) ---
  if (screen === 'setup') {
    return (
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
    );
  }

  // --- SCREEN: Login ---
  if (screen === 'login') {
    return (
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
    );
  }

  // --- SCREEN: Exam ---
  if (screen === 'exam') {
    return (
      <div className="page-container exam-page">
        {screenshotToast && <div className="screenshot-toast">{screenshotToast}</div>}
        {/* Top Bar */}
        <div className="exam-topbar">
          <div className="exam-topbar-left">
            <span className="exam-logo">🛡️ Athena</span>
            <span className="exam-student-name">{studentName}</span>
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
            {timer && <span className="exam-timer">⏱ {Math.floor(timer)}s</span>}
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

            <div className="nav-legend">
              <span><span className="legend-dot current"></span> Current</span>
              <span><span className="legend-dot answered"></span> Answered</span>
              <span><span className="legend-dot unanswered"></span> Unanswered</span>
            </div>
          </div>

          {/* Main Question Area */}
          <div className="question-area">
            {currentQuestion && (
              <div className="question-card">
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
    );
  }

  // --- SCREEN: Results ---
  if (screen === 'results') {
    const percentage = results ? Math.round((results.correct / results.attempted) * 100) : 0;

    return (
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

          <div className="results-stats">
            <div className="stat-item">
              <span className="stat-value">{results?.attempted || 0}</span>
              <span className="stat-label">Attempted</span>
            </div>
            <div className="stat-item stat-correct">
              <span className="stat-value">{results?.correct || 0}</span>
              <span className="stat-label">Correct</span>
            </div>
            <div className="stat-item stat-wrong">
              <span className="stat-value">{results?.wrong || 0}</span>
              <span className="stat-label">Wrong</span>
            </div>
          </div>

          {timer && <p className="time-taken">Time elapsed: {Math.floor(timer)} seconds</p>}
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
          }}
        >
          Take Another Exam
        </button>
      </div>
    );
  }

  return null;
}

export default App
