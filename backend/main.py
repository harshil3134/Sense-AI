from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
import io
import base64
from utils.cerebras import query_vision as cerebras_query_vision
from utils.groq_client import query_vision as groq_query_vision

# Configuration - choose your AI provider
AI_PROVIDER = os.getenv("AI_PROVIDER", "cerebras").lower()  # "cerebras" or "groq"

# Initialize FastAPI app
app = FastAPI(
    title="AI Accessibility Assistant API",
    description="Simple API with health check and vision analysis",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
os.makedirs("uploads", exist_ok=True)

# Data models
class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    message: str

class VisionResponse(BaseModel):
    description: str
    timestamp: datetime
    confidence: float

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        message="AI Accessibility Assistant is running"
    )

@app.post("/vision", response_model=VisionResponse)
async def vision(file: UploadFile = File(...)):
    """
    Upload an image and get AI vision analysis
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image contents
        contents = await file.read()
        
        # Convert image to base64
        image_b64 = base64.b64encode(contents).decode("utf-8")
        
        # Create prompt for vision analysis
        prompt = "Describe this image in detail. Focus on objects, their positions, colors, and the overall scene. This is for a visually impaired person who needs to understand their surroundings."
        
        # Call AI provider based on configuration
        if AI_PROVIDER == "groq":
            description = groq_query_vision(prompt, image_b64)
        else:
            description = cerebras_query_vision(prompt, image_b64)
        
        return VisionResponse(
            description=description,
            timestamp=datetime.now(),
            confidence=0.90
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)