FROM ghcr.io/puppeteer/puppeteer:22.15.0

WORKDIR /app
USER root

COPY package*.json ./
RUN npm install --omit=dev && npm install puppeteer

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["./start.sh"]
