# Frontend Dockerfile for Next.js
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Build for production (optional, for dev we use hot reload)
# RUN npm run build

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "run", "dev"]
