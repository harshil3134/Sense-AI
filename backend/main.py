from fastapi import FastAPI, UploadFile, File,Form, HTTPException
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
import uuid
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
from langchain.schema import Document
from utils.cerebras import query_vision as cerebras_query_vision
from utils.groq_client import query_vision as groq_query_vision
from langchain_cerebras import ChatCerebras
import json
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import Chroma


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
    memory_id: str = Field(description="Unique ID for this visual memory")  
    summary: str = Field(description="Brief overall description (2-3 sentences)")
    objects: List[ObjectDetection] = Field(description="Detected objects in the scene")
    scene_context: SceneContext = Field(description="Environmental context")
    accessibility_info: AccessibilityInfo = Field(description="Accessibility-specific information")
    detailed_description: str = Field(description="Comprehensive narrative description")
    spatial_layout: str = Field(description="Description of spatial relationships and layout")
    timestamp: datetime
    confidence: float



def create_memory_document(structured_response: StructuredVisionResponse) -> Document:
    """Convert structured response to a document for vectorization"""

    # Create comprehensive text representation for vectorization
    objects_text = ", ".join([f"{obj.name} at {obj.position}" for obj in structured_response.objects])
    obstacles_text = ", ".join(structured_response.accessibility_info.obstacles)
    landmarks_text = ", ".join(structured_response.accessibility_info.landmarks)

    content = f"""
    Scene: {structured_response.summary}
    Setting: {structured_response.scene_context.setting}
    Objects: {objects_text}
    Spatial Layout: {structured_response.spatial_layout}
    Obstacles: {obstacles_text}
    Landmarks: {landmarks_text}
    Detailed Description: {structured_response.detailed_description}
    """

    metadata = {
        "memory_id": structured_response.memory_id,
        "timestamp": structured_response.timestamp.isoformat(),
        "setting": structured_response.scene_context.setting,
        "lighting": structured_response.scene_context.lighting,
        "confidence": structured_response.confidence,
        # Store complex fields as JSON strings if you want to keep them
        # "objects": json.dumps([obj.dict() for obj in structured_response.objects]),
        # "accessibility_info": json.dumps(structured_response.accessibility_info.dict())
    }

    return Document(page_content=content.strip(), metadata=metadata)

def store_visual_memory(structured_response: StructuredVisionResponse):
    """Store structured response in vector database"""
    try:
        document = create_memory_document(structured_response)
        vectorstore.add_documents([document])
        vectorstore.persist()
        print(f"Stored visual memory: {structured_response.memory_id}")
    except Exception as e:
        print(f"Error storing visual memory: {e}")

def generate_response_blind(question: str,current_context:str) -> str:
    """
    Generate answer using Cerebras with RAG context via LangChain.
    """
    try:

        if question.strip():
            prompt=f"""You are an accessibility assistant for blind users. 
            Given the following detailed scene description and object information, rewrite it to be concise, clear, and easy to follow. 
            Focus on the most important objects, their locations, and any key spatial relationships or safety information. 
            Avoid unnecessary details and keep the description brief but informative, so a blind person can quickly understand their surroundings and navigate safely.

            Here is the current output:
            ${current_context}

            Please provide an improved, shorter description suitable for a blind user. """
        else:
            prompt=f""" 
            try to answer question as best and concise 
                User Question: "{question}"
                
                   """
            
        # System message for context
        system_message = SystemMessage(
            content=f"""You are an accessibility assistant for blind users. 
Your job is to take detailed scene descriptions and rewrite them to be concise, clear, and easy to follow. 
Focus on the most important objects, their locations, spatial relationships, and any key safety or navigation information. 
Avoid unnecessary details and keep the description brief but informative, so a blind person can quickly understand their surroundings and navigate safely."""
        )

        # Human message with the composed prompt
        human_message = HumanMessage(content=prompt)

        # Initialize the Cerebras LLM (make sure your API key is set in the environment)
        llm = ChatCerebras(
            model="llama-4-scout-17b-16e-instruct",  # or your preferred model
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            max_retries=2,
        )

        response =llm.invoke([system_message, human_message])

        return response.content

    except Exception as e:
        return f"Error generating answer with Cerebras: {e}"

def generate_response_normal(question: str,current_context:str) -> str:
    """
    Generate answer using Cerebras with RAG context via LangChain.
    """
    try:

        if question.strip():
            prompt=f"""
    User Question: "{question}"
    Context: {current_context}
                   """

        

        # System message for context
        system_message = SystemMessage(
            content=f"""You are a helpful assistant for a sighted user. 
Answer the user's questions **briefly** in 1-2 sentences. 
Do NOT provide continuous narration or step-by-step reasoning. 
If you cannot find the answer from the provided context, respond: "I cannot locate it from current context."
Focus only on directly answering the question using the context provided.

"""
        )

        # Human message with the composed prompt
        human_message = HumanMessage(content=prompt)

        # Initialize the Cerebras LLM (make sure your API key is set in the environment)
        llm = ChatCerebras(
            model="llama-4-scout-17b-16e-instruct",  # or your preferred model
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            max_retries=2,
        )

        response =llm.invoke([system_message, human_message])

        return response.content

    except Exception as e:
        return f"Error generating answer with Cerebras: {e}"

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        message="AI Accessibility Assistant is running"
    )
#need to pass question to this function for better answer
async def create_visual_memory(image_b64: str, memory_id: str) -> StructuredVisionResponse:
    """Create structured visual memory from image"""
    
    if AI_PROVIDER == "groq":
        # Create output parser for structured response
        output_parser = PydanticOutputParser(pydantic_object=StructuredVisionResponse)
        format_instructions = output_parser.get_format_instructions()
        
        system_template = """You are an AI assistant specialized in describing images for visually impaired users. 
        Analyze images with focus on accessibility, safety, and navigation.
        Provide clear, detailed, and helpful descriptions.
        
        {format_instructions}"""
        
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
                    
                    Provide your analysis in the specified JSON format.
                 """
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_b64}"
                    }
                }
            ]
        )
        
        llm = ChatGroq(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            max_retries=2,
        )
        
        llm_response = llm.invoke([system_message, human_message])
        
        try:
            structured_response = output_parser.parse(llm_response.content)
            structured_response.memory_id = memory_id
            structured_response.timestamp = datetime.now()
            print('----- in create visual-----',llm_response.content)
            return structured_response
            
        except Exception as parse_error:
            print(f"Parse error: {parse_error}")
            print(f"Raw response: {llm_response.content}")
            
            # Fallback structured response
            return StructuredVisionResponse(
                memory_id=memory_id,
                summary="AI-generated image description available",
                objects=[ObjectDetection(
                    name="Various objects", 
                    position="Throughout scene", 
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

    else:  # Cerebras
        prompt = "Analyze this image for a visually impaired person. Include objects, spatial layout, safety considerations, and navigation aids."
        description = cerebras_query_vision(prompt, image_b64)
        
        return StructuredVisionResponse(
            memory_id=memory_id,
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


@app.post("/vision", response_model=VisionResponse)
async def vision_structured(file: UploadFile = File(...),
                            question:str=Form(default=""),
                            mode:str=Form(default="classic")):
    """
    Upload an image and get structured AI vision analysis using LangChain
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image contents
        contents = await file.read()
        image_b64 = base64.b64encode(contents).decode("utf-8")
        memory_id = str(uuid.uuid4())
        new_memory=await create_visual_memory(image_b64,memory_id)

        if(mode.strip()=="blind"):
            print('blind executed')
      
            response=generate_response_blind(question,current_context=new_memory.detailed_description)
            print('-----',response)
        else:
            print('normalexecuted')
            response=generate_response_normal(question,current_context=new_memory)
        return {
        "description": response,
        "timestamp": datetime.now(),
        "confidence": 0.9  # or any confidence value you want
    }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)