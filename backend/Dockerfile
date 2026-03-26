# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=build /app/dist ./dist
# If you have static assets or other necessary files, copy them here
# COPY --from=build /app/public ./public 

EXPOSE 5000
CMD ["npm", "start"]
