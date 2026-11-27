# 构建上下文为仓库根目录（见 docker-compose.yml）
FROM node:22-alpine AS web-build
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
# 生产模式由后端单端口托管前端产物
COPY --from=web-build /web/dist ./web-dist
ENV WEB_DIST=/app/web-dist
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
