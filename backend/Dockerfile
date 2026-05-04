# Use a lightweight Python 3.10 base image
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser and its system dependencies
RUN playwright install chromium
RUN playwright install-deps

# Copy the rest of your backend code
COPY . .

# Expose the port (Render sets the PORT env variable automatically)
EXPOSE 8000

# Start the FastAPI app using Uvicorn
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
