FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Whisper needs ffmpeg at runtime. Piper runtime is installed below.
# requirements.txt includes a git-based dependency (pyswahili).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg espeak-ng libespeak1 git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Linux Piper runtime (binary + phoneme data).
RUN mkdir -p /opt/piper \
    && curl -fsSL "https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz" \
    | tar -xz -C /opt/piper --strip-components=1 \
    && if [ -x /opt/piper/piper ]; then ln -sf /opt/piper/piper /usr/local/bin/piper; \
       elif [ -x /opt/piper/piper/piper ]; then ln -sf /opt/piper/piper/piper /usr/local/bin/piper; \
       else echo "Piper executable not found after extraction" && exit 1; fi

# Download Piper voice models used by the app (Swahili + English).
RUN mkdir -p /app/models/piper \
    && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium.onnx" -o /app/models/piper/sw_CD-lanfrica-medium.onnx \
    && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium.onnx.json" -o /app/models/piper/sw_CD-lanfrica-medium.onnx.json \
    && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx" -o /app/models/piper/en_US-lessac-medium.onnx \
    && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" -o /app/models/piper/en_US-lessac-medium.onnx.json

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip "setuptools<81" wheel
RUN pip install --no-cache-dir --no-build-isolation --extra-index-url https://download.pytorch.org/whl/cpu -r /app/requirements.txt

COPY backend /app

ENV APP_ENV=production
ENV FRONTEND_ORIGIN=*
ENV SQLITE_DB_PATH=/tmp/swahili_ide.db
ENV TTS_PROVIDER=piper
ENV PIPER_EXECUTABLE_PATH=/usr/local/bin/piper
ENV PIPER_MODEL_PATH=/app/models/piper/sw_CD-lanfrica-medium.onnx
ENV PIPER_MODEL_CONFIG_PATH=/app/models/piper/sw_CD-lanfrica-medium.onnx.json
ENV PIPER_EN_MODEL_PATH=/app/models/piper/en_US-lessac-medium.onnx
ENV PIPER_EN_MODEL_CONFIG_PATH=/app/models/piper/en_US-lessac-medium.onnx.json

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
