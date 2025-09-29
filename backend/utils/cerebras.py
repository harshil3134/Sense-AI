import os
from dotenv import load_dotenv
from cerebras.cloud.sdk import Cerebras

# Load environment variables from .env file
load_dotenv()

# Initialize Cerebras client
api_key = os.environ.get("CEREBRAS_API_KEY")
if not api_key:
    print("⚠️  Warning: CEREBRAS_API_KEY not found in environment variables")
    print("Make sure you have added CEREBRAS_API_KEY to your .env file")
    client = None
else:
    print("✅ Cerebras API key loaded successfully")
    client = Cerebras(api_key=api_key)

def query_vision(prompt: str, image_b64: str) -> str:
    """
    Query Cerebras Llama model with vision capabilities
    """
    if not client:
        return "I can see an image, but I need a valid CEREBRAS_API_KEY to analyze it. Please set your API key in the .env file."
    if not prompt:
        return "prompt missing"
    print('prompt',prompt)
    try:
        chat_completion = client.chat.completions.create(
            model="llama-4-maverick-17b-128e-instruct",
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
            max_tokens=500,
            temperature=0.7
        )
        
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        # Fallback response if API fails
        return f"I can see an image, but I'm having trouble analyzing it right now. Error: {str(e)}"

def query_text(prompt: str) -> str:
    """
    Query Cerebras Llama model for text-only responses
    """
    if not client:
        return "I need a valid CEREBRAS_API_KEY to process text queries. Please set your API key in the .env file."
    
    try:
        chat_completion = client.chat.completions.create(
            model="meta-llama/llama-4-maverick-17b-128e-instruct",
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        return f"Sorry, I'm having trouble processing your request right now. Error: {str(e)}"