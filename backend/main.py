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
    answer:str=Field(description="Respond this only when user has asked some question else leave it empty strings")
    timestamp: datetime
    confidence: float

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vectorstore = Chroma(
    persist_directory="./vector_db",
    embedding_function=embeddings,
    collection_name="visual_memories"
)



def create_memory_documents(structured_response: StructuredVisionResponse) -> List[Document]:
    """
    Break structured response into granular documents for vectorization.
    Each key (objects, obstacles, landmarks, etc.) becomes its own document.
    """
    documents = []

    # Scene summary & layout
    documents.append(Document(
        page_content=f"Scene Summary: {structured_response.summary}\nLayout: {structured_response.spatial_layout}",
        metadata={"type": "scene", "memory_id": structured_response.memory_id, "timestamp": structured_response.timestamp.isoformat()}
    ))

    # Detailed description
    documents.append(Document(
        page_content=f"Detailed Description: {structured_response.detailed_description}",
        metadata={"type": "description", "memory_id": structured_response.memory_id}
    ))

    # Objects as separate documents
    for obj in structured_response.objects:
        documents.append(Document(
            page_content=f"Object: {obj.name}, Position: {obj.position}, Size: {obj.size or 'unknown'}",
            metadata={
                "type": "object",
                "name": obj.name,
                "position": obj.position,
                "memory_id": structured_response.memory_id,
                "confidence": obj.confidence or structured_response.confidence
            }
        ))

    # Accessibility info
    for obs in structured_response.accessibility_info.obstacles:
        documents.append(Document(
            page_content=f"Obstacle: {obs}",
            metadata={"type": "obstacle", "memory_id": structured_response.memory_id}
        ))

    for lm in structured_response.accessibility_info.landmarks:
        documents.append(Document(
            page_content=f"Landmark: {lm}",
            metadata={"type": "landmark", "memory_id": structured_response.memory_id}
        ))

    for note in structured_response.accessibility_info.safety_notes:
        documents.append(Document(
            page_content=f"Safety Note: {note}",
            metadata={"type": "safety_note", "memory_id": structured_response.memory_id}
        ))

    for tip in structured_response.accessibility_info.navigation_tips:
        documents.append(Document(
            page_content=f"Navigation Tip: {tip}",
            metadata={"type": "navigation_tip", "memory_id": structured_response.memory_id}
        ))

    return documents


def store_visual_memory(structured_response: StructuredVisionResponse):
    """
    Store structured response in vector database as multiple granular documents.
    """
    try:
        documents = create_memory_documents(structured_response)
        vectorstore.add_documents(documents)
        vectorstore.persist()
        print(f"Stored {len(documents)} granular documents for memory_id={structured_response.memory_id}")
    except Exception as e:
        print(f"Error storing visual memory: {e}")


def retrieve_context(query: str, k: int = 3) -> str:
    """
    Retrieve top-k relevant documents for a query and return concatenated context.
    """
    try:
        results = vectorstore.similarity_search(query, k=k)
        context = "\n".join([doc.page_content for doc in results])
        print('prev context',results)
        return context
    except Exception as e:
        print(f"Error retrieving context: {e}")
        return ""

def generate_response_blind(question: str,current_context:str) -> str:
    """
    Generate answer using Cerebras with RAG context via LangChain.
    """
    try:

        if question.strip()=="":
            system_prompt="""You are an AI assistant for blind users. Your goal is to help the user navigate and understand their surroundings using the provided scene information. 

            You will receive structured scene data including objects, spatial layout, accessibility info, and environmental context. 

            Output a clear, concise, and informative description suitable for audio narration. Focus on: 
            - Key objects and their positions
            - Obstacles or potential dangers
            - Landmarks and navigation cues
            - Important spatial relationships

            Do NOT provide unnecessary details. Do not answer any questions in this mode. Keep the narration short, clear, and actionable for a blind person.
            """
            prompt=f"""Here is the structured scene data:
                ${current_context}
            Please generate an audio-friendly narration describing the scene."""
        else:
            system_prompt=f"""
            You are an AI assistant for blind users. Your goal is to answer questions about the user's surroundings based on the provided structured scene data. 

                Use the scene memory to locate objects, describe spatial relationships, or give step-by-step guidance for physical tasks. Provide concise, actionable, and easy-to-understand answers suitable for audio narration. 

                Focus on:
                - Answering the user's question accurately using the context
                - Providing additional navigation or safety details if relevant
                - Avoid inventing information not present in the structured memory
                - Keep it brief and clear """
            prompt=f""" 
                User Question: "{question}"
                Here is the structured scene data for context:
                ${current_context}
                Please generate an audio-friendly response to the user's question."""
        # print('------prompt',prompt)
        # System message for context
        system_message = SystemMessage(
            content=system_prompt
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
        retrieved_context=retrieve_context(question,5)
        print("-------",retrieved_context)
        prompt = f"""
            User Question: "{question}"

            You have access to two types of context:
            - Current context: a description of the most recent image.
            - Previous context: descriptions of images and scenes from the past.

            Use whichever context is most relevant to answer the user's question. If the answer is found in previous context, mention where or when it was seen, and refer to specific details (like object names, locations, or titles) to make your answer more natural and helpful.
            You should never mention unnecessary things like when user asks where is my wallet? ans:I don't know.  dont answer like: wallet is not on desk it may be in your car or ..
            If the answer is not in current context or retrieved context then there is no need to mention it.
            If the answer is not found in any context, reply: "I cannot locate it from current context."

            current context: {current_context}
            previous context: {retrieved_context}
            """

        # System message for context
        system_message = SystemMessage(
            content="""You are a helpful, conversational assistant for a sighted user.
        Answer the user's questions naturally and briefly (1-2 sentences), using details from the provided context.
        If you reference something from previous context, mention where or when it was seen.
        If you cannot find the answer, respond: "I cannot locate it from current context."
        Do not provide step-by-step reasoning or narration—just a direct, friendly answer."""
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
async def create_visual_memory(image_b64: str, memory_id: str,question:str) -> StructuredVisionResponse:
    """Create structured visual memory from image"""

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
    base_prompt="""Analyze this image in detail for a visually impaired person.
                Focus on:
                1. Objects and their spatial relationships
                2. Environmental context and safety
                3. Navigation landmarks and obstacles
                4. Detailed descriptions for understanding the scene
                
                Provide your analysis in the specified JSON format.
                
            """
    if question.strip():
        base_prompt+=f"\n\nUser question: {question}\nAnswer it in the 'answer' field only, keep it short."
    human_message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": base_prompt
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
        # print('----- in create visual-----',llm_response.content)
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
            answer="",
            confidence=0.75
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
        new_memory=await create_visual_memory(image_b64,memory_id,question)
        store_visual_memory(new_memory)

        if(mode.strip()=="blind"):
            print('blind executed')
            response=generate_response_blind(question,current_context=new_memory)
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
# "development apis"
@app.get("/memories")
async def list_memories():
    try:
        # Retrieve up to 50 documents for inspection
        docs = vectorstore.similarity_search("", k=50)
        return [
            {
                "memory_id": doc.metadata.get("memory_id"),
                "type": doc.metadata.get("type"),
                "content": doc.page_content
            }
            for doc in docs
        ]
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/memories/clear")
async def clear_memories():
    try:
        vectorstore.delete(where={})
        vectorstore.persist()
        return {"status": "success", "message": "All memories cleared from vector DB."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)