.PHONY: help setup dev dev-light stop \
       infra-up infra-up-all infra-down nominatim-up \
       backend-dev backend-build backend-test \
       admin-install admin-dev admin-build \
       migrate-up migrate-down seed seed-sample seed-timetables \
       simulate \
       mobile-ios mobile-android mobile-install mobile-pods mobile-ts-check \
       docs-dev docs-build docs-install

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
dev: ## Start everything: infra + backend + admin dashboard
	@echo ""
	@echo "  \033[1;32m━━━ Mansariya — Starting Development Environment ━━━\033[0m"
	@echo ""
	@echo "  Starting infrastructure..."
	@docker compose -f infra/docker-compose.yml --env-file infra/.env up -d postgres redis > /dev/null 2>&1
	@until docker exec masariya-postgres pg_isready -U masariya > /dev/null 2>&1; do sleep 1; done
	@echo "  Starting backend API..."
	@cd backend && go run ./cmd/server &
	@echo "  Starting admin dashboard..."
	@cd admin && npm run dev -- --port $(ADMIN_PORT) &
	@echo ""
	@echo "  \033[1;32m━━━ All Services Running ━━━\033[0m"
	@echo ""
	@echo "  \033[1mService              URL\033[0m"
	@echo "  ─────────────────── ──────────────────────────────────"
	@echo "  \033[32mAdmin Dashboard\033[0m      http://localhost:$(ADMIN_PORT)"
	@echo "  \033[32mBackend API\033[0m          http://localhost:$(BACKEND_PORT)"
	@echo "  \033[32mPostgreSQL\033[0m           localhost:$(POSTGRES_PORT)"
	@echo "  \033[32mRedis\033[0m                localhost:$(REDIS_PORT)"
	@echo ""
	@echo "  \033[90mPress Ctrl+C to stop all services\033[0m"
	@echo ""
	@wait

dev-full: ## Start everything including Valhalla + Nominatim (heavy)
	@echo ""
	@echo "  \033[1;32m━━━ Mansariya — Starting Full Environment ━━━\033[0m"
	@echo ""
	@echo "  Starting all infrastructure (this may take a while on first run)..."
	@docker compose -f infra/docker-compose.yml --env-file infra/.env up -d > /dev/null 2>&1
	@until docker exec masariya-postgres pg_isready -U masariya > /dev/null 2>&1; do sleep 1; done
	@echo "  Starting backend API..."
	@cd backend && go run ./cmd/server &
	@echo "  Starting admin dashboard..."
	@cd admin && npm run dev -- --port $(ADMIN_PORT) &
	@echo ""
	@echo "  \033[1;32m━━━ All Services Running ━━━\033[0m"
	@echo ""
	@echo "  \033[1mService              URL\033[0m"
	@echo "  ─────────────────── ──────────────────────────────────"
	@echo "  \033[32mAdmin Dashboard\033[0m      http://localhost:$(ADMIN_PORT)"
	@echo "  \033[32mBackend API\033[0m          http://localhost:$(BACKEND_PORT)"
	@echo "  \033[32mPostgreSQL\033[0m           localhost:$(POSTGRES_PORT)"
	@echo "  \033[32mRedis\033[0m                localhost:$(REDIS_PORT)"
	@echo "  \033[32mValhalla\033[0m             http://localhost:$(VALHALLA_PORT)"
	@echo "  \033[32mNominatim\033[0m            http://localhost:$(NOMINATIM_PORT)"
	@echo ""
	@echo "  \033[90mNote: Valhalla and Nominatim may still be initializing.\033[0m"
	@echo "  \033[90mPress Ctrl+C to stop all services\033[0m"
	@echo ""
	@wait

stop: ## Stop all running services
	@echo "  Stopping infrastructure..."
	@docker compose -f infra/docker-compose.yml down 2>/dev/null || true
	@echo "  Stopping backend and admin processes..."
	@pkill -f "go run ./cmd/server" 2>/dev/null || true
	@pkill -f "vite" 2>/dev/null || true
	@echo "  \033[1;32mAll services stopped.\033[0m"

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

seed: ## Seed database with comprehensive route data (685 routes)
	@echo ""
	@echo "  \033[1;36mSeeding database with comprehensive route data...\033[0m"
	@echo ""
	@echo "  Data source: data/routes_comprehensive.json"
	@echo "  This will insert routes, stops, and polylines."
	@echo ""
	cd backend && go run ./cmd/bootstrap \
		-data ../data/routes_comprehensive.json \
		-db "$${DATABASE_URL}" \
		-nominatim "$${NOMINATIM_URL:-http://localhost:9990}" \
		-osrm "$${OSRM_URL:-https://router.project-osrm.org}"

seed-sample: ## Seed with sample data only (5 routes, fast, no external APIs)
	@echo ""
	@echo "  \033[1;36mSeeding database with sample data (5 routes)...\033[0m"
	@echo ""
	cd backend && go run ./cmd/bootstrap \
		-data ../data/sample-routes.json \
		-db "$${DATABASE_URL}" \
		-nominatim "$${NOMINATIM_URL:-http://localhost:9990}" \
		-osrm "$${OSRM_URL:-https://router.project-osrm.org}"

seed-timetables: ## Seed timetable/departure data
	@echo ""
	@echo "  \033[1;36mSeeding timetable data...\033[0m"
	@echo ""
	@echo "  \033[33mNote: Timetable seeding requires a custom loader (not yet implemented).\033[0m"
	@echo "  Data file: data/timetables.json"
	@echo ""

##@ Simulator
simulate: ## Start GPS simulator (fake buses for testing live tracking)
	cd backend && go run ./cmd/simulator -api "http://localhost:$${PORT:-9900}" -buses 3 -routes 1,2,138,100,120

##@ Mobile (run separately)
mobile-install: ## Install mobile dependencies
	cd mobile && npm install

mobile-ios: ## Run mobile app on iOS simulator
	cd mobile && npx react-native run-ios

mobile-android: ## Run mobile app on Android emulator
	cd mobile && npx react-native run-android

mobile-pods: ## Install iOS CocoaPods
	cd mobile/ios && bundle exec pod install

mobile-ts-check: ## Type-check mobile TypeScript
	cd mobile && npx tsc --noEmit

##@ Documentation
docs-install: ## Install docs dependencies
	cd docs && npm install

docs-dev: ## Start docs dev server (port 3000)
	cd docs && npm run dev

docs-build: ## Build docs for production
	cd docs && npm run build
