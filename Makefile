.PHONY: help infra-up infra-up-all infra-down nominatim-up \
       backend-dev backend-build backend-test \
       migrate-up migrate-down bootstrap simulate \
       mobile-ios mobile-android mobile-install mobile-pods mobile-ts-check \
       docs-dev docs-build docs-install \
       setup

# Load env files if present
-include infra/.env
-include backend/.env
export

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

setup: ## First-time setup: copy env files, install deps, start infra, migrate, bootstrap
	@echo "Creating .env files from templates..."
	@cp -n infra/.env.example infra/.env 2>/dev/null || true
	@cp -n backend/.env.example backend/.env 2>/dev/null || true
	@cp -n mobile/.env.example mobile/.env 2>/dev/null || true
	@echo "Starting infrastructure..."
	@$(MAKE) infra-up-all
	@echo ""
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker exec masariya-postgres pg_isready -U masariya > /dev/null 2>&1; do sleep 1; done
	@echo "Running migrations..."
	@$(MAKE) migrate-up
	@echo ""
	@echo "\033[1;32mSetup complete!\033[0m Run 'make backend-dev' to start the API server."

##@ Infrastructure
infra-up: ## Start PostgreSQL + Redis
	docker compose -f infra/docker-compose.yml --env-file infra/.env up -d postgres redis

infra-up-all: ## Start all services (PostgreSQL, Redis, Valhalla, Nominatim)
	docker compose -f infra/docker-compose.yml --env-file infra/.env up -d

infra-down: ## Stop all infrastructure services
	docker compose -f infra/docker-compose.yml down

nominatim-up: ## Start Nominatim geocoding (first run takes ~5-10 min)
	docker compose -f infra/docker-compose.yml --env-file infra/.env up -d nominatim
	@echo "Nominatim importing Sri Lanka data... Check: curl http://localhost:$${NOMINATIM_PORT:-9990}/status"

##@ Backend
backend-dev: ## Run Go backend in dev mode (port 9900)
	cd backend && go run ./cmd/server

backend-build: ## Build Go backend binary
	cd backend && go build -o bin/server ./cmd/server

backend-test: ## Run backend tests
	cd backend && go test ./... -v

##@ Database
migrate-up: ## Run all pending migrations
	cd backend && go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		-path migrations -database "$${DATABASE_URL}" up

migrate-down: ## Rollback last migration
	cd backend && go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		-path migrations -database "$${DATABASE_URL}" down 1

bootstrap: ## Load NTC route data into the database
	cd backend && go run ./cmd/bootstrap \
		-data ../data/routes.json \
		-db "$${DATABASE_URL}" \
		-nominatim "$${NOMINATIM_URL:-http://localhost:9990}" \
		-osrm "$${OSRM_URL:-https://router.project-osrm.org}"

##@ Simulator
simulate: ## Start GPS simulator (fake buses sending GPS data)
	cd backend && go run ./cmd/simulator -api "http://localhost:$${PORT:-9900}" -buses 3 -routes 1,2,138,100,120

##@ Mobile
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

docs-build: ## Build docs for production (static export)
	cd docs && npm run build
