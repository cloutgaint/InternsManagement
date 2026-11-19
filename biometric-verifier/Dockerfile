# tfjs-node ships glibc binaries, so this uses Debian slim rather than Alpine.
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server.js ./
USER node
ENV BIOMETRIC_VERIFY_HOST=0.0.0.0 BIOMETRIC_VERIFY_PORT=8765
EXPOSE 8765
CMD ["node", "server.js"]
