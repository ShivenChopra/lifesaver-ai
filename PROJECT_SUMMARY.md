# 🌌 Project Summary: LifeSaver AI

**Submission for Vibe2Ship Hackathon**  
*Problem Statement 1: The Last-Minute Life Saver*

---

## 🎯 1. Problem Statement Selected

### **The Procrastination & Cognitive Overload Crisis**
Many students and professionals experience "analysis paralysis" or severe procrastination when faced with large, complex goals (e.g., *"Prepare for final exams"* or *"Build a hackathon submission"*). 
* **Overwhelming Complexity**: Vague goals lack immediate, actionable starting steps.
* **Lack of Dependency Mapping**: Users often struggle to order tasks logically, scheduling step B before completing step A.
* **Underestimation of Time**: Without structured scheduling, deadlines are missed due to poor time blocking.
* **Lack of Accountability**: Static todo lists do not motivate or offer contextual help when users get stuck.

---

## 💡 2. Solution Overview

**LifeSaver AI** is an autonomous, AI-driven productivity companion designed to turn high-level, overwhelming goals into a structured, step-by-step roadmap and timeline. 

By inputting a goal and a deadline, the app's agentic core immediately breaks down the objective, calculates optimal time blocks, establishes logical prerequisites (dependencies), and renders a beautiful, interactive schedule. 

An embedded **AI Productivity Companion** serves as an active assistant, helping defeat procrastination, explaining academic concepts, and suggesting quick 5-minute action loops to build momentum.

---

## ✨ 3. Key Features

* **🧠 AI Goal Deconstruction**: Instantly breaks down large, abstract goals into clear, actionable, and atomic tasks with estimated completion times.
* **⛓️ Topological Dependency Mapping**: Logically links tasks. For example, it ensures you are scheduled to *"Setup environment"* before *"Write database queries"*.
* **📅 Dynamic Visual Timeline**: Groups tasks by days, shows duration details, and maps them onto a sleek, responsive calendar view.
* **🤖 Interactive Chat Companion**: A conversational chatbot that acts as a study partner, helps explain task details, and provides quick, actionable guidance.
* **🔄 Hybrid Storage Layer**: Stores data securely in the cloud using a free MongoDB Atlas tier, with a seamless automatic local JSON file fallback (`tasks_db.json`) for offline usage.
* **📱 Premium Dark Mode UI**: A stunning visual interface designed with glassmorphism, glowing priority elements, ambient animated backgrounds, and micro-animations.

---

## 🛠️ 4. Technologies Used

* **Frontend**:
  - **HTML5 & Vanilla CSS3**: Crafted with rich custom CSS tokens, modern typography, glassmorphism, responsive grids, and subtle color-matched glows.
  - **Vanilla JavaScript**: Handles real-time client-side rendering, states, calendar mapping, and smooth transitions.
* **Backend**:
  - **Python (FastAPI)**: Ultra-fast asynchronous REST API framework serving backend endpoints and static files.
  - **Uvicorn**: Asynchronous ASGI web server for production-ready performance.
* **Database & Persistence**:
  - **MongoDB Atlas**: Cloud-hosted NoSQL database for multi-device sync.
  - **PyMongo**: Official Python driver for MongoDB connection.
  - **Local JSON (`tasks_db.json`)**: Automatic local filesystem fallback.
* **Deployment & Containerization**:
  - **Docker**: For containerizing the application.
  - **Git & GitHub**: Version control and continuous deployment pipeline.

---

## ☁️ 5. Google Technologies Utilized

* **🧠 Google Gemini API (via `google-generativeai` SDK)**:
  - **Gemini 1.5 Flash**: Powers the core agentic planning engine. It generates structured task JSON structures, maps topological dependencies, and provides fast, conversational responses in the companion chat interface.
* **☁️ Google Cloud Platform (GCP)**:
  - **Google Cloud Run**: Containerized serverless deployment hosting the FastAPI app with auto-scaling to zero (fully free for hackathon usage).
  - **Google Cloud Build**: Automates building the Docker image directly from source files on Google's infrastructure.
* **🎨 Google Fonts**:
  - **Inter**: Clean, readable typography used throughout the dashboard interface.
  - **JetBrains Mono**: Used for visual labels, code details, and tech chips to give a premium developer feel.
