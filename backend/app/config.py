import os

class Settings:
    """Simple application configuration"""
    
    # API Configuration
    API_VERSION: str = "1.0.0"
    API_TITLE: str = "AI Accessibility Assistant API"
    API_DESCRIPTION: str = "Simple API with health check and vision analysis"
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = ENVIRONMENT == "development"
    
    # Server Configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # AI Model Configuration (for future use)
    CEREBRAS_API_KEY: str = os.getenv("CEREBRAS_API_KEY", "")
    MODEL_API_URL: str = os.getenv("MODEL_API_URL", "https://api.cerebras.ai/v1")
    
    # File Storage
    UPLOAD_PATH: str = os.getenv("UPLOAD_PATH", "./uploads")
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "10485760"))  # 10MB

# Global settings instance
settings = Settings()