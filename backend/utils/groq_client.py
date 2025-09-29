import os
from dotenv import load_dotenv
from groq import Groq

# Load environment variables from .env file
load_dotenv()

# Initialize Groq client
api_key = os.environ.get("GROQ_API_KEY")
if not api_key:
    print("⚠️  Warning: GROQ_API_KEY not found in environment variables")
    print("Make sure you have added GROQ_API_KEY to your .env file")
    client = None
else:
    print("✅ Groq API key loaded successfully")
    client = Groq(api_key=api_key)

def query_vision(prompt: str, image_b64: str) -> str:
    """
    Query Groq Llama model with vision capabilities
    """
    if not client:
        return "I can see an image, but I need a valid GROQ_API_KEY to analyze it. Please set your API key in the .env file."
    if not prompt:
        return "prompt missing"
    print('prompt', prompt)
    
    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-maverick-17b-128e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            stop=None
        )
        
        return completion.choices[0].message.content
        
    except Exception as e:
        # Fallback response if API fails
        return f"I can see an image, but I'm having trouble analyzing it right now. Error: {str(e)}"

def query_vision_stream(prompt: str, image_b64: str) -> str:
    """
    Query Groq Llama model with vision capabilities using streaming
    """
    if not client:
        return "I can see an image, but I need a valid GROQ_API_KEY to analyze it. Please set your API key in the .env file."
    if not prompt:
        return "prompt missing"
    
    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-maverick-17b-128e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            temperature=1,
            max_tokens=1024,
            top_p=1,
            stream=True,
            stop=None
        )
        
        # Collect streaming response
        full_response = ""
        for chunk in completion:
            if chunk.choices[0].delta.content:
                full_response += chunk.choices[0].delta.content
        
        return full_response
        
    except Exception as e:
        return f"Error processing streaming request: {str(e)}"

def query_text(prompt: str) -> str:
    """
    Query Groq Llama model for text-only responses
    """
    if not client:
        return "I need a valid GROQ_API_KEY to process text queries. Please set your API key in the .env file."
    
    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-maverick-17b-128e-instruct",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            stop=None
        )
        
        return completion.choices[0].message.content
        
    except Exception as e:
        return f"Sorry, I'm having trouble processing your request right now. Error: {str(e)}"

def query_text_stream(prompt: str) -> str:
    """
    Query Groq Llama model for text-only responses using streaming
    """
    if not client:
        return "I need a valid GROQ_API_KEY to process text queries. Please set your API key in the .env file."
    
    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-maverick-17b-128e-instruct",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=1,
            max_tokens=1024,
            top_p=1,
            stream=True,
            stop=None
        )
        
        # Collect streaming response
        full_response = ""
        for chunk in completion:
            if chunk.choices[0].delta.content:
                full_response += chunk.choices[0].delta.content
        
        return full_response
        
    except Exception as e:
        return f"Error processing streaming request: {str(e)}"