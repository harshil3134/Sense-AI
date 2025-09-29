# AI Accessibility Assistant Backend

A simple FastAPI backend with 2 endpoints: health check and vision analysis.

## Features

- **Health Check**: Simple API status endpoint
- **Vision Analysis**: Upload images and get AI descriptions
- **Clean & Simple**: Only essential functionality
- **Docker Support**: Easy deployment
- **CORS Enabled**: Frontend ready

## API Endpoints

### Health Check
- `GET /health` - Check if API is running

### Vision Analysis  
- `POST /vision` - Upload image and get AI description

## Quick Start

### Local Development

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Using Docker

```bash
docker-compose up --build
```

## Usage Examples

### Health Check
```bash
curl http://localhost:8000/health
```

### Upload Image for Vision Analysis
```bash
curl -X POST "http://localhost:8000/vision" \
  -F "file=@your_image.jpg"
```

## Access Points

- **API**: http://localhost:8000
- **Documentation**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health

That's it! Simple and clean. 🎉