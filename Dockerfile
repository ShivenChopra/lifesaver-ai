# Use official lightweight Python image
FROM python:3.13-slim

# Set working directory inside container
WORKDIR /app

# Install dependencies first (leverage build cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Expose default port (Cloud Run sets PORT automatically, fallback to 8080)
EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0

# Start server
CMD ["python", "main.py"]
