import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"Loaded API Key starting with: {api_key[:10] if api_key else 'None'}... (length: {len(api_key) if api_key else 0})")

if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
    print("Error: Please set GEMINI_API_KEY in your .env file.")
    exit(1)

genai.configure(api_key=api_key)

try:
    print("\nAttempting to list available models...")
    models = genai.list_models()
    model_names = [m.name for m in models]
    print(f"Success! Found {len(model_names)} models:")
    for name in model_names:
        print(f" - {name}")
except Exception as e:
    print("\nError occurred while listing models:")
    print(e)
