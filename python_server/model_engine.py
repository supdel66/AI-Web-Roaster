import os
import json
import time
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Data & Logging directory setup
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
LOG_FILE = os.path.join(DATA_DIR, "ai_roasts_log.jsonl")
os.makedirs(DATA_DIR, exist_ok=True)

# --------------------------------------------------------------------------
# 1. HuggingFace Qwen2.5 Baseline Engine (Your Custom Local Setup)
# --------------------------------------------------------------------------
MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"

class BaselineQwenEngine:
    def __init__(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        print(f"🤖 Loading baseline HuggingFace model: {MODEL_ID} (CPU / float32)...")
        start_time = time.time()
        
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float32,
            device_map="cpu"
        )
        print(f"✅ Qwen model loaded successfully in {time.time() - start_time:.2f} seconds!")

    def generate_roast(self, text: str, url: str) -> str:
        import torch
        if not text or len(text.strip()) < 5:
            text = "Generic Webpage"

        system_prompt = (
            "You are a savage, witty, sarcastic comedian. "
            "Roast the following webpage content in 1-2 short, punchy sentences. "
            "Make it funny and sharp!"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Webpage snippet ({url}): {text}"}
        ]

        prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        model_inputs = self.tokenizer([prompt], return_tensors="pt").to("cpu")

        with torch.no_grad():
            generated_ids = self.model.generate(
                **model_inputs,
                max_new_tokens=80,
                temperature=0.8,
                top_p=0.9,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )

        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]

        return self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()


# --------------------------------------------------------------------------
# 2. Multi-Engine Roaster (Supporting Groq Cloud API, Ollama, HuggingFace)
# --------------------------------------------------------------------------
class MultiEngineRoaster:
    """
    Unified AI Roast Engine supporting:
    - Groq Cloud API ('groq')
    - Local Ollama ('ollama')
    - HuggingFace Qwen ('huggingface')
    - Smart Heuristic Fallback ('mock')
    """
    def __init__(self, engine_type=None):
        self.groq_api_key = os.getenv("GROQ_API_KEY") or os.getenv("groq_api_key")
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "llama3")

        if engine_type:
            self.engine_type = engine_type.lower()
        elif os.getenv("ROAST_ENGINE"):
            self.engine_type = os.getenv("ROAST_ENGINE").lower()
        elif self.groq_api_key:
            self.engine_type = "groq"
        else:
            self.engine_type = "ollama"

        print(f"🔥 AI Roaster initialized using engine: [{self.engine_type.upper()}]")

        # Initialize Groq client if selected
        self.groq_client = None
        if self.engine_type == "groq" and self.groq_api_key:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=self.groq_api_key)
                print("⚡ Groq Cloud API connected successfully!")
            except Exception as e:
                print(f"⚠️ Could not initialize Groq client: {e}")

        # Initialize HuggingFace baseline if selected
        self.hf_engine = None
        if self.engine_type == "huggingface":
            try:
                self.hf_engine = BaselineQwenEngine()
            except Exception as e:
                print(f"⚠️ Could not initialize HuggingFace Qwen engine: {e}")

    def generate_roast(self, text: str, url: str) -> dict:
        start_time = time.time()
        roast_text = ""
        used_engine = self.engine_type

        system_prompt = (
            "You are a savage, hilarious, sarcastic AI comedian. "
            "Roast the following webpage content in 1-2 short, punchy sentences. "
            "Make it funny and sharp!"
        )

        user_content = f"Webpage snippet ({url}): {text[:400]}"

        # 1. GROQ CLOUD API ENGINE
        if self.engine_type == "groq" and self.groq_client:
            try:
                response = self.groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    model=os.getenv("GROQ_MODEL", "groq/compound-mini"),
                    temperature=0.8,
                    max_tokens=100
                )
                raw_text = response.choices[0].message.content.strip()
                if "</think>" in raw_text:
                    raw_text = raw_text.split("</think>")[-1].strip()
                roast_text = raw_text.replace('"', '')
            except Exception as e:
                print(f"⚠️ Groq API call failed: {e}. Falling back to Ollama / Mock.")
                used_engine = "fallback"

        # 2. LOCAL OLLAMA ENGINE
        if not roast_text and (self.engine_type == "ollama" or used_engine == "fallback"):
            try:
                resp = requests.post(
                    self.ollama_url,
                    json={
                        "model": self.ollama_model,
                        "prompt": f"{system_prompt}\n\n{user_content}",
                        "stream": False
                    },
                    timeout=5
                )
                if resp.status_code == 200:
                    roast_text = resp.json().get("response", "").strip()
                    used_engine = "ollama"
            except Exception as e:
                print(f"⚠️ Ollama API call failed: {e}")

        # 3. LOCAL HUGGINGFACE QWEN ENGINE
        if not roast_text and self.engine_type == "huggingface" and self.hf_engine:
            roast_text = self.hf_engine.generate_roast(text, url)
            used_engine = "huggingface_qwen"

        # 4. HEURISTIC MOCK FALLBACK (If APIs are offline)
        if not roast_text:
            roast_text = self._generate_heuristic_roast(text, url)
            used_engine = "heuristic_fallback"

        latency_ms = int((time.time() - start_time) * 1000)

        # Log roast sample
        self.log_sample(url, text, roast_text, used_engine, latency_ms)

        return {
            "roast": roast_text,
            "engine": used_engine,
            "latency_ms": latency_ms
        }

    def _generate_heuristic_roast(self, text: str, url: str) -> str:
        url_lower = url.lower()
        if "canva.com" in url_lower:
            return "Canva: Giving non-designers the confidence to use 14 mismatched fonts and drop shadows on everything! 🎨"
        if "google.com" in url_lower:
            return "Google: 2 billion dollars spent on AI search just to show 5 sponsored ad links! 🔍"
        if "youtube.com" in url_lower:
            return "YouTube: 2 unskippable 30-second ads just to watch a 5-second video! 📹"
        if "geeksforgeeks.org" in url_lower:
            return "GeeksforGeeks: 45 popups and 12 ads just to copy a 2-line binary search loop! 💻"
        return "Imagine writing 300 words for something that could be answered in 3 words! 📝"

    def log_sample(self, url: str, input_text: str, roast: str, engine: str, latency_ms: int):
        sample = {
            "timestamp": datetime.now().isoformat(),
            "engine": engine,
            "url": url,
            "input_text": input_text,
            "roast": roast,
            "latency_ms": latency_ms
        }
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(sample, ensure_ascii=False) + "\n")
        except Exception:
            pass

# Quick Standalone Test
if __name__ == "__main__":
    roaster = MultiEngineRoaster()
    result = roaster.generate_roast("Design poster for social media", "https://canva.com")
    print("\n--- Test Result ---")
    print(f"Engine: {result['engine']} ({result['latency_ms']} ms)")
    print(f"Roast: {result['roast']}")
