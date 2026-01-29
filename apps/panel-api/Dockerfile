FROM node:20-alpine
WORKDIR /app

# Copy workspace manifest
COPY package.json ./package.json
COPY apps/panel-api/package.json ./apps/panel-api/package.json

RUN npm install

# Copy source
COPY apps/panel-api ./apps/panel-api

WORKDIR /app/apps/panel-api
RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
