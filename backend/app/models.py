from pydantic import BaseModel
from datetime import datetime

class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: datetime
    message: str

class VisionResponse(BaseModel):
    """Response model for vision analysis"""
    description: str
    timestamp: datetime
    confidence: float