FROM node:26-slim

WORKDIR /app

# Install from the lockfile so the image matches CI exactly. .dockerignore
# keeps the host's node_modules out — its native binaries are built for the
# developer's OS, not this image.
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
