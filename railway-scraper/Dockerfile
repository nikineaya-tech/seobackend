FROM mcr.microsoft.com/playwright:v1.59.0-noble

WORKDIR /app/railway-scraper

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PORT=8080

COPY railway-scraper/package*.json ./

RUN npm install --omit=dev

COPY railway-scraper/ ./

EXPOSE 8080

CMD ["npm", "start"]