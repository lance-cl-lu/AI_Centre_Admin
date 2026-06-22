FROM python:3.11-slim
WORKDIR /app
COPY requirements-namespace-share.txt /app/requirements-namespace-share.txt
RUN pip install --no-cache-dir -r /app/requirements-namespace-share.txt
COPY controller /app/controller
CMD ["python", "/app/controller/app.py"]
