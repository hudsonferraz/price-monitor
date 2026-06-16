FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/

# Skip postinstall (prisma generate) until schema files are copied
RUN npm ci --workspace=@price-monitor/worker --include-workspace-root --ignore-scripts

COPY packages ./packages
COPY apps/worker ./apps/worker
COPY turbo.json ./

RUN npm run db:generate --workspace=@price-monitor/database

WORKDIR /app/apps/worker

CMD ["npm", "run", "start"]
