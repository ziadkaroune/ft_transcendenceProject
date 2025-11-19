#!/bin/bash

echo "🚨 NUCLEAR RESET - This will remove EVERYTHING"

# Stop everything
docker-compose down -v --remove-orphans

# Remove ALL containers
docker rm -f $(docker ps -a -q) 2>/dev/null || true

# Remove ALL images for this project
docker rmi -f $(docker images | grep transcendence | awk '{print $3}') 2>/dev/null || true

# Remove ALL volumes
docker volume rm $(docker volume ls -q) 2>/dev/null || true

# System prune
docker system prune -af --volumes

# Remove database
rm -rf ./database

echo "✅ Complete reset done!"
echo ""
echo "Now rebuild:"
echo "sudo docker-compose up"
