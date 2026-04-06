# Use the official Bun image
FROM oven/bun:1.1 AS base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Expose the configured SMTP port
EXPOSE 587

# Run the app
CMD ["bun", "run", "src/index.ts"]
