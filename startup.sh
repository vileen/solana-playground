#!/bin/bash
# Startup script for Render deployment

echo "=== SERVER STARTUP SHELL SCRIPT ==="
echo "Current directory: $(pwd)"
echo "Node version: $(node -v)"
echo "Environment: $NODE_ENV"

# Set default PORT if not provided
if [ -z "$PORT" ]; then
  echo "PORT not set, defaulting to 3001"
  export PORT=3001
else
  echo "Using PORT: $PORT"
fi

# Check for environment variables
if [ -z "$SOLANA_RPC_URL" ] && [ -n "$VITE_SOLANA_RPC_URL" ]; then
  echo "SOLANA_RPC_URL not set but VITE_SOLANA_RPC_URL is available, using it"
  export SOLANA_RPC_URL="$VITE_SOLANA_RPC_URL"
fi

if [ -z "$SOLANA_API_KEY" ] && [ -n "$VITE_SOLANA_API_KEY" ]; then
  echo "SOLANA_API_KEY not set but VITE_SOLANA_API_KEY is available, using it"
  export SOLANA_API_KEY="$VITE_SOLANA_API_KEY"
fi

# List of possible server file locations
POSSIBLE_PATHS=(
  "./dist/backend/server.js"
  "dist/backend/server.js"
  "/opt/render/project/src/dist/backend/server.js"
  "./src/backend/server.js"
  "src/backend/server.js" 
  "./server.js"
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

# If server not found, list directory contents and try alternatives
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
  
  if [ -d "src/backend" ]; then
    echo "Source backend directory:"
    ls -la src/backend
    
    # If we have the TypeScript file but not the JS file, try compiling it
    if [ -f "src/backend/server.ts" ] && [ ! -f "dist/backend/server.js" ]; then
      echo "Found server.ts but not server.js, trying to compile it on the fly..."
      mkdir -p dist/backend
      npx tsc src/backend/server.ts --outDir dist/backend --esModuleInterop --skipLibCheck \
        --target ES2022 --module NodeNext --moduleResolution NodeNext || true
      
      if [ -f "dist/backend/server.js" ]; then
        SERVER_PATH="dist/backend/server.js"
        echo "Successfully compiled server.js to $SERVER_PATH"
      fi
    fi
  fi
  
  # Last resort: try to run the TypeScript file directly with tsx
  if [ -z "$SERVER_PATH" ] && [ -f "src/backend/server.ts" ]; then
    echo "Attempting to run TypeScript file directly with tsx..."
    if npx tsx --version > /dev/null 2>&1; then
      echo "Environment variables set: SOLANA_RPC_URL=$SOLANA_RPC_URL, PORT=$PORT"
      exec npx tsx src/backend/server.ts
      exit $?
    else
      echo "tsx not available, trying to install it..."
      npm install -g tsx
      if [ $? -eq 0 ]; then
        echo "Environment variables set: SOLANA_RPC_URL=$SOLANA_RPC_URL, PORT=$PORT"
        exec npx tsx src/backend/server.ts
        exit $?
      fi
    fi
  fi
  
  echo "Searching for server.js files:"
  find . -name "server.js" 2>/dev/null || echo "No server.js files found"
  
  echo "Searching for server.ts files:"
  find . -name "server.ts" 2>/dev/null || echo "No server.ts files found"
  
  echo "FATAL ERROR: Could not locate or compile server file"
  exit 1
fi

# Run the server
echo "Starting server from: $SERVER_PATH"
echo "Environment variables set: SOLANA_RPC_URL=$SOLANA_RPC_URL, PORT=$PORT"
exec node --experimental-specifier-resolution=node "$SERVER_PATH" 