#!/bin/bash

# Bun Hono Server 部署脚本
# 支持多种部署方式选择

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
}

# 显示部署选项
show_menu() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} Bun Hono Server 部署脚本${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    echo "请选择部署方式："
    echo "1) 开发环境 (本地 + 开发用 Redis)"
    echo "2) 生产环境 (外部数据库 + Redis)"
    echo "3) 仅应用服务 (连接外部服务)"
    echo "4) 停止所有服务"
    echo "5) 查看服务状态"
    echo "6) 查看日志"
    echo "0) 退出"
    echo ""
}

# 开发环境部署
deploy_dev() {
    log_info "部署开发环境..."
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        log_warning ".env 文件不存在，正在创建默认配置..."
        cp .env.example .env 2>/dev/null || log_warning "请手动创建 .env 文件"
    fi
    
    log_info "启动开发环境服务 (包含 Redis)..."
    docker-compose --profile dev up -d --build
    
    log_success "开发环境部署完成！"
    log_info "访问地址: http://localhost:3000"
    log_info "Redis 端口: 6380"
}

# 生产环境部署
deploy_prod() {
    log_info "部署生产环境..."
    
    # 检查生产环境配置文件
    ENV_FILE="/root/envs/hono/.env"
    LOCAL_ENV_FILE=".env.prod"
    
    if [ -f "$ENV_FILE" ]; then
        log_info "使用服务器配置文件: $ENV_FILE"
    elif [ -f "$LOCAL_ENV_FILE" ]; then
        log_info "使用本地生产配置文件: $LOCAL_ENV_FILE"
        # 更新 docker-compose.prod.yml 使用本地文件
        sed -i.bak "s|/root/envs/hono/.env|.env.prod|g" docker-compose.prod.yml
    else
        log_warning "生产环境配置文件不存在"
        log_info "请执行以下步骤："
        echo "1. 复制示例配置: cp .env.prod.example .env.prod"
        echo "2. 编辑配置文件: vim .env.prod"
        echo "3. 重新运行部署脚本"
        exit 1
    fi
    
    log_info "启动生产环境服务..."
    docker-compose -f docker-compose.prod.yml up -d --build
    
    log_success "生产环境部署完成！"
    log_info "访问地址: http://localhost:3000"
}

# 仅应用服务部署
deploy_app_only() {
    log_info "部署仅应用服务..."
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        log_warning ".env 文件不存在，请先创建配置文件"
        exit 1
    fi
    
    log_info "启动应用服务..."
    docker-compose up -d app --build
    
    log_success "应用服务部署完成！"
    log_info "访问地址: http://localhost:3000"
}

# 停止所有服务
stop_services() {
    log_info "停止所有服务..."
    
    docker-compose down 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    docker-compose --profile dev down 2>/dev/null || true
    
    log_success "所有服务已停止"
}

# 查看服务状态
show_status() {
    log_info "服务状态:"
    echo ""
    docker-compose ps 2>/dev/null || echo "未找到运行中的开发环境服务"
    echo ""
    docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "未找到运行中的生产环境服务"
}

# 查看日志
show_logs() {
    echo "请选择要查看的日志:"
    echo "1) 开发环境日志"
    echo "2) 生产环境日志"
    echo "3) 应用服务日志"
    echo ""
    read -p "请输入选择 (1-3): " log_choice
    
    case $log_choice in
        1)
            log_info "查看开发环境日志 (Ctrl+C 退出)..."
            docker-compose logs -f app
            ;;
        2)
            log_info "查看生产环境日志 (Ctrl+C 退出)..."
            docker-compose -f docker-compose.prod.yml logs -f app
            ;;
        3)
            log_info "查看应用服务日志 (Ctrl+C 退出)..."
            docker logs -f bun-hono-server 2>/dev/null || docker logs -f bun-hono-server-prod 2>/dev/null || log_error "未找到运行中的应用服务"
            ;;
        *)
            log_error "无效选择"
            ;;
    esac
}

# 主函数
main() {
    check_docker
    
    while true; do
        show_menu
        read -p "请输入选择 (0-6): " choice
        echo ""
        
        case $choice in
            1)
                deploy_dev
                ;;
            2)
                deploy_prod
                ;;
            3)
                deploy_app_only
                ;;
            4)
                stop_services
                ;;
            5)
                show_status
                ;;
            6)
                show_logs
                ;;
            0)
                log_info "退出部署脚本"
                exit 0
                ;;
            *)
                log_error "无效选择，请重新输入"
                ;;
        esac
        
        echo ""
        read -p "按回车键继续..."
        clear
    done
}

# 如果脚本带参数直接执行对应功能
if [ $# -gt 0 ]; then
    case $1 in
        "dev")
            check_docker
            deploy_dev
            ;;
        "prod")
            check_docker
            deploy_prod
            ;;
        "app")
            check_docker
            deploy_app_only
            ;;
        "stop")
            check_docker
            stop_services
            ;;
        "status")
            check_docker
            show_status
            ;;
        "logs")
            check_docker
            show_logs
            ;;
        *)
            echo "用法: $0 [dev|prod|app|stop|status|logs]"
            echo "或者不带参数运行交互式菜单"
            ;;
    esac
else
    main
fi