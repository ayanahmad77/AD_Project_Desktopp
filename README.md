# Athena — Desktop Examination System

Athena is a desktop-based examination application developed as part of the Application Development (AD) project. It combines Electron, React, and Node.js with an Express backend to provide a desktop environment for conducting multiple-choice examinations and managing exam sessions.

## Features

- **Desktop Application:** Built with Electron to run the examination interface in a desktop window.
- **React Frontend:** Provides the user interface using React and Vite.
- **MCQ Examination:** Retrieves questions and options from the backend without exposing correct answers to the student-facing question endpoint.
- **Exam Session Management:** Creates and tracks individual examination sessions.
- **Answer Evaluation:** Records submitted answers and maintains attempted, correct, and incorrect answer counts.
- **Exam Timer:** Tracks elapsed examination time.
- **Camera Snapshots:** Triggers camera-capture requests at regular intervals.
- **Automatic Screenshots:** Captures the examination window periodically and saves screenshots locally.
- **Manual Screenshots:** Supports capturing and saving screenshots on request.
- **Exam Rules Dialog:** Displays examination guidelines through native Electron dialogs.
- **REST API:** Uses Express to communicate between the frontend and backend.
- **Local JSON Storage:** Stores examination questions and session information in JSON files.

## Tech Stack

| Technology | Purpose |
|---|---|
| Electron | Desktop application and native operating-system integration |
| React | User interface |
| Vite | Frontend development server and build tool |
| Node.js | JavaScript runtime for the backend |
| Express.js | REST API and examination logic |
| HTML and CSS | Frontend structure and styling |
| JSON | Local storage of questions and examination sessions |
| Electron IPC | Communication between the desktop application and frontend |

## Project Structure

```text
AD_Project_Desktopp/
├── backend/
│   ├── data/
│   │   ├── questions.json
│   │   └── sessions.json
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── app.js
│   │   └── preload.js
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── package.json
├── package-lock.json
└── .gitignore
```

*Note: The structure above highlights the main project files. Some folders or files may vary as the project evolves.*

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js and npm
- Git
- A supported desktop operating system for Electron

### 1. Clone the Repository

```bash
git clone https://github.com/ayanahmad77/AD_Project_Desktopp.git
cd AD_Project_Desktopp
```

### 2. Install Dependencies

From the project root, run:

```bash
npm install
```

The root project's `postinstall` script installs the frontend and backend dependencies as well.

### 3. Start the Frontend and Backend

Run the following command from the project root:

```bash
npm run dev
```

This starts the Express backend and Vite frontend together.

The backend runs at:

```text
http://localhost:3000
```

The Vite development server runs at:

```text
http://localhost:5173
```

### 4. Launch the Desktop Application

Keep the development servers running. Open a second terminal in the project root and execute:

```bash
npm run electron
```

Electron opens the desktop examination application and loads the frontend from the Vite development server.

## Backend API Endpoints

The Express backend exposes the following examination endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Checks whether the backend is running |
| POST | `/exam/start` | Creates a new examination session |
| GET | `/exam/mcq` | Retrieves all questions without correct answers |
| GET | `/exam/mcq/:id` | Retrieves a specific question |
| POST | `/exam/answer` | Records and evaluates an answer |
| GET | `/exam/session/:sessionId` | Retrieves examination session details |
| POST | `/exam/submit` | Submits an examination session |

### Example: Start an Exam

**Request**

```http
POST /exam/start
Content-Type: application/json
```

```json
{
  "userId": "student01",
  "name": "Student"
}
```

The response includes a generated session ID that can be used for subsequent examination operations.

### Example: Submit an Answer

**Request**

```http
POST /exam/answer
Content-Type: application/json
```

```json
{
  "sessionId": "session-123456789",
  "questionId": 1,
  "selectedAnswer": 2
}
```

The backend validates the request, evaluates the selected answer, and updates the session's examination statistics.

*The session ID and question ID above are illustrative examples.*

## How It Works

1. The Electron application opens the React-based examination interface.
2. The frontend communicates with the Express backend to retrieve questions.
3. The backend creates a session when an examination starts.
4. Submitted answers are evaluated and recorded against the session.
5. The application tracks examination progress and elapsed time.
6. Camera-capture requests and screenshot operations support examination monitoring.
7. The student submits the examination, and the backend returns the recorded result summary.

## Data Storage

Athena currently uses local JSON files for its examination data:

- `backend/data/questions.json` — examination questions, options, and correct answers.
- `backend/data/sessions.json` — examination sessions, submitted answers, timestamps, and results.

This approach keeps the project straightforward to run without configuring a separate database.

## Development Commands

Run these commands from the project root unless stated otherwise.

| Command | Purpose |
|---|---|
| `npm install` | Installs project dependencies |
| `npm run dev` | Starts the frontend and backend together |
| `npm run build` | Builds the frontend using Vite |
| `npm run electron` | Launches the Electron application |
| `cd backend && npm start` | Starts only the backend |
| `cd frontend && npm run lint` | Runs frontend linting |

## Privacy and Security Considerations

The application includes camera-capture and screenshot functionality. These features can collect images of the user or examination screen, so their operation and storage should be clearly communicated to users.

For real-world or institutional use, additional safeguards should be considered, including:

- Obtaining appropriate consent for camera and screenshot capture.
- Restricting access to stored images and session records.
- Protecting student information and examination results.
- Validating API requests and preventing unauthorized session access.
- Reviewing Electron security settings before distributing the application.

## Future Improvements

Potential improvements include:

- Adding authentication and role-based access for students and administrators.
- Introducing a database for persistent examination records.
- Implementing configurable exam durations and automatic submission.
- Adding an administrator dashboard for managing questions and results.
- Improving error handling, input validation, and automated testing.
- Packaging the application for straightforward installation on supported operating systems.

## Learning Outcomes

This project demonstrates practical use of desktop application development concepts, including:

- Electron's main process and native APIs.
- React component-based UI development.
- Node.js and Express REST API development.
- Communication between frontend and backend.
- Inter-process communication in desktop applications.
- File-system operations and JSON-based persistence.
- Timers, screenshot capture, and camera-related workflows.

## Author

**Ayan Ahmad**

GitHub: [@ayanahmad77](https://github.com/ayanahmad77)

Project Repository: [AD_Project_Desktopp](https://github.com/ayanahmad77/AD_Project_Desktopp)

---

Developed as an Application Development project.
