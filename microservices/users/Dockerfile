FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY index.js ./

# Create directory for database
RUN mkdir -p /app/database/

EXPOSE 3103

CMD ["node", "index.js"]
