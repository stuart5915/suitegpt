FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY agent.js .
CMD ["node", "agent.js"]
