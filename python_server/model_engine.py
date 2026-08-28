import os
import json
import time
from datetime import datetime
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

# Target Model Identifier on HuggingFace Hub
MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"

# Dataset Logging File Path
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
LOG_FILE = os.path.join(DATA_DIR, "baseline_roasts.jsonl")

os.makedirs(DATA_DIR, exist_ok=True)

class BaselineQwenEngine:
    def __init__(self):
        print(f"🤖 Loading baseline HuggingFace model: {MODEL_ID} (CPU / bfloat16)...")
        start_time = time.time()
        
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float32,
            device_map="cpu"
        )
        
        print(f"✅ Model loaded successfully in {time.time() - start_time:.2f} seconds!")

    def generate_roast(self, text: str, url: str) -> str:
        """
        Generate a roast using Qwen2.5-1.5B-Instruct system prompt
        """
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

        start_gen = time.time()
        with torch.no_grad():
            generated_ids = self.model.generate(
                **model_inputs,
                max_new_tokens=80,
                temperature=0.8,
                top_p=0.9,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )

        # Slice generated token IDs (skip prompt tokens)
        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]

        roast_output = self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
        latency_ms = int((time.time() - start_gen) * 1000)

        # Log generation to baseline_roasts.jsonl for dataset comparison
        self.log_baseline_sample(url, text, system_prompt, roast_output, latency_ms)

        return roast_output

    def log_baseline_sample(self, url: str, input_text: str, prompt: str, roast: str, latency_ms: int):
        """
        Appends sample to data/baseline_roasts.jsonl
        """
        sample = {
            "timestamp": datetime.now().isoformat(),
            "model": MODEL_ID,
            "url": url,
            "input_text": input_text,
            "prompt": prompt,
            "baseline_roast": roast,
            "latency_ms": latency_ms
        }
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")


# Quick standalone test
if __name__ == "__main__":
    engine = BaselineQwenEngine()
    test_roast = engine.generate_roast(
        "Design templates for posters and social media posts",
        "https://canva.com"
    )
    print("\n--- Test Roast Output ---")
    print(test_roast)
