FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Remove sensitive/unnecessary files from image
RUN rm -f start.sh .env* 2>/dev/null || true

# Non-root user for security
RUN useradd -r -s /bin/false moirai && \
    chown -R moirai:moirai /app
USER moirai

# Default port
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/')" || exit 1

CMD ["python", "server.py"]
