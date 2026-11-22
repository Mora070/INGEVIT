FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
ARG VITE_SYSTEM_VIDEO_URL=""
ENV VITE_SYSTEM_VIDEO_URL=$VITE_SYSTEM_VIDEO_URL
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/assets/logo-white.png ./src/assets/logo-white.png

EXPOSE 3001

CMD ["node", "server/index.mjs"]
