import os
import json
import uuid
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load env file
load_dotenv()

app = FastAPI(title="The Last-Minute Life Saver API")

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File-based database setup
DB_FILE = os.getenv("DB_FILE", "tasks_db.json")

def get_db():
    if not os.path.exists(DB_FILE):
        # Default starting data
        initial_data = {
            "tasks": [],
            "chat_history": []
        }
        with open(DB_FILE, "w") as f:
            json.dump(initial_data, f, indent=4)
        return initial_data
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {"tasks": [], "chat_history": []}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# Data structures
class TaskItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    duration_mins: int = 30
    priority: str = "medium"  # high, medium, low
    due_date: str = ""       # e.g. YYYY-MM-DD
    dependencies: List[str] = Field(default_factory=list) # IDs of parent tasks
    completed: bool = False
    scheduled_time: str = "" # formatted string or ISO

class ChatMessage(BaseModel):
    sender: str # "user" or "companion"
    text: str
    timestamp: str

class PlanGoalRequest(BaseModel):
    goal: str
    deadline_days: int = 3

# Lazy load the agent module to prevent startup crash if API key is missing
def get_agent():
    import agent
    return agent

@app.get("/api/status")
def get_api_status():
    api_key = os.getenv("GEMINI_API_KEY")
    is_set = api_key is not None and api_key != "YOUR_GEMINI_API_KEY_HERE" and len(api_key.strip()) > 0
    return {"configured": is_set}

@app.get("/api/tasks", response_model=List[TaskItem])
def get_tasks():
    db = get_db()
    return db["tasks"]

@app.post("/api/tasks", response_model=TaskItem)
def create_task(task: TaskItem):
    db = get_db()
    # Check duplicate or force uuid
    task_dict = task.model_dump()
    db["tasks"].append(task_dict)
    save_db(db)
    return task_dict

@app.put("/api/tasks/{task_id}", response_model=TaskItem)
def update_task(task_id: str, updated_task: TaskItem):
    db = get_db()
    for index, task in enumerate(db["tasks"]):
        if task["id"] == task_id:
            db["tasks"][index] = updated_task.model_dump()
            save_db(db)
            return db["tasks"][index]
    raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    db = get_db()
    initial_length = len(db["tasks"])
    db["tasks"] = [t for t in db["tasks"] if t["id"] != task_id]
    if len(db["tasks"]) == initial_length:
        raise HTTPException(status_code=404, detail="Task not found")
    save_db(db)
    return {"message": "Task deleted successfully"}

@app.post("/api/plan-goal")
async def plan_goal(req: PlanGoalRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is missing. Please add it to your last-minute-lifesaver/.env file."
        )
    
    try:
        ai_agent = get_agent()
        # Generate the subtasks list from Gemini
        generated_tasks = await ai_agent.generate_plan_for_goal(req.goal, req.deadline_days)
        
        db = get_db()
        # Merge or clear-and-set tasks? Let's append them for now.
        # But to prevent duplicate schedules, let's clear unscheduled goals or just append.
        # Let's append with new unique IDs to avoid overlaps.
        for t in generated_tasks:
            db["tasks"].append(t)
        
        save_db(db)
        return {"message": "Goal planned successfully", "new_tasks": generated_tasks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/history")
def get_chat_history():
    db = get_db()
    return db.get("chat_history", [])

@app.post("/api/chat")
async def chat_with_agent(message: str = Body(..., embed=True)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is missing. Please add it to your last-minute-lifesaver/.env file."
        )
    
    try:
        db = get_db()
        history = db.get("chat_history", [])
        
        ai_agent = get_agent()
        response_text = await ai_agent.get_chat_response(message, history)
        
        # Save history
        import datetime
        timestamp = datetime.datetime.now().isoformat()
        
        history.append({"sender": "user", "text": message, "timestamp": timestamp})
        history.append({"sender": "companion", "text": response_text, "timestamp": timestamp})
        db["chat_history"] = history
        save_db(db)
        
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clear-all")
def clear_all():
    db = get_db()
    db["tasks"] = []
    db["chat_history"] = []
    save_db(db)
    return {"message": "Database cleared successfully"}

# Serve frontend static files
# Place standard files in 'static' folder
# Root '/' serves index.html
@app.get("/")
def read_root():
    return FileResponse("static/index.html")

# Create static folder before mounting to prevent startup error
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    # Always bind to 0.0.0.0 so cloud platforms can route traffic in
    # reload=True only when running locally (detected by PORT not being set)
    is_local = os.getenv("PORT") is None
    print(f"Starting LifeSaver AI on http://0.0.0.0:{port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=is_local)

