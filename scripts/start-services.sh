#!/bin/bash
# Script pour démarrer les services Docker (PostgreSQL, Redis, MinIO)
# Usage: ./scripts/start-services.sh

echo "Démarrage des services Docker..."

# Vérifier si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
    echo "✗ Erreur: Docker n'est pas en cours d'exécution!"
    echo "Veuillez démarrer Docker et réessayer."
    exit 1
fi

echo "✓ Docker est en cours d'exécution"

# Aller dans le dossier infra
cd "$(dirname "$0")/../infra"

# Démarrer les services
echo "Démarrage des conteneurs avec docker-compose..."
docker-compose up -d

if [ $? -eq 0 ]; then
    echo "✓ Services démarrés avec succès!"
    echo ""
    echo "Services disponibles:"
    echo "  - PostgreSQL: localhost:5435"
    echo "  - Redis: localhost:6379"
    echo "  - MinIO: http://localhost:9000 (Console: http://localhost:9001)"
    echo "  - Keycloak: http://localhost:8080"
else
    echo "✗ Erreur lors du démarrage des services"
    exit 1
fi

# Revenir au dossier racine
cd - > /dev/null

