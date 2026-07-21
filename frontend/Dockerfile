FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Versão exata do build (o CI injeta a tag, ex.: 0.4.0). Vira NEXT_PUBLIC_* para
# o Next inlinar no bundle e o rodapé refletir o patch realmente buildado (#146).
ARG APP_VERSION=""
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
# Base da API inlinada no bundle (#174). Default = localhost:8000, que serve o
# compose local (frontend:3000 + backend:8000, sem proxy) e qualquer build avulso.
# O deploy atrás de proxy (Caddy) passa NEXT_PUBLIC_API_BASE="" p/ ficar same-origin
# (/api/v1/...). Nunca deixe vazio sem um proxy roteando /api → o Next 404aria.
ARG NEXT_PUBLIC_API_BASE="http://localhost:8000"
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
# Client ID do Google OAuth, inlinado no bundle p/ o botão de login renderizar em
# produção (#16). Como é NEXT_PUBLIC_*, o Next resolve em build time — passar em
# runtime (env_file do compose) não tem efeito. Client ID não é segredo (aparece
# no browser), então vem de uma *repository variable* no CI, não de secret. Vazio
# = botão some e mostra "Login com Google indisponível".
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
