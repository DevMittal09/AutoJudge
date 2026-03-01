# Autojudge

A containerized, Kubernetes-powered code execution and grading platform for educational environments. Students solve coding problems in a browser-based IDE; professors create labs, upload test cases, and track student progress.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Build the Docker Image](#1-build-the-docker-image)
  - [2. Start the Backend](#2-start-the-backend)
  - [3. Start the Frontend](#3-start-the-frontend)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Students](#students)
  - [Professors](#professors)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Security Notes](#security-notes)

---

## Overview

Autojudge is built around a simple idea: students shouldn't need to install anything to practice coding. Code is written in the browser, submitted to a FastAPI backend, executed inside an isolated Kubernetes Pod, and graded automatically against hidden test cases. Results are stored in Supabase and surfaced through a real-time dashboard.

---

## Features

| Feature | Details |
|---|---|
| Browser-based IDE | Monaco Editor with Python & C++ syntax highlighting |
| Isolated code execution | Each submission runs in a fresh Kubernetes Pod |
| Automated grading | Compares output against expected results, ignoring whitespace |
| Custom input testing | Run code with arbitrary input before submitting |
| Progress tracking | Per-student, per-question status and scoring |
| Professor dashboard | Create labs, add questions, upload test cases, view analytics |
| Role-based access | Separate student and professor views |
| Auth | Email/password + Google OAuth via Supabase |
| Auto-save drafts | Code persisted in localStorage per student/question |
| Markdown problem descriptions | Rendered with GFM support |

---

## Architecture

```
Browser (Next.js)
      │
      │  POST /submit  or  POST /run
      ▼
FastAPI (main.py)
      │
      │  Creates Kubernetes Job with base64-encoded code & test cases
      ▼
Kubernetes Pod  (coderunner:latest image)
      │
      │  runner.sh: decode → compile → execute → compare → JSON output
      ▼
FastAPI polls Pod logs → parses results → saves to Supabase
      │
      ▼
Response returned to Browser
```

**Submission flow in detail:**

1. Frontend sends `{ student_id, question_id, language, code }` to `POST /submit`.
2. FastAPI fetches test cases from Supabase, base64-encodes code + inputs + expected outputs.
3. A Kubernetes Job is created with `coderunner:latest` and the encoded data as environment variables.
4. `runner.sh` inside the container decodes the data, compiles (C++) or skips (Python), then runs each test case with a 2-second timeout.
5. Results are emitted as a JSON array wrapped between `###JSON_START###` and `###JSON_END###` markers.
6. FastAPI polls the Pod logs (up to 25 retries), parses the JSON, stores results in Supabase, and returns the score to the frontend.

---

## Tech Stack

### Backend
- **FastAPI** — REST API
- **Kubernetes Python client** — Job/Pod management
- **Docker / Ubuntu 22.04** — Sandboxed execution environment
- **Supabase (Python client)** — Database & storage

### Frontend
- **Next.js 14** (App Router) — React framework
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **Monaco Editor** — Code editing
- **Supabase JS** — Auth & database client
- **react-markdown / @uiw/react-md-editor** — Markdown rendering

### Infrastructure
- **Kubernetes** — Container orchestration (Minikube supported for local dev)
- **Docker** — Container image for the code runner
- **Supabase** — PostgreSQL database, authentication, and file storage

---

## Project Structure

```
OELP_TEST/
├── main.py                   # FastAPI backend — submission & execution endpoints
├── runner.sh                 # Bash script executed inside each container
├── Dockerfile                # Container image (Ubuntu 22.04 + Python3 + g++)
├── testcases/                # Sample test case files
│   └── problem1/
│       ├── inputs.txt
│       └── outputs.txt
└── oelp-frontend/            # Next.js 14 frontend
    ├── app/
    │   ├── login/            # Login page
    │   ├── signup/           # Registration page
    │   ├── auth/callback/    # OAuth callback handler
    │   ├── problems/         # Student-facing pages
    │   │   ├── page.tsx      # Lab listing dashboard
    │   │   ├── [labId]/      # Lab overview
    │   │   └── [labId]/[questionId]/  # Code editor + submission
    │   └── admin/            # Professor-facing pages
    │       ├── upload/       # Lab management
    │       ├── labs/[labId]/ # Question management
    │       └── Analytics/    # Student performance analytics
    └── utils/supabase/       # Supabase client helpers
```

---

## Getting Started

### Prerequisites

- Docker
- A running Kubernetes cluster — [Minikube](https://minikube.sigs.k8s.io/) works for local development
- `kubectl` configured to target your cluster
- Python 3.8+
- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema described below

---

### 1. Build the Docker Image

```bash
# Build the code runner image
docker build -t coderunner:latest .

# If using Minikube, load the image into its registry
minikube image load coderunner:latest
```

---

### 2. Start the Backend

```bash
# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn kubernetes supabase python-dotenv

# Copy and configure your environment file
cp .env.example .env   # then fill in your Supabase credentials

# Start the API server
uvicorn main:app --host 127.0.0.1 --port 8000
```

The API will be available at `http://localhost:8000`.

---

### 3. Start the Frontend

```bash
cd oelp-frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser.

For a production build:

```bash
npm run build
npm start
```

---

## Environment Variables

Create a `.env` file in the project root (for the backend) and in `oelp-frontend/` (for the frontend).

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

> **Never commit real credentials.** Add `.env` to `.gitignore`.

---

## Usage

### Students

1. Sign up or log in at `/login`.
2. Browse available labs on the `/problems` dashboard.
3. Select a lab, then choose a question.
4. Write your solution in the Monaco editor.
   - **Run Code** tests your code with custom input.
   - **Submit Solution** runs your code against all (including hidden) test cases and records your score.
5. Results show test-case status, execution time, and expected vs. actual output.
6. Your code is automatically saved in the browser — it will be restored if you navigate away and return.

### Professors

1. Sign up or log in — your account will have the `professor` role.
2. Go to `/admin/upload` to create a new lab section.
3. Add questions with titles, descriptions (Markdown supported), difficulty, and point values.
4. Upload input/output file pairs for each question's test cases. Mark test cases as hidden to prevent students from seeing expected output.
5. View student analytics at `/admin/Analytics` — track submissions, scores, and progress per lab.

---

## API Reference

### `POST /submit`

Runs a student's code against all test cases for a question and records the result.

**Request body:**
```json
{
  "student_id": "uuid",
  "question_id": "uuid",
  "language": "python" | "cpp",
  "code": "print('hello')"
}
```

**Response:**
```json
{
  "status": "success",
  "score": 3,
  "max_score": 5,
  "results": [
    {
      "test_case_id": "uuid",
      "status": "Passed",
      "execution_time": "0.05s",
      "student_output": "hello",
      "expected_output": "hello",
      "is_hidden": false
    }
  ]
}
```

---

### `POST /run`

Executes code once with custom input. Used for interactive testing before submission.

**Request body:**
```json
{
  "language": "python" | "cpp",
  "code": "print(input())",
  "custom_input": "world"
}
```

**Response:**
```json
{
  "status": "success",
  "output": "world",
  "time": "0.03s",
  "error": null
}
```

---

## Database Schema

| Table | Key Columns |
|---|---|
| `profiles` | `id` (user id), `role` (`student` \| `professor`) |
| `lab_sections` | `id`, `title`, `description`, `professor_id` |
| `questions` | `id`, `lab_id`, `title`, `description`, `difficulty`, `points` |
| `test_cases` | `id`, `question_id`, `input_file_path`, `output_file_path`, `is_hidden` |
| `submissions` | `id`, `student_id`, `question_id`, `code`, `language`, `status`, `total_score`, `max_score`, `submitted_at` |
| `test_case_results` | `submission_id`, `test_case_id`, `status`, `execution_time`, `student_output`, `expected_output`, `points_earned` |
| `student_progress` | `student_id`, `question_id`, `status` (`Not Started` \| `In Progress` \| `Completed`), `last_accessed` |

Test case input/output files are stored in a Supabase Storage bucket named `lab-files`.

---

## Security Notes

- **Sandboxed execution:** Each submission runs as a non-root user inside an ephemeral Kubernetes Pod with a 2-second timeout, 500m CPU, and 256Mi memory limit.
- **Base64 transport:** Code and test case data are base64-encoded when passed between the API and the container to prevent shell injection.
- **Environment secrets:** Supabase keys are loaded from environment variables — never hard-code them in source files.
- **CORS:** The backend currently allows all origins (`*`). Restrict this to your frontend's domain in production.
- **RLS:** Configure Supabase Row-Level Security policies so students can only access their own submissions and professors can only manage their own labs.
