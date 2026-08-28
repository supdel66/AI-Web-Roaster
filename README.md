# 🔥 AI Web Roaster

[![Manifest V3](https://img.shields.io/badge/Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Cloud-orange.svg)](https://groq.com/)
[![Qwen2.5](https://img.shields.io/badge/Model-Qwen2.5--1.5B--Instruct-purple.svg)](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An **AI-powered cross-browser extension & Python backend** that extracts webpage content as you scroll and generates savage, hilarious, contextual roasts in real-time.

Built as an **AI/ML portfolio project** to evaluate and benchmark **Baseline Open Models (`Qwen2.5-1.5B-Instruct`)**, **Cloud Inference APIs (`Groq Cloud`)**, and **Local LLMs (`Ollama`)** while logging dataset samples for fine-tuning.

---

## 🌟 Key Features

- **🌐 Cross-Browser Native**: Works out-of-the-box on **Vivaldi**, **Firefox**, and **Chrome** (Manifest V3).
- **🤖 Multi-Engine AI Backend**: Seamlessly toggle between:
  - ⚡ **Groq Cloud API** (`groq/compound-mini` / `llama-3.3-70b`) for 800ms ultra-fast roasts.
  - 🔬 **Local HuggingFace Baseline** (`Qwen/Qwen2.5-1.5B-Instruct`) for offline evaluation.
  - 🦙 **Local Ollama Server** (`llama3` / `qwen2.5`).
  - 🛡️ **Heuristic Fallback Engine** if offline.
- **⚡ Universal Web Content Extractor**: Automatically captures text snippets from any website or web app (**Canva, Google, ChatGPT, YouTube, Wikipedia, GitHub, GeeksforGeeks**).
- **🔒 CORS-Free Architecture**: Routes HTTP requests through an extension background service worker to bypass browser HTTPS loopback & Private Network Access (PNA) security blocks.
- **🎨 Glassmorphic Toast UI**: Sleek, animated glowing toast notifications with customizable auto-roast timers (**1 to 10 minute intervals**).
- **📊 Dataset Logger**: Automatically records prompt-completion pairs to `data/ai_roasts_log.jsonl` for benchmarking and future SFT fine-tuning.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│   Browser Extension (Vivaldi / Firefox / Chrome)            │
│   - Content Script extracts visible screen text             │
│   - Renders glowing toast pop-ups & progress bars           │
└──────────────────────────────┬──────────────────────────────┘
                               │ Extension Messaging
┌──────────────────────────────▼──────────────────────────────┐
│   Background Service Worker (background.js)                 │
│   - Bypasses HTTPS loopback & CORS restrictions             │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP POST / JSON
                     http://localhost:8000/roast
                               │
┌──────────────────────────────▼──────────────────────────────┐
│   Python FastAPI Backend (server.py)                        │
│   - MultiEngineRoaster (Groq API / Qwen2.5 / Ollama)        │
│   - Logs dataset samples to data/ai_roasts_log.jsonl        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Firefox 109+ or Vivaldi / Chrome 110+

---

### 2. Backend Setup & Configuration

Clone the repository and set up the Python virtual environment:

```bash
git clone https://github.com/your-username/aiwebroaster.git
cd aiwebroaster

# Create virtual environment
python3 -m venv python_server/venv
source python_server/venv/bin/activate  # On Windows: python_server\venv\Scripts\activate

# Install dependencies
pip install -r python_server/requirements.txt
```

Create a `.env` file in the root directory (protected by `.gitignore`):

```env
# Groq API Key (Get a free key from https://console.groq.com)
groq_api_key=your_groq_api_key_here

# Engine Selection: 'groq' | 'huggingface' | 'ollama'
ROAST_ENGINE=groq

# Optional Ollama settings (if using Ollama)
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3
```

Start the FastAPI server:

```bash
python_server/venv/bin/python python_server/server.py
```

The backend will start at `http://localhost:8000`.

---

### 3. Loading the Extension in Your Browser

#### 🌐 Vivaldi / Chrome:
1. Open `vivaldi://extensions` (or `chrome://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **"Load unpacked"** and select the `aiwebroaster` root folder.

#### 🦊 Firefox:
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."**.
3. Select `manifest.json` inside the `aiwebroaster` root folder.

---

## 🎛️ Extension Controls

- **Auto-Roast Timer**: Adjust the interval slider from **1 min to 10 min** (default: 5 min).
- **Manual Roast**: Click **"🔥 Roast Webpage Now!"** in the toolbar popup or press **`Alt + R`**.
- **Context Menu**: Right-click anywhere on a page → **"🔥 Roast This Webpage"**.

---

## ☁️ Free 24/7 Cloud Deployment

Want to run the backend in the cloud without keeping your laptop terminal open?

A pre-configured [Dockerfile](file:///run/media/ayirpus/NewVolume/Projects/linux/aiwebroaster/python_server/Dockerfile) is included for 1-click free deployment to **Render.com** or **Hugging Face Spaces**:

1. Push this repository to GitHub.
2. Create a new Web Service on **[Render.com](https://render.com)**.
3. Set **Root Directory** to `python_server`, **Start Command** to `uvicorn server:app --host 0.0.0.0 --port $PORT`, and add environment variable `groq_api_key`.
4. Update `serverUrl` in `background/background.js` to your new cloud URL (e.g. `https://aiwebroaster.onrender.com/roast`).

---

## 📁 Repository Structure

```
aiwebroaster/
├── manifest.json              # Extension Manifest V3 configuration
├── background/
│   └── background.js          # Service worker for CORS-free requests & hotkeys
├── content/
│   ├── roast_toast.js         # Universal web text extractor & toast controller
│   └── roast_toast.css        # Glassmorphic glowing roast popup styles
├── popup/
│   ├── popup.html             # Toolbar interface
│   ├── popup.css              # Glassmorphism popup styling
│   └── popup.js               # Interval slider & toggle controls
├── python_server/
│   ├── server.py              # FastAPI server endpoints (/roast, /)
│   ├── model_engine.py        # MultiEngineRoaster (Groq, Qwen, Ollama)
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile             # Cloud deployment container spec
└── data/                      # Logged roast evaluation samples (.jsonl)
```

---

## 🛠️ Tech Stack

- **Machine Learning / LLM**: PyTorch, Hugging Face Transformers (`Qwen2.5-1.5B-Instruct`), Groq Cloud API (`groq/compound-mini`), Ollama.
- **Backend API**: Python 3.10+, FastAPI, Uvicorn, Pydantic, python-dotenv.
- **Frontend / Extension**: JavaScript (ES6+), WebExtensions API, HTML5, CSS3 Glassmorphism, Manifest V3.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details.
