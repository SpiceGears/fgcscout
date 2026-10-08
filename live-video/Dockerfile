FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg tesseract-ocr tesseract-ocr-eng ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY worker.py managed.py .
RUN useradd --uid 10001 --create-home detector && mkdir /app/state && chown detector:detector /app/state
USER detector
CMD ["python", "worker.py", "--config", "/app/config.json"]
