from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import sys

# Import Multi-Engine AI Roaster
try:
    from python_server.model_engine import MultiEngineRoaster
except ImportError:
    from model_engine import MultiEngineRoaster

app = FastAPI(title="AI Web Roaster Multi-Engine API")

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

# Initialize Multi-Engine Roaster
roaster_engine = None

@app.on_event("startup")
def startup_event():
    global roaster_engine
    print("🤖 Initializing AI Roaster Engine...")
    roaster_engine = MultiEngineRoaster()

@app.api_route("/", methods=["GET", "POST", "OPTIONS"])
def root():
    active_engine = roaster_engine.engine_type if roaster_engine else "loading"
    return {
        "message": "AI Web Roaster API is running!",
        "engine": active_engine,
        "status": "online"
    }

@app.api_route("/roast", methods=["GET", "POST", "OPTIONS"])
@app.api_route("/roast/", methods=["GET", "POST", "OPTIONS"])
def generate_roast(req: RoastRequest = None):
    global roaster_engine
    text = req.text if req else ""
    url = req.url if req else ""

    if roaster_engine is None:
        return {"roast": "Roaster engine initializing...", "source": "loading"}

    # Generate roast using active engine (Groq / Ollama / HF)
    result = roaster_engine.generate_roast(text, url)

    return {
        "roast": result["roast"],
        "site": url,
        "engine": result["engine"],
        "latency_ms": result["latency_ms"],
        "source": "python_fastapi_server"
    }

if __name__ == "__main__":
    print("🚀 Starting AI Web Roaster Python Server on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
