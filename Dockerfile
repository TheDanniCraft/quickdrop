# First stage: Build the application
FROM oven/bun:slim AS builder

# Set up to use GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/thedannicraft/quickdrop"

# Set the working directory
WORKDIR /app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Build the Next.js application with standalone output
RUN bun run build

# Install node-prune
RUN bun add -g node-prune

# Run node-prune to remove unnecessary files
RUN node-prune

# Remove any other unnecessary files
RUN rm -rf /app/src /app/tests /app/.git

# Second stage: Create a clean, optimized image
FROM oven/bun:distroless AS runner

# Set the working directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lockb ./
COPY --from=builder /app/next.config.mjs ./

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the app
CMD ["node", "server.js"]