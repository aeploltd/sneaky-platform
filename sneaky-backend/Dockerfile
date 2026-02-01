FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S sneaky -u 1001

# Change ownership of the app directory
RUN chown -R sneaky:nodejs /app
USER sneaky

EXPOSE 3001

CMD ["npm", "start"]