FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    python3 \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY requirements-gis.lock.txt ./

RUN python3 -m venv /opt/ingevit-gis \
  && /opt/ingevit-gis/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/ingevit-gis/bin/pip install --no-cache-dir -r requirements-gis.lock.txt

COPY package*.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY scripts/gis ./scripts/gis

RUN chown -R node:node /app /opt/ingevit-gis

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]