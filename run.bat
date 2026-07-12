@echo off
docker container prune || exit /b 1
docker compose -f docker-compose.yml down || exit /b 1
docker compose -f docker-compose.yml up --build
