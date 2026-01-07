# Script pour démarrer les services Docker (PostgreSQL, Redis, MinIO)
# Usage: .\scripts\start-services.ps1

Write-Host "Démarrage des services Docker..." -ForegroundColor Green

# Vérifier si Docker est en cours d'exécution
try {
    docker ps | Out-Null
    Write-Host "✓ Docker est en cours d'exécution" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur: Docker Desktop n'est pas en cours d'exécution!" -ForegroundColor Red
    Write-Host "Veuillez démarrer Docker Desktop et réessayer." -ForegroundColor Yellow
    exit 1
}

# Aller dans le dossier infra
Set-Location -Path "$PSScriptRoot\..\infra"

# Démarrer les services
Write-Host "Démarrage des conteneurs avec docker-compose..." -ForegroundColor Green
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Services démarrés avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Services disponibles:" -ForegroundColor Cyan
    Write-Host "  - PostgreSQL: localhost:5435" -ForegroundColor White
    Write-Host "  - Redis: localhost:6379" -ForegroundColor White
    Write-Host "  - MinIO: http://localhost:9000 (Console: http://localhost:9001)" -ForegroundColor White
    Write-Host "  - Keycloak: http://localhost:8080" -ForegroundColor White
} else {
    Write-Host "✗ Erreur lors du démarrage des services" -ForegroundColor Red
    exit 1
}

# Revenir au dossier racine
Set-Location -Path "$PSScriptRoot\.."

