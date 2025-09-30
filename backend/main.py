from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List
import uvicorn
import os
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
import io
import base64
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
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

# Enhanced structured response models
class ObjectDetection(BaseModel):
    name: str = Field(description="Name of the detected object")
    position: str = Field(description="Position/location of the object in the scene")
    size: Optional[str] = Field(description="Relative size (small, medium, large)", default=None)
    confidence: Optional[float] = Field(description="Detection confidence", default=0.8)

class SceneContext(BaseModel):
    setting: str = Field(description="Type of environment (indoor/outdoor, room type, etc.)")
    lighting: str = Field(description="Lighting conditions (bright/dim/natural/artificial)")
    weather: Optional[str] = Field(description="Weather conditions if outdoor", default=None)
    time_of_day: Optional[str] = Field(description="Apparent time of day", default=None)

class AccessibilityInfo(BaseModel):
    obstacles: List[str] = Field(description="Potential obstacles for navigation", default=[])
    landmarks: List[str] = Field(description="Notable landmarks for orientation", default=[])
    safety_notes: List[str] = Field(description="Safety considerations", default=[])
    navigation_tips: List[str] = Field(description="Tips for safe navigation", default=[])

class StructuredVisionResponse(BaseModel):
    summary: str = Field(description="Brief overall description (2-3 sentences)")
    objects: List[ObjectDetection] = Field(description="Detected objects in the scene")
    scene_context: SceneContext = Field(description="Environmental context")
    accessibility_info: AccessibilityInfo = Field(description="Accessibility-specific information")
    detailed_description: str = Field(description="Comprehensive narrative description")
    spatial_layout: str = Field(description="Description of spatial relationships and layout")
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

@app.post("/vision", response_model=StructuredVisionResponse)
async def vision_structured(file: UploadFile = File(...)):
    """
    Upload an image and get structured AI vision analysis using LangChain
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image contents
        contents = await file.read()
        image_b64 = base64.b64encode(contents).decode("utf-8")
        
        # Call AI provider based on configuration
        if AI_PROVIDER == "groq":
            # Step 1: Create output parser for structured response
            output_parser = PydanticOutputParser(pydantic_object=StructuredVisionResponse)
            
            # Step 2: Get format instructions
            format_instructions = output_parser.get_format_instructions()
            
            # Step 3: Create structured prompt
            system_template = """You are an AI assistant specialized in describing images for visually impaired users. 
            Analyze images with focus on accessibility, safety, and navigation.
            Provide clear, detailed, and helpful descriptions.
            
            {format_instructions}"""
            
            # Step 4: Create messages for vision model
            system_message = SystemMessage(
                content=system_template.format(format_instructions=format_instructions)
            )
            
            human_message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": """Analyze this image in detail for a visually impaired person.
                        Focus on:
                        1. Objects and their spatial relationships
                        2. Environmental context and safety
                        3. Navigation landmarks and obstacles
                        4. Detailed descriptions for understanding the scene
                        
                        Provide your analysis in the specified JSON format."""
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}"
                        }
                    }
                ]
            )
            
            # Step 5: Initialize LLM with your original parameters
            llm = ChatGroq(
                model="meta-llama/llama-4-scout-17b-16e-instruct",  # Your original model
                temperature=0.7,  # Your original temperature
                max_tokens=1024,  # Your original max_tokens
                top_p=1,  # Your original top_p
                stream=False,
                max_retries=2,
            )
            
            # Step 6: Get LLM response
            llm_response = llm.invoke([system_message, human_message])
            
            # Step 7: Parse the structured response
            try:
                structured_response = output_parser.parse(llm_response.content)
                # Add timestamp since it's not generated by LLM
                structured_response.timestamp = datetime.now()
                return structured_response
                
            except Exception as parse_error:
                print(f"Parse error: {parse_error}")
                print(f"Raw response: {llm_response.content}")
                
                # Fallback: Create structured response manually if parsing fails
                return StructuredVisionResponse(
                    summary="AI-generated image description available",
                    objects=[ObjectDetection(
                        name="Various objects", 
                        position="Throughout scene", 
                        color="Multiple colors", 
                        size="Various sizes"
                    )],
                    scene_context=SceneContext(
                        setting="Scene detected", 
                        lighting="Lighting present"
                    ),
                    accessibility_info=AccessibilityInfo(
                        obstacles=["Please review detailed description for obstacles"],
                        landmarks=["Please review detailed description for landmarks"],
                        safety_notes=["Exercise general caution"]
                    ),
                    detailed_description=llm_response.content,
                    spatial_layout="Spatial information available in detailed description",
                    timestamp=datetime.now(),
                    confidence=0.75
                )

        else:
            # Cerebras fallback (non-structured for now)
            prompt = "Analyze this image for a visually impaired person. Include objects, spatial layout, safety considerations, and navigation aids."
            description = cerebras_query_vision(prompt, image_b64)
            
            return StructuredVisionResponse(
                summary="Image analyzed using Cerebras AI",
                objects=[ObjectDetection(
                    name="Objects detected", 
                    position="Various positions", 
                    size="Various sizes"
                )],
                scene_context=SceneContext(
                    setting="Scene detected", 
                    lighting="Lighting conditions noted"
                ),
                accessibility_info=AccessibilityInfo(
                    obstacles=["Refer to detailed description"],
                    landmarks=["Refer to detailed description"],
                    safety_notes=["Exercise caution"]
                ),
                detailed_description=description,
                spatial_layout="Layout information in detailed description",
                timestamp=datetime.now(),
                confidence=0.85
            )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)