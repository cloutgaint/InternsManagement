FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node . .
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 8000
CMD ["sh","-c","npm run migrate && npm run seed && npm start"]
