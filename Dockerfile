FROM python:3.11-slim

# Install system dependencies for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libjpeg62-turbo \
    libpng16-16 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY main.py .
COPY frontend/ ./frontend/

# Expose default port
EXPOSE 5050

ENV PORT=5050
ENV HOST=0.0.0.0
ENV CARDLENS_NO_BROWSER=1

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5050/health || exit 1

CMD ["python", "main.py", "--host", "0.0.0.0", "--port", "5050", "--no-browser"]
