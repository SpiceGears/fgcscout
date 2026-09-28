FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS development
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_SITE_OPERATOR=FGC Scout project operator
ARG NEXT_PUBLIC_PRIVACY_CONTACT=
ARG NEXT_PUBLIC_OPERATOR_ADDRESS=
ARG NEXT_PUBLIC_HOSTING_PROVIDER=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SITE_OPERATOR=${NEXT_PUBLIC_SITE_OPERATOR}
ENV NEXT_PUBLIC_PRIVACY_CONTACT=${NEXT_PUBLIC_PRIVACY_CONTACT}
ENV NEXT_PUBLIC_OPERATOR_ADDRESS=${NEXT_PUBLIC_OPERATOR_ADDRESS}
ENV NEXT_PUBLIC_HOSTING_PROVIDER=${NEXT_PUBLIC_HOSTING_PROVIDER}
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next-fgcscout/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next-fgcscout/static ./.next-fgcscout/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
