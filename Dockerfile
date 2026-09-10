FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /data/uploads/originals /data/uploads/display /data/uploads/thumbnails \
  && chown -R node:node /app /data

ENV NODE_ENV=production
EXPOSE 3000
USER node

CMD ["node", "server.js"]
