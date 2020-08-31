# https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
FROM node:10-stretch
WORKDIR /opt/dc-chartreuse-server
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV PORT 3000
EXPOSE 3000
CMD [ "node", "server.js" ]
