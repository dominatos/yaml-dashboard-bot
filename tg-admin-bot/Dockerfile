# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

# Copy source
COPY src ./src

# Build TS to JS
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Command to run bot
CMD ["npm", "run", "start"]
