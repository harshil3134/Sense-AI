# Sense AI – AI-Powered Multimodal Voice Accessibility Assistant

> Voice-to-voice, camera-aware assistant that understands your environment, answers context-aware questions, and adapts output for general users and people with visual impairments.

---
## 🧭 Problem & Motivation
People with visual impairments, and even fully sighted users in complex or unfamiliar environments, often lack instant, conversational access to contextual scene understanding. Traditional apps either: 
- Give static OCR or object labels (low semantic richness), or
- Require manual interaction (not hands-free), or
- Don’t remember prior context for follow‑up questions.

Sense AI solves this by combining real‑time multimodal scene analysis, conversational memory, and adaptive narration—delivering fast, structured, accessibility‑aware responses as natural audio dialogue.

---
## 🔍 Operating Modes

### Normal Mode
Designed for broad situational exploration and conversational visual understanding. Ideal for:
- Identifying objects, layout, and relative spatial relationships
- Locating previously referenced or recently seen personal items (e.g. misplaced small electronics)
- Getting guided assistance for everyday interactions (pairing devices, setting items down safely, orienting to entrances)
- Comparing or selecting among multiple items (books, packages, products) with follow‑up detail requests
- Progressive deep‑dive: ask for a summary first, then “tell me more” for richer layered detail
- Informational use in stores, public spaces, exhibits
- General curiosity & descriptive enrichment

### Visually Impaired Mode
Optimized for actionable, concise auditory guidance:
- Surfaces obstacles & hazards first
- Emphasizes spatial orientation (near / far / left / right / path clearance)
- Provides navigation hints & safety notes
- Avoids unnecessary visual embellishment—prioritizes utility
- Keeps responses short, interruption‑friendly

---
## 🎯 What Sense AI Does
Below is a feature matrix that builds on the two adaptive operating modes above:
| Capability | Description |
|------------|-------------|
| Multimodal Vision | Image → structured semantic scene graph + accessibility insights (hazards, landmarks, layout). |
| Voice-First Interaction | User speaks a question, system replies with generated speech (no text UI dependency). |
| Memory & RAG | Stores granular “visual memories” (objects, obstacles, landmarks, layout) for follow‑up contextual questions. |
| Scene-Aware Q&A | Ask: “Where was the red chair relative to the door?” / “Is the path ahead clear?” |
| Safety Layer | Highlights obstacles, potential hazards, and navigation cues. |
| Parallel Processing | Vision parsing + context retrieval run concurrently for lower latency. |
| Audio Response Generation | Every reply returned as base64 WAV (immediate playback). |

---
## 🏗️ System Architecture Overview

```text
┌────────────────────┐
│ React Native App   │
│ (Camera + Mic + UI)│
└─────────┬──────────┘
          │  (1) Image + Audio (multipart)
          ▼
┌────────────────────┐
│ FastAPI Backend    │  (Routing, validation, timing)
└─────────┬──────────┘
		  │  (2) Speech-to-Text (Cartesia)
          ▼
┌────────────────────┐
│ Vision LLM (Groq)  │  (Multimodal understanding)
│ meta-llama vision  │
└─────────┬──────────┘
          │  (3) Structured Scene JSON
          ▼
┌────────────────────┐          (4a) Similarity Search
│ Chroma Vector Store│ 
└─────────┬──────────┘                                  
		  │  (4b) Retrieved Context (RAG)               
          ▼                                             
┌────────────────────┐                                  
│ Cerebras LLM       │(Mode-aware response synthesis).  
│ llama-4-scout text │                                  
└─────────┬──────────┘                                  
          │  (5) Final Answer Text                      
          ▼                                             
┌────────────────────┐                                  
│ Cartesia TTS       │  (6) Audio synthesis             
└─────────┬──────────┘                                  
          │  (7) base64 WAV                            
          ▼                                            
┌────────────────────┐                                  
│ Client Playback    │  (Voice-to-voice UX)             
└────────────────────┘                                  
```

### Core Components
- **FastAPI Backend**: Orchestrates STT → vision parsing → retrieval → response generation → TTS pipeline.
- **Groq Vision LLM** (`meta-llama/llama-4-maverick-17b-128e-instruct` or similar): Multimodal frame understanding.
- **Cerebras Text Generation Layer** (`llama-4-scout-17b-16e-instruct`): Crafts higher-quality, mode‑aware conversational or navigational responses.
- **LangChain**: Prompt composition + structured parsing with `PydanticOutputParser`.
- **Structured Scene Model**: JSON capturing objects, spatial layout, accessibility semantics, hazards, landmarks, summary, answer.
- **Chroma Vector Store**: Granular RAG memory (object/obstacle/landmark/layout/safety note docs).
- **Embeddings**: HuggingFace `sentence-transformers/all-MiniLM-L6-v2` for semantic recall.
- **Cartesia**: STT + TTS for fully voice-driven loop.
- **React Native Frontend**: Image + audio capture and low-latency playback of synthesized voice.

---
## 🧪 Structured Vision Output (Excerpt)
Example (fields trimmed for brevity):
```json
{
	"memory_id": "f6c2...",
	"summary": "A wooden table with a laptop and a coffee mug near a window.",
	"objects": [
		{"name": "laptop", "position": "center", "size": "medium", "confidence": 0.91},
		{"name": "mug", "position": "front-left", "size": "small"}
	],
	"scene_context": {"setting": "indoor workspace", "lighting": "natural"},
	"accessibility_info": {
		"obstacles": ["chair extended into walking path"],
		"landmarks": ["large window behind table"],
		"navigation_tips": ["Approach from right side; left has chair obstruction"],
		"safety_notes": ["Chair leg could trip you"]
	},
	"spatial_layout": "Table centered; chair protrudes left; window behind.",
	"answer": "Yes, the path on the right appears clear.",
	"confidence": 0.86
}
```

---
## 🔄 Request Lifecycle (`POST /vision`)
1. Client sends multipart form: `file` (image), `audio` (voice question), `user_id`, `chat_id`, optional `question` fallback.
2. Audio → Speech-to-Text transcription (Cartesia). (If transcription fails, fallback to provided `question` field.)
3. Parallel execution begins:
   - (A) Groq Vision LLM produces structured scene JSON.
   - (B) Vector retrieval (Chroma) fetches top-k prior memory docs.
4. Cerebras response synthesis combines: user intent + new scene JSON + retrieved context + mode rules.
5. TTS generation (Cartesia) → base64 WAV.
6. Memory documents stored asynchronously (thread) for future RAG enrichment.
7. Chat history updated (`user_id` + `chat_id`).
8. JSON returned: `answer`, `audio_base64`, `chat_history`, `processing_time`.

---
## ⚡ Performance Strategies
- Async FastAPI endpoints + thread offloading for blocking I/O.
- Parallelization of memory creation + retrieval.
- Streaming-capable model client patterns (future extension potential).
- Granular document design improves recall precision vs monolithic scene blobs.

---
## 🛡️ Accessibility & UX Principles
- Audio-first: All output synthesized; no reliance on text display.
- Concise guidance in visually impaired mode to reduce cognitive load.
- Spatial prepositions standardized ("front-left", "behind", "near", etc.).
- Safety elements prioritized before descriptive embellishment.

---
## 🗄️ Persistence & Memory Model
| Layer | Purpose |
|-------|---------|
| Raw Upload | Base64 image (ephemeral in process). |
| Structured Scene JSON | Returned & used for immediate answer generation. |
| Chroma Vector Docs | Each object/obstacle/landmark/layout/safety note stored as a separate embedding. |
| Chat History (in‑memory dict) | Per `user_id` + `chat_id` conversational context. |

The vectorization strategy enables queries like “Where was the doorway earlier?” even if not in the current frame.

---
## 🔐 Environment & Configuration
Create `.env` (see provided example):
```
CEREBRAS_API_KEY=...
GROQ_API_KEY=...          # Optional (alternate provider future use)
CARTESIA_API_KEY=...
AI_PROVIDER=groq          # (vision via Groq, generation refinement via Cerebras)
```

Logs written to `backend/logs/api_performance.log` with per‑stage timing.

---
## 📡 API Endpoints Summary
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Liveness + timestamp |
| POST | `/vision` | Image + voice → structured scene + audio reply |
| GET | `/memories` | Inspect stored granular memory docs (dev) |
| POST | `/memories/clear` | Wipe vector DB (dev/reset) |
| GET | `/chat-history` | Dump in‑memory chat history (dev) |

### `/vision` Parameters (multipart/form-data)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| file | image/* | Yes | Captured frame |
| audio | audio/* | Yes (for voice-first UX) | User’s spoken question |
| user_id | string | Yes | User namespace |
| chat_id | string | Yes | Session/thread id |
| question | string | No | Fallback if transcription fails |
| mode | string | No | `blind` or `normal` (default: `classic` -> treated as normal) |

### Response
```json
{
	"answer": "Your narrated or Q&A response",
	"audio_base64": "<WAV base64>",
	"chat_history": [...],
	"processing_time": "2.314s"
}
```

---
## 🧰 Tech Stack
- FastAPI, Uvicorn
- LangChain + Pydantic structured parsers
- Cerebras `llama-4-scout` multimodal LLM
- HuggingFace Sentence Transformers (MiniLM-L6-v2)
- Chroma vector store
- Cartesia speech APIs
- React Native (Expo) frontend
- OpenCV / Pillow for image handling

---
## 🚀 Backend Setup
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Docker
```bash
cd backend
docker-compose up --build
```

---
## 📱 Frontend (React Native / Expo) Quick Start
```bash
cd frontend/rn_app_VoiceApp
npm install
npm install -g expo-cli  # if not already
expo start
```
Scan QR in Expo Go (device) or press `i` / `a` for iOS/Android simulators.

---
## 🔮 Roadmap Ideas
- Live video stream segmentation (continuous context)
- Low‑vision adaptive contrast overlay mode
- Indoor navigation integration (BLE / AR anchors)
- On‑device fallback (distilled small model) for offline core tasks
- Multi-language TTS + STT expansion
- Scene change detection to auto-trigger capture

---
## 🧪 Testing & Dev Utilities
- Use `/memories` to verify vector persistence integrity.
- Use `/memories/clear` between benchmark runs.
- Log durations around: read image, parallel tasks, full request.

---
## ⚠️ Limitations
- User authentication / login & per-user persistent long-term memory not yet implemented
- Scene analysis currently single-frame (video streaming roadmap item)
- Assumes reasonably clear, well-lit images for optimal hazard detection
- Requires active network connection for remote LLM + speech services

---
## 👥 Team – Vector Rush
- Harshil Patel ✨
- Rushikesh Vekaria 🚀

## 📄 License
MIT License (see `LICENSE`).

## ❤️ Acknowledgements
### Special Thanks
This project was made possible by the support of the following organizers and key sponsors:

- FutureStack GenAI Hackathon: For organizing this exceptional event.

- Cerebras: For providing powerful AI model optimization support.

- Meta (Llama): For their valuable open-source contributions and developer resources.

- Docker: For enabling easy containerization and seamless deployment.
