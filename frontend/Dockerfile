FROM node:20.19.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-bin-links --no-audit --no-fund
COPY . .
RUN node node_modules/vite/bin/vite.js build

FROM nginx:1.27.4-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
