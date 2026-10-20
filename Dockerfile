# 베이스 이미지 (Docker Hub 제한 시 --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-alpine)
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM ${NODE_IMAGE}
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
ENV PORT=3001 STATIC_DIR=/app/client/dist
EXPOSE 3001
CMD ["node", "src/index.js"]
