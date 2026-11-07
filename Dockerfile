FROM node:22-bookworm-slim AS services
WORKDIR /app
COPY contracts/package*.json ./contracts/
RUN npm ci --prefix contracts
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --omit=dev
COPY contracts ./contracts
COPY backend ./backend
COPY shared ./shared
COPY package.json ./
RUN npm run contracts:compile
CMD ["node", "backend/docker/server.mjs"]

FROM node:22-bookworm-slim AS frontend
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package*.json frontend/.npmrc ./frontend/
RUN npm ci --prefix frontend
COPY frontend ./frontend
COPY --from=services /app/backend ./backend
COPY --from=services /app/contracts ./contracts
COPY scripts ./scripts
COPY package.json ./
COPY shared ./shared
ARG NEXT_PUBLIC_PRIVY_APP_ID=""
ARG NEXT_PUBLIC_PRIVY_CLIENT_ID=""
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_PRIVY_CLIENT_ID=$NEXT_PUBLIC_PRIVY_CLIENT_ID
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
RUN npm run build --prefix frontend
ENV NODE_ENV=production
WORKDIR /app/frontend
USER node
EXPOSE 3000
CMD ["npm", "start", "--", "--hostname", "0.0.0.0"]
