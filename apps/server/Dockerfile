FROM node:20-alpine
WORKDIR /app

COPY . .
RUN rm -f package-lock.json && npm install

ENV NODE_ENV=production
WORKDIR /app/apps/server
EXPOSE 8787
CMD ["npm", "run", "start"]
