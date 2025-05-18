#!/bin/bash
# Startup script for Render deployment

echo "=== SERVER STARTUP SHELL SCRIPT ==="
echo "Current directory: $(pwd)"
echo "Node version: $(node -v)"

# List of possible server file locations
POSSIBLE_PATHS=(
  "./dist/backend/server.js"
  "dist/backend/server.js"
  "/opt/render/project/src/dist/backend/server.js"
)

# Copy dist directory to Render's expected location
mkdir -p /opt/render/project/src/dist || true
cp -R ./dist/* /opt/render/project/src/dist/ || true

# Find the server file
SERVER_PATH=""
for path in "${POSSIBLE_PATHS[@]}"; do
  echo "Checking path: $path"
  if [ -f "$path" ]; then
    SERVER_PATH="$path"
    echo "Found server at: $path"
    break
  fi
done

# If server not found, list directory contents
if [ -z "$SERVER_PATH" ]; then
  echo "Could not find server.js in any of the expected locations"
  echo "Listing directory contents:"
  
  echo "Root directory:"
  ls -la
  
  if [ -d "dist" ]; then
    echo "Dist directory:"
    ls -la dist
    
    if [ -d "dist/backend" ]; then
      echo "Backend directory:"
      ls -la dist/backend
    fi
  fi
  
  echo "Opt directory:"
  ls -la /opt/render/project/src/dist 2>/dev/null || echo "Not accessible"
  
  # Try one last approach - find the file anywhere
  echo "Searching for server.js files:"
  find . -name "server.js" 2>/dev/null || echo "No server.js files found"
  
  exit 1
fi

# Run the server
echo "Starting server from: $SERVER_PATH"
exec node --experimental-specifier-resolution=node "$SERVER_PATH" 