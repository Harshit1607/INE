# Base image with pre-installed Playwright Chromium and dependencies
FROM mcr.microsoft.com/playwright:v1.50.1-noble

WORKDIR /app

# Copy backend package configuration
COPY backend/package*.json ./

# Install production dependencies
RUN npm ci

# Copy backend source files and build
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/tests ./tests

RUN npm run build

# Expose backend port
ENV PORT=10000
ENV NODE_ENV=production
ENV HEADLESS=true

EXPOSE 10000

# Start server
CMD ["node", "dist/src/index.js"]
