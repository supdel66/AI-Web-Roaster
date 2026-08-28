from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import sys

# Import HuggingFace Qwen Baseline Engine
try:
    from python_server.model_engine import BaselineQwenEngine
except ImportError:
    from model_engine import BaselineQwenEngine

app = FastAPI(title="AI Web Roaster Backend API - Qwen2.5 Baseline")

# Enable CORS for browser extensions (Vivaldi, Firefox, Chrome)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RoastRequest(BaseModel):
    text: str = ""
    url: str = ""

# Initialize Model Engine
engine = None

@app.on_event("startup")
def startup_event():
    global engine
    print("🤖 Initializing HuggingFace Qwen2.5-1.5B-Instruct Engine...")
    engine = BaselineQwenEngine()

@app.get("/")
def root():
    return {
        "message": "AI Web Roaster Baseline API is running!",
        "model": "Qwen/Qwen2.5-1.5B-Instruct",
        "status": "online"
    }

@app.get("/roast")
@app.post("/roast")
def generate_roast(req: RoastRequest = None):
    global engine
    text = req.text if req else ""
    url = req.url if req else ""

    if engine is None:
        return {"roast": "Model engine is still loading...", "source": "loading"}

    # Generate roast using Qwen2.5-1.5B-Instruct
    roast_text = engine.generate_roast(text, url)

    return {
        "roast": roast_text,
        "site": url,
        "model": "Qwen/Qwen2.5-1.5B-Instruct",
        "source": "huggingface_qwen_baseline"
    }

if __name__ == "__main__":
    print("🚀 Starting AI Web Roaster Python Server on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
