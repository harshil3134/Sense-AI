import os
import requests
from dotenv import load_dotenv

load_dotenv()
# Put your API key in an environment variable
API_KEY = os.getenv("CARTESIA_API_KEY")
if not API_KEY:
    raise RuntimeError("Set CARTESIA_API_KEY env var")

def transcribe_audio_file(file_path: str, model: str = "ink-whisper", language: str = "en"):
    url = "https://api.cartesia.ai/stt"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Cartesia-Version": "2025-04-16",
    }
    # If you want timestamps per word, you can include timestamp_granularities
    payload = {
        "model": model,
        "language": language,
        # "timestamp_granularities[]": ["word"]  # uncomment if you want word-level timestamps
    }
    files = {
        "file": open(file_path, "rb")
    }
    resp = requests.post(url, data=payload, files=files, headers=headers)
    resp.raise_for_status()
    return resp.json()

if __name__ == "__main__":
    audio_path = "test2.m4a"
    result = transcribe_audio_file(audio_path, model="ink-whisper", language="en")
    print("Transcription:", result.get("text"))
    print("Duration (s):", result.get("duration"))
