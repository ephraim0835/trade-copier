FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY manager.py .

# The .env file will be mounted at runtime

CMD ["python", "-u", "manager.py"]
