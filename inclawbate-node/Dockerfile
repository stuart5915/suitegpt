FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y \
    python3 python3-pip curl wget git jq \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Node software
COPY . /app
WORKDIR /app

# Default port for local dashboard
EXPOSE 3000

# Startup: orchestrator manages Inclawbate jobs + external workers
ENTRYPOINT ["python3", "node.py"]
