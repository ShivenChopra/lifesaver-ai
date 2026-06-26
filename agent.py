import os
import json
import uuid
import datetime
from typing import List, Optional
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Setup API Key
def configure_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        raise ValueError("GEMINI_API_KEY not found in environment. Please add it to your last-minute-lifesaver/.env file.")
    genai.configure(api_key=api_key)

# Raw OpenAPI Schema Dictionary for Gemini (avoids Pydantic validation issues)
GOAL_PLAN_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "tasks": {
            "type": "ARRAY",
            "description": "List of tasks to achieve the user's goal",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {
                        "type": "STRING",
                        "description": "A short, action-oriented title of the task"
                    },
                    "description": {
                        "type": "STRING",
                        "description": "A detailed description of what needs to be done and tips to avoid procrastination"
                    },
                    "duration_mins": {
                        "type": "INTEGER",
                        "description": "Estimated duration in minutes (e.g. 30, 45, 60, 90, 120)"
                    },
                    "priority": {
                        "type": "STRING",
                        "description": "Priority of the task: must be either 'high', 'medium', or 'low'"
                    },
                    "suggested_day_offset": {
                        "type": "INTEGER",
                        "description": "On which day should this be done (0 = today/tomorrow start, 1 = next day, etc.)"
                    },
                    "dependency_index": {
                        "type": "INTEGER",
                        "description": "The 0-based index of another task in this list that must be completed BEFORE starting this task. Set to -1 if there is no dependency."
                    }
                },
                "required": ["title", "description", "duration_mins", "priority", "suggested_day_offset", "dependency_index"]
            }
        }
    },
    "required": ["tasks"]
}

async def generate_plan_for_goal(goal_description: str, deadline_days: int) -> List[dict]:
    configure_gemini()
    
    # We will use gemini-2.5-flash for structured planning
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    prompt = f"""
    You are the 'Last-Minute Life Saver' productivity agent. 
    The user's primary goal is: "{goal_description}"
    They must achieve this goal within {deadline_days} days.

    Break this goal down into a logical sequence of actionable, concrete subtasks.
    For each subtask:
    1. Provide a clear, actionable title and detailed description focusing on how to prevent procrastination.
    2. Estimate a realistic duration in minutes (max 180 mins per task, keep blocks manageable, e.g. 30-90 mins).
    3. Determine the priority ('high', 'medium', 'low') based on how critical it is for the deadline.
    4. Provide a 'suggested_day_offset' (from 0 to {deadline_days - 1}) representing when the task should ideally be worked on.
    5. Set 'dependency_index' to the index of a preceding task if one exists, otherwise set it to -1.
    """

    # Query Gemini with structured JSON output configuration (using raw dict schema)
    response = model.generate_content(
        prompt,
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": GOAL_PLAN_SCHEMA,
            "temperature": 0.2
        }
    )

    try:
        raw_json = json.loads(response.text)
        tasks_list = raw_json.get("tasks", [])
    except Exception as e:
        print(f"Failed to parse Gemini JSON: {e}")
        print("Raw response:", response.text)
        return []

    # Post-process tasks to assign UUIDs, map dependencies, and schedule time slots
    processed_tasks = []
    
    # 1. First generate UUIDs for all tasks
    task_ids = [str(uuid.uuid4()) for _ in range(len(tasks_list))]
    
    for i, t in enumerate(tasks_list):
        # Resolve dependencies
        dep_id_list = []
        dep_idx = t.get("dependency_index", -1)
        if dep_idx is not None and dep_idx != -1 and 0 <= dep_idx < len(tasks_list) and dep_idx != i:
            dep_id_list.append(task_ids[dep_idx])
            
        processed_tasks.append({
            "id": task_ids[i],
            "title": t.get("title", "Untitled Task"),
            "description": t.get("description", ""),
            "duration_mins": t.get("duration_mins", 45),
            "priority": t.get("priority", "medium"),
            "due_date": "", # Filled during scheduling
            "dependencies": dep_id_list,
            "completed": False,
            "scheduled_time": "", # Filled during scheduling
            "suggested_day_offset": t.get("suggested_day_offset", 0)
        })

    # 2. Scheduling Logic: Time-aware topological sorting & time blocking
    now = datetime.datetime.now()
    start_date = datetime.date.today()
    
    # Day-wise buckets
    day_schedules = {}
    for task in processed_tasks:
        offset = min(task["suggested_day_offset"], deadline_days - 1)
        if offset not in day_schedules:
            day_schedules[offset] = []
        day_schedules[offset].append(task)
    
    overflow_tasks = []  # Tasks that couldn't fit in a day
        
    for offset in sorted(day_schedules.keys()):
        day_tasks = day_schedules[offset] + overflow_tasks
        overflow_tasks = []
        
        current_day = start_date + datetime.timedelta(days=offset)
        task_date_str = current_day.strftime("%Y-%m-%d")
        
        # If scheduling for today, start from the next available 30-min slot
        if offset == 0:
            # Round up to next 30-min boundary, add 15 min buffer
            minutes_past = now.minute
            if minutes_past <= 30:
                next_slot = now.replace(minute=30, second=0, microsecond=0)
            else:
                next_slot = (now + datetime.timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
            # Add a small buffer so user has time to see the plan
            next_slot += datetime.timedelta(minutes=15)
            current_time = max(
                next_slot,
                datetime.datetime.combine(current_day, datetime.time(9, 0))
            )
        else:
            current_time = datetime.datetime.combine(current_day, datetime.time(9, 0))
        
        # Sort day tasks by dependency: tasks with dependencies go later
        day_tasks.sort(key=lambda x: len(x["dependencies"]))
        
        for task in day_tasks:
            # If we go past 9 PM, push remaining tasks to the next day
            if current_time.time() > datetime.time(21, 0):
                overflow_tasks.append(task)
                continue
                
            task["due_date"] = task_date_str
            task["scheduled_time"] = current_time.strftime("%I:%M %p")
            
            # Increment current time by duration + 15 mins break
            duration = task["duration_mins"]
            current_time += datetime.timedelta(minutes=duration + 15)
    
    # Handle any remaining overflow tasks — assign to the last possible day
    if overflow_tasks:
        last_day = start_date + datetime.timedelta(days=deadline_days - 1)
        last_date_str = last_day.strftime("%Y-%m-%d")
        current_time = datetime.datetime.combine(last_day, datetime.time(9, 0))
        for task in overflow_tasks:
            task["due_date"] = last_date_str
            task["scheduled_time"] = current_time.strftime("%I:%M %p")
            current_time += datetime.timedelta(minutes=task["duration_mins"] + 15)

    return processed_tasks

async def get_chat_response(user_message: str, history: List[dict]) -> str:
    configure_gemini()
    
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    system_instruction = """
    You are the 'Last-Minute Life Saver' (LMLS), a friendly, supportive, and action-oriented AI productivity companion.
    Your main characteristics:
    - Highly encouraging and motivating. You hate procrastination and understand how overwhelming tasks can feel.
    - Pragmatic: you don't just say 'keep going', you give specific, small steps to get started (e.g. "Do 10 minutes of reading right now").
    - Actionable: you help break down large tasks into smaller ones.
    
    Format of response:
    - Keep it under 3-4 paragraphs.
    - Use bullet points for steps.
    - Maintain a supportive, energetic, and slightly witty tone.
    """
    
    # Format history for Gemini chat API
    chat_prompt = f"{system_instruction}\n\nChat History:\n"
    for msg in history[-10:]:
        role = "User" if msg["sender"] == "user" else "Companion"
        chat_prompt += f"{role}: {msg['text']}\n"
    
    chat_prompt += f"User: {user_message}\nCompanion:"
    
    response = model.generate_content(chat_prompt)
    return response.text.strip()
