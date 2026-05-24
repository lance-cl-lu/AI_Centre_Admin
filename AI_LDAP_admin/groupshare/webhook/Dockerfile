FROM python:3.11-slim
WORKDIR /app
COPY requirements-groupshare.txt /app/requirements-groupshare.txt
RUN pip install --no-cache-dir -r /app/requirements-groupshare.txt
COPY webhook /app/webhook
CMD ["python", "/app/webhook/app.py"]
