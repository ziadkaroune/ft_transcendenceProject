FROM node:20-alpine

# Add curl and CA certs for TLS
RUN apk add --no-cache curl ca-certificates && update-ca-certificates

WORKDIR /app

# Prefer IPv4 for DNS resolution to avoid ETIMEDOUT on IPv6-only resolutions
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY index.js ./

# Create directory for database
RUN mkdir -p /app/database/

EXPOSE 3105

CMD ["node", "index.js"]