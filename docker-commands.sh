#!/bin/bash
# ============================================
# Comandos rápidos para Docker
# SDC Transcription App
# ============================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funções auxiliares
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Verificar se .env existe
check_env() {
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        print_info "Creating .env from .env.example..."
        cp .env.example .env
        print_info "Please edit .env file with your configurations"
        exit 1
    fi
}

# Build
build() {
    print_info "Building Docker images..."
    docker compose build
    if [ $? -eq 0 ]; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Start
start() {
    check_env
    print_info "Starting all services..."
    docker compose up -d
    if [ $? -eq 0 ]; then
        print_success "Services started"
        print_info "Frontend: http://localhost"
        print_info "Backend: http://localhost:8000"
        print_info "Health: http://localhost:8000/health"
    else
        print_error "Failed to start services"
        exit 1
    fi
}

# Stop
stop() {
    print_info "Stopping all services..."
    docker compose down
    print_success "Services stopped"
}

# Restart
restart() {
    print_info "Restarting all services..."
    docker compose restart
    print_success "Services restarted"
}

# Logs
logs() {
    if [ -z "$1" ]; then
        docker compose logs -f
    else
        docker compose logs -f $1
    fi
}

# Status
status() {
    docker compose ps
}

# GPU Test (AMD ROCm)
test_gpu() {
    print_info "Testing AMD GPU in backend container..."
    docker compose exec backend rocm-smi
    echo ""
    print_info "Testing PyTorch with ROCm..."
    docker compose exec backend python3 -c "import torch; print(f'PyTorch ROCm available (via CUDA interface): {torch.cuda.is_available()}'); print(f'Device count: {torch.cuda.device_count()}'); print(f'Device name: {torch.cuda.get_device_name(0)}')"
}

# Clean
clean() {
    print_info "Cleaning up..."
    docker compose down -v --rmi all
    print_success "Cleanup complete"
}

# Rebuild
rebuild() {
    print_info "Rebuilding from scratch..."
    docker compose down
    docker compose build --no-cache
    docker compose up -d
    print_success "Rebuild complete"
}

# Shell
shell() {
    if [ -z "$1" ]; then
        docker compose exec backend bash
    else
        docker compose exec $1 bash
    fi
}

# Backup database
backup() {
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    print_info "Creating database backup: $BACKUP_FILE"
    docker compose exec -T database pg_dump -U transcription_user transcription_db > $BACKUP_FILE
    print_success "Backup created: $BACKUP_FILE"
}

# Help
help() {
    echo "SDC Transcription - Docker Commands"
    echo ""
    echo "Usage: ./docker-commands.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build         Build Docker images"
    echo "  start         Start all services"
    echo "  stop          Stop all services"
    echo "  restart       Restart all services"
    echo "  logs [service] View logs (optional: specific service)"
    echo "  status        Show services status"
    echo "  test-gpu      Test AMD GPU (ROCm) in backend"
    echo "  clean         Remove all containers, volumes and images"
    echo "  rebuild       Rebuild everything from scratch"
    echo "  shell [service] Open shell in service (default: backend)"
    echo "  backup        Backup database"
    echo "  help          Show this help"
    echo ""
    echo "Examples:"
    echo "  ./docker-commands.sh start"
    echo "  ./docker-commands.sh logs backend"
    echo "  ./docker-commands.sh test-gpu"
}

# Main
case "$1" in
    build)
        build
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs $2
        ;;
    status)
        status
        ;;
    test-gpu)
        test_gpu
        ;;
    clean)
        clean
        ;;
    rebuild)
        rebuild
        ;;
    shell)
        shell $2
        ;;
    backup)
        backup
        ;;
    help|*)
        help
        ;;
esac
