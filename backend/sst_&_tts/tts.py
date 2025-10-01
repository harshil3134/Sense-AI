import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("CARTESIA_API_KEY")
if not API_KEY:
    raise RuntimeError("Please set the CARTESIA_API_KEY environment variable")

def cartesia_tts_bytes(text: str, output_file: str = "output.wav"):
    url = "https://api.cartesia.ai/tts/bytes"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Cartesia-Version": "2025-04-16",
        "Content-Type": "application/json",
        "Accept": "application/octet-stream",
    }
    payload = {
        "transcript": text,
        "model_id": "sonic-2",        # supports multilingual TTS
        "voice": {
            "mode": "id",
            "id": "694f9389-aac1-45b6-b726-9d9369183238"  # must support Hindi
        },
        "language": "hi",             # 👈 key change for Hindi
        "output_format": {
            "container": "wav",
            "encoding": "pcm_f32le",
            "sample_rate": 44100
        }
    }

    resp = requests.post(url, headers=headers, json=payload)
    resp.raise_for_status()

    with open(output_file, "wb") as f:
        f.write(resp.content)

    print("Audio saved to", output_file)


if __name__ == "__main__":
    # sample = "Hello from Cartesia! This is a test of TTS."
    sample = "हेलो आप कैसे हैं मैं आपका वॉइस असिस्टेंट हूं, आप मुझसे कुछ भी पूछ सकते हैं"
    cartesia_tts_bytes(sample, "test_cartesia1.wav")