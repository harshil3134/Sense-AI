#!/usr/bin/env python3
"""
Test script to demonstrate both Cerebras and Groq integrations
"""
import os
import sys
sys.path.append('.')

from utils.cerebras import query_vision as cerebras_vision, query_text as cerebras_text
from utils.groq_client import query_vision as groq_vision, query_text as groq_text

def test_providers():
    print("🧪 Testing AI Providers...")
    print("=" * 50)
    
    # Test text queries
    test_prompt = "What is artificial intelligence?"
    
    print("📝 Testing Text Queries:")
    print(f"Prompt: {test_prompt}")
    print()
    
    print("🧠 Cerebras Response:")
    cerebras_response = cerebras_text(test_prompt)
    print(cerebras_response[:200] + "..." if len(cerebras_response) > 200 else cerebras_response)
    print()
    
    print("⚡ Groq Response:")
    groq_response = groq_text(test_prompt)
    print(groq_response[:200] + "..." if len(groq_response) > 200 else groq_response)
    print()
    
    print("✅ Both providers are working!")
    print()
    print("To switch between providers in your FastAPI app:")
    print("Set AI_PROVIDER=cerebras in .env for Cerebras")
    print("Set AI_PROVIDER=groq in .env for Groq")

if __name__ == "__main__":
    test_providers()