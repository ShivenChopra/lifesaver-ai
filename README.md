# The Last-Minute Life Saver

An AI-powered autonomous productivity companion designed to proactively assist users in planning, prioritizing, and scheduling complex goals before deadlines are missed.

This project is built as part of the **Vibe2Ship Hackathon** submission under **Problem Statement 1 - The Last-Minute Life Saver**.

---

## Technical Stack & Architecture

- **Backend**: Python FastAPI - Serving API routes and handling static web files.
- **AI Core**: Google Gemini 1.5 Flash (via `google-generativeai` SDK) - Performs structured JSON deconstruction and processes natural language companion chat.
- **Frontend**: Single-Page App (SPA) styled with custom glassmorphic CSS animations and responsive Tailwind CSS.
- **Database**: Local JSON storage (`tasks_db.json`) for data persistence.

### Agentic Intelligence Features

1. **Structured Goal Breakdown**: Takes a high-level goal and maps it into a series of prioritized subtasks with estimated durations and dependencies.
2. **Topological Scheduling**: Sorting tasks algorithmically based on task dependencies (prerequisites) so you never schedule step B before step A is completed.
3. **Conversational Support**: Chat interface with a companion engineered to motivate, defeat procrastination, and suggest quick 5-minute action loops.

---

## Getting Started (Local Setup)

### Prerequisites

You need **Python 3** installed on your system.

### Running the Application

1. **Get your Gemini API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/) and copy your API key.
2. **Add Key to `.env`**:
   - Open the `.env` file in the project folder.
   - Replace `YOUR_GEMINI_API_KEY_HERE` with your actual key:
     ```env
     GEMINI_API_KEY=AIzaSy...
     ```
3. **Launch the Server**:
   - On Windows, simply double-click the **`run.bat`** file.
   - Alternatively, open terminal/PowerShell in this directory and run:
     ```bash
     pip install -r requirements.txt
     python main.py
     ```
4. **Access the Dashboard**:
   - Open your browser and go to: `http://127.0.0.1:8000`

---

## Google Cloud Deployment Guide

The hackathon requires deploying your application publicly on **Google Cloud**. Here is the recommended step-by-step approach using **Google Cloud Run**.

### Option A: Google Cloud Run (Containerized - Recommended)

Google Cloud Run automatically builds your container, hosts it, and scales to zero when not in use (costs nothing for low usage).

#### Step 1: Install Google Cloud CLI
Download and install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).

#### Step 2: Initialize & Authenticate
Open terminal/PowerShell and run:
```bash
gcloud init
gcloud auth login
```
This logs you into your Google Account and asks you to select or create a Google Cloud Project.

#### Step 3: Deploy to Cloud Run
Run the following single command from the project root directory:
```bash
gcloud run deploy last-minute-lifesaver --source . --allow-unauthenticated
```
*   **What this does**: It uploads your code, builds the container image using the included `Dockerfile` on Cloud Build, and deploys it to a serverless container instance.
*   **Gemini API Key Setup**: During or after deployment, you can configure your `GEMINI_API_KEY` env variable inside the Google Cloud Console (under Cloud Run -> Edit & Deploy New Revision -> Variables).

Once successful, Google Cloud will output a public service URL (e.g., `https://last-minute-lifesaver-xxxx.a.run.app`). This is your submission link!

---

### Option B: Google App Engine (Standard Python)

If you do not want to use containers, you can use App Engine.

1. Create a file named `app.yaml` in this directory:
   ```yaml
   runtime: python313
   entrypoint: uvicorn main:app --host 0.0.0.0 --port $PORT
   
   env_variables:
     GEMINI_API_KEY: "YOUR_GEMINI_API_KEY"
   ```
2. Deploy using the CLI:
   ```bash
   gcloud app deploy
   ```
