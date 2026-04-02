.PHONY: help setup dev dev-full stop status logs \
       infra-up infra-up-all infra-down nominatim-up \
       backend-dev backend-build backend-test \
       admin-install admin-dev admin-build \
       migrate-up migrate-down seed seed-sample seed-timetables \
       simulate \
       mobile-ios mobile-android mobile-install mobile-pods mobile-ts-check \
       docs-dev docs-build docs-install

LOG_DIR := $(CURDIR)/.logs

# Load env files (strip comments/blanks for Make include compatibility)
-include infra/.env.mk
-include backend/.env.mk
export
$(shell grep -hE '^[A-Za-z_][A-Za-z0-9_]*=.+' infra/.env 2>/dev/null > infra/.env.mk || true)
$(shell grep -hE '^[A-Za-z_][A-Za-z0-9_]*=.+' backend/.env 2>/dev/null > backend/.env.mk || true)

# ── Ports (defaults) ──
BACKEND_PORT   ?= 9900
ADMIN_PORT     ?= 5173
DOCS_PORT      ?= 3000
POSTGRES_PORT  ?= 5433
REDIS_PORT     ?= 6379
VALHALLA_PORT  ?= 9992
NOMINATIM_PORT ?= 9990

##@ General
help: ## Show this help
	@echo ""
	@echo "  \033[1;32mMansariya\033[0m — Crowdsource Bus Tracking for Sri Lanka"
	@echo ""
	@echo "  \033[1mUsage:\033[0m make <target>"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} \
		/^##@/ { printf "\n  \033[1;36m%s\033[0m\n", substr($$0, 5) } \
		/^[a-zA-Z_-]+:.*##/ { printf "    \033[32m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

setup: ## First-time setup: copy env files, start infra, migrate, seed
	@echo ""
	@echo "  \033[1;32m━━━ Mansariya — First Time Setup ━━━\033[0m"
	@echo ""
	@echo "  Creating .env files from templates..."
	@cp -n infra/.env.example infra/.env 2>/dev/null || true
	@cp -n backend/.env.example backend/.env 2>/dev/null || true
	@cp -n admin/.env.example admin/.env 2>/dev/null || true
	@cp -n mobile/.env.example mobile/.env 2>/dev/null || true
	@echo "  Starting infrastructure (PostgreSQL + Redis)..."
	@$(MAKE) --no-print-directory infra-up
	@echo ""
	@echo "  Waiting for PostgreSQL..."
	@until docker exec masariya-postgres pg_isready -U masariya > /dev/null 2>&1; do sleep 1; done
	@echo "  Running database migrations..."
	@$(MAKE) --no-print-directory migrate-up
	@echo "  Installing admin dashboard dependencies..."
	@cd admin && npm install --silent
	@echo ""
	@echo "  \033[1;32mSetup complete!\033[0m"
	@echo ""
	@echo "  Next steps:"
	@echo "    make seed        Seed database with route data"
	@echo "    make dev         Start everything (infra + backend + admin)"
	@echo ""

##@ Development
dev: ## Start everything: infra + backend + admin (background, no logs)
	@mkdir -p $(LOG_DIR)
	@echo ""
	@echo "  \033[1;32m━━━ Mansariya — Starting Development Environment ━━━\033[0m"
	@echo ""
	@echo "  Starting infrastructure..."
	@docker compose -f infra/docker-compose.yml --env-file infra/.env up -d postgres redis > /dev/null 2>&1
	@until docker exec masariya-postgres pg_isready -U masariya > /dev/null 2>&1; do sleep 1; done
	@echo "  \033[32m✓\033[0m PostgreSQL ready (localhost:$(POSTGRES_PORT))"
	@echo "  \033[32m✓\033[0m Redis ready (localhost:$(REDIS_PORT))"
	@echo ""
	@echo "  Starting backend API..."
	@cd backend && nohup go run ./cmd/server > $(LOG_DIR)/backend.log 2>&1 & echo $$! > $(LOG_DIR)/backend.pid
	@echo "  \033[32m✓\033[0m Backend starting (http://localhost:$(BACKEND_PORT)) → logs: .logs/backend.log"
	@echo ""
	@echo "  Starting admin dashboard..."
	@cd admin && nohup npm run dev -- --port $(ADMIN_PORT) > $(LOG_DIR)/admin.log 2>&1 & echo $$! > $(LOG_DIR)/admin.pid
	@echo "  \033[32m✓\033[0m Admin starting (http://localhost:$(ADMIN_PORT)) → logs: .logs/admin.log"
	@echo ""
	@echo "  \033[1;32m━━━ All Services Started ━━━\033[0m"
	@echo ""
	@echo "  \033[1mService              URL                              Logs\033[0m"
	@echo "  ─────────────────── ──────────────────────────────── ─────────────────────"
	@echo "  \033[32mAdmin Dashboard\033[0m      http://localhost:$(ADMIN_PORT)           make logs-admin"
	@echo "  \033[32mBackend API\033[0m          http://localhost:$(BACKEND_PORT)           make logs-backend"
	@echo "  \033[32mPostgreSQL\033[0m           localhost:$(POSTGRES_PORT)"
	@echo "  \033[32mRedis\033[0m                localhost:$(REDIS_PORT)"
	@echo ""
	@echo "  \033[90mUse 'make status' to check health  |  'make stop' to stop all\033[0m"
	@echo ""

dev-full: ## Start everything including Valhalla + Nominatim (heavy)
	@mkdir -p $(LOG_DIR)
	@echo ""
	@echo "  \033[1;32m━━━ Mansariya — Starting Full Environment ━━━\033[0m"
	@echo ""
	@echo "  Starting all infrastructure (this may take a while on first run)..."
	@docker compose -f infra/docker-compose.yml --env-file infra/.env up -d > /dev/null 2>&1
	@until docker exec masariya-postgres pg_isready -U masariya > /dev/null 2>&1; do sleep 1; done
	@echo "  \033[32m✓\033[0m PostgreSQL ready (localhost:$(POSTGRES_PORT))"
	@echo "  \033[32m✓\033[0m Redis ready (localhost:$(REDIS_PORT))"
	@echo ""
	@echo "  Starting backend API..."
	@cd backend && nohup go run ./cmd/server > $(LOG_DIR)/backend.log 2>&1 & echo $$! > $(LOG_DIR)/backend.pid
	@echo "  \033[32m✓\033[0m Backend starting (http://localhost:$(BACKEND_PORT)) → logs: .logs/backend.log"
	@echo ""
	@echo "  Starting admin dashboard..."
	@cd admin && nohup npm run dev -- --port $(ADMIN_PORT) > $(LOG_DIR)/admin.log 2>&1 & echo $$! > $(LOG_DIR)/admin.pid
	@echo "  \033[32m✓\033[0m Admin starting (http://localhost:$(ADMIN_PORT)) → logs: .logs/admin.log"
	@echo ""
	@echo "  \033[1;32m━━━ All Services Started ━━━\033[0m"
	@echo ""
	@echo "  \033[1mService              URL                              Logs\033[0m"
	@echo "  ─────────────────── ──────────────────────────────── ─────────────────────"
	@echo "  \033[32mAdmin Dashboard\033[0m      http://localhost:$(ADMIN_PORT)           make logs-admin"
	@echo "  \033[32mBackend API\033[0m          http://localhost:$(BACKEND_PORT)           make logs-backend"
	@echo "  \033[32mPostgreSQL\033[0m           localhost:$(POSTGRES_PORT)"
	@echo "  \033[32mRedis\033[0m                localhost:$(REDIS_PORT)"
	@echo "  \033[32mValhalla\033[0m             http://localhost:$(VALHALLA_PORT)"
	@echo "  \033[32mNominatim\033[0m            http://localhost:$(NOMINATIM_PORT)"
	@echo ""
	@echo "  \033[90mUse 'make status' to check health  |  'make stop' to stop all\033[0m"
	@echo ""

stop: ## Stop all running services
	@echo ""
	@echo "  \033[1;33m━━━ Stopping All Services ━━━\033[0m"
	@echo ""
	@echo "  Stopping backend..."
	@pkill -f "go run ./cmd/server" 2>/dev/null || true
	@pkill -f "exe/server" 2>/dev/null || true
	@lsof -ti:$(BACKEND_PORT) | xargs kill -9 2>/dev/null || true
	@echo "  Stopping admin dashboard..."
	@pkill -f "vite" 2>/dev/null || true
	@lsof -ti:$(ADMIN_PORT) | xargs kill -9 2>/dev/null || true
	@echo "  Stopping infrastructure..."
	@docker compose -f infra/docker-compose.yml down 2>/dev/null || true
	@rm -f $(LOG_DIR)/*.pid
	@echo ""
	@echo "  \033[1;32m✓ All services stopped.\033[0m"
	@echo ""

status: ## Show status of all services
	@echo ""
	@echo "  \033[1;36m━━━ Mansariya — Service Status ━━━\033[0m"
	@echo ""
	@printf "  \033[1m%-20s %-12s %s\033[0m\n" "Service" "Status" "Details"
	@echo "  ─────────────────── ──────────── ──────────────────────────────────"
	@if lsof -ti:$(BACKEND_PORT) > /dev/null 2>&1; then \
		HEALTH=$$(curl -sf http://localhost:$(BACKEND_PORT)/health | grep -o '"status":"ok"' 2>/dev/null); \
		if [ -n "$$HEALTH" ]; then \
			printf "  \033[32m%-20s %-12s %s\033[0m\n" "Backend API" "● running" "http://localhost:$(BACKEND_PORT) (healthy)"; \
		else \
			printf "  \033[33m%-20s %-12s %s\033[0m\n" "Backend API" "● starting" "http://localhost:$(BACKEND_PORT) (not ready)"; \
		fi; \
	else \
		printf "  \033[31m%-20s %-12s %s\033[0m\n" "Backend API" "○ stopped" "port $(BACKEND_PORT) free"; \
	fi
	@if lsof -ti:$(ADMIN_PORT) > /dev/null 2>&1; then \
		printf "  \033[32m%-20s %-12s %s\033[0m\n" "Admin Dashboard" "● running" "http://localhost:$(ADMIN_PORT)"; \
	else \
		printf "  \033[31m%-20s %-12s %s\033[0m\n" "Admin Dashboard" "○ stopped" "port $(ADMIN_PORT) free"; \
	fi
	@if docker exec masariya-postgres pg_isready -U masariya > /dev/null 2>&1; then \
		printf "  \033[32m%-20s %-12s %s\033[0m\n" "PostgreSQL" "● running" "localhost:$(POSTGRES_PORT)"; \
	else \
		printf "  \033[31m%-20s %-12s %s\033[0m\n" "PostgreSQL" "○ stopped" ""; \
	fi
	@if docker exec masariya-redis redis-cli ping > /dev/null 2>&1; then \
		printf "  \033[32m%-20s %-12s %s\033[0m\n" "Redis" "● running" "localhost:$(REDIS_PORT)"; \
	else \
		printf "  \033[31m%-20s %-12s %s\033[0m\n" "Redis" "○ stopped" ""; \
	fi
	@echo ""

##@ Logs
logs-backend: ## Tail backend logs (live)
	@if [ -f $(LOG_DIR)/backend.log ]; then \
		tail -f $(LOG_DIR)/backend.log; \
	else \
		echo "  No backend log found. Start with 'make dev' first."; \
	fi

logs-admin: ## Tail admin dashboard logs (live)
	@if [ -f $(LOG_DIR)/admin.log ]; then \
		tail -f $(LOG_DIR)/admin.log; \
	else \
		echo "  No admin log found. Start with 'make dev' first."; \
	fi

logs-all: ## Tail all service logs (live)
	@if [ -f $(LOG_DIR)/backend.log ] && [ -f $(LOG_DIR)/admin.log ]; then \
		tail -f $(LOG_DIR)/backend.log $(LOG_DIR)/admin.log; \
	else \
		echo "  No logs found. Start with 'make dev' first."; \
	fi

##@ Infrastructure
infra-up: ## Start PostgreSQL + Redis (lightweight, fast)
	docker compose -f infra/docker-compose.yml --env-file infra/.env up -d postgres redis

infra-up-all: ## Start all infra: PostgreSQL, Redis, Valhalla, Nominatim
	docker compose -f infra/docker-compose.yml --env-file infra/.env up -d

infra-down: ## Stop all infrastructure containers
	docker compose -f infra/docker-compose.yml down

nominatim-up: ## Start Nominatim only (first run downloads Sri Lanka data, ~5-10 min)
	docker compose -f infra/docker-compose.yml --env-file infra/.env up -d nominatim
	@echo "  Nominatim importing Sri Lanka data... Check: curl http://localhost:$${NOMINATIM_PORT:-9990}/status"

##@ Backend
backend-dev: ## Run Go backend in dev mode (port 9900)
	cd backend && go run ./cmd/server

backend-build: ## Build Go backend binary
	cd backend && go build -o bin/server ./cmd/server

backend-test: ## Run backend tests
	cd backend && go test ./... -v

##@ Admin Dashboard
admin-install: ## Install admin dashboard dependencies
	cd admin && npm install

admin-dev: ## Start admin dashboard dev server (port 5173)
	cd admin && npm run dev

admin-build: ## Build admin dashboard for production
	cd admin && npm run build

##@ Database
migrate-up: ## Run all pending database migrations
	cd backend && go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		-path migrations -database "$${DATABASE_URL}" up

migrate-down: ## Rollback last migration
	cd backend && go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		-path migrations -database "$${DATABASE_URL}" down 1

bootstrap-admin: ## Create first super admin user (safe to re-run)
	cd backend && go run ./cmd/bootstrap-admin \
		-email "$${ADMIN_EMAIL:-admin@mansariya.lk}" \
		-password "$${ADMIN_PASSWORD:-changeme123}" \
		-name "$${ADMIN_NAME:-Super Admin}"

seed: ## Seed from pre-built SQL dump (fast, no external APIs)
	@echo "  Seeding from data/seed.sql..."
	docker exec -i masariya-postgres psql -U masariya -d masariya < data/seed.sql
	@echo "  Done."

seed-rebuild: ## Full pipeline: Python build → Go bootstrap → pg_dump
	@echo "  Step 1: Building seed data from raw sources..."
	cd data/collector && python3 build_seed.py
	@echo "  Step 2: Seeding database..."
	cd backend && go run ./cmd/bootstrap \
		-seed-data ../data/seed_data.json \
		-db "$${DATABASE_URL}"
	@echo "  Step 3: Creating SQL dump..."
	docker exec masariya-postgres pg_dump -U masariya -d masariya \
		--data-only --inserts \
		-t routes -t stops -t route_stops -t route_patterns -t pattern_stops -t timetables \
		> data/seed.sql
	@echo "  Seed rebuild complete. data/seed.sql updated."

seed-legacy: ## Seed using legacy geocoding (Nominatim + OSRM)
	cd backend && go run ./cmd/bootstrap \
		-data ../data/routes_comprehensive.json \
		-db "$${DATABASE_URL}" \
		-nominatim "$${NOMINATIM_URL:-http://localhost:9990}" \
		-osrm "$${OSRM_URL:-https://router.project-osrm.org}" \
		-osm-stops ../data/osm_bus_stops.json \
		-timetables ../data/timetables.json

seed-sample: ## Seed with sample data only (5 routes, fast)
	cd backend && go run ./cmd/bootstrap \
		-data ../data/sample-routes.json \
		-db "$${DATABASE_URL}" \
		-nominatim "$${NOMINATIM_URL:-http://localhost:9990}" \
		-osrm "$${OSRM_URL:-https://router.project-osrm.org}"

seed-status: ## Show seed pre-flight report (dry run, no inserts)
	cd backend && go run ./cmd/bootstrap \
		-data ../data/routes_comprehensive.json \
		-db "$${DATABASE_URL}" \
		-nominatim "$${NOMINATIM_URL:-http://localhost:9990}" \
		-osrm "$${OSRM_URL:-https://router.project-osrm.org}" \
		-osm-stops ../data/osm_bus_stops.json \
		-timetables ../data/timetables.json \
		-dry-run

seed-timetables: ## Seed timetable data only
	cd backend && go run ./cmd/bootstrap \
		-data ../data/sample-routes.json \
		-db "$${DATABASE_URL}" \
		-nominatim "$${NOMINATIM_URL:-http://localhost:9990}" \
		-osrm "$${OSRM_URL:-https://router.project-osrm.org}" \
		-timetables ../data/timetables.json \
		-skip-empty

seed-osm-stops: ## Seed OSM bus stops only
	cd backend && go run ./cmd/bootstrap \
		-data ../data/sample-routes.json \
		-db "$${DATABASE_URL}" \
		-nominatim "$${NOMINATIM_URL:-http://localhost:9990}" \
		-osrm "$${OSRM_URL:-https://router.project-osrm.org}" \
		-osm-stops ../data/osm_bus_stops.json \
		-skip-empty

##@ Simulator
simulate: ## Start GPS simulator (fake buses for testing live tracking)
	cd backend && go run ./cmd/simulator -api "http://localhost:$${PORT:-9900}" -buses 3 -routes 1,2,138,100,120

##@ Mobile
mobile-install: ## Install mobile dependencies
	cd mobile && npm install

mobile-local: ## Run mobile app connected to LOCAL backend (iOS)
	cd mobile && npm run local:ios

mobile-prod: ## Run mobile app connected to PRODUCTION backend (iOS)
	cd mobile && npm run prod:ios

mobile-local-android: ## Run mobile app connected to LOCAL backend (Android)
	cd mobile && npm run local:android

mobile-prod-android: ## Run mobile app connected to PRODUCTION backend (Android)
	cd mobile && npm run prod:android

mobile-prebuild: ## Prebuild iOS/Android native projects
	cd mobile && npx expo prebuild

mobile-ts-check: ## Type-check mobile TypeScript
	cd mobile && npx tsc --noEmit

##@ Documentation
docs-install: ## Install docs dependencies
	cd docs && npm install

docs-dev: ## Start docs dev server (port 3000)
	cd docs && npm run dev

docs-build: ## Build docs for production
	cd docs && npm run build
