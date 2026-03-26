.PHONY: infra-up infra-down backend-dev backend-build backend-test migrate mobile-android

# Infrastructure
infra-up:
	docker compose -f infra/docker-compose.yml up -d

infra-down:
	docker compose -f infra/docker-compose.yml down

# Backend
backend-dev:
	cd backend && go run ./cmd/server

backend-build:
	cd backend && go build -o bin/server ./cmd/server

backend-test:
	cd backend && go test ./... -v

# Database
migrate-up:
	cd backend && go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		-path migrations -database "$${DATABASE_URL}" up

migrate-down:
	cd backend && go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
		-path migrations -database "$${DATABASE_URL}" down 1

# Bootstrap route data
bootstrap:
	cd backend && go run ./cmd/bootstrap -data ../data/routes.json -db "$${DATABASE_URL}"

# GPS Simulator — mimics real devices pushing GPS data
simulate:
	cd backend && go run ./cmd/simulator -api http://localhost:8000 -buses 3 -routes 1,2,138,100,120

# Mobile
mobile-ios:
	cd mobile && npx react-native run-ios

mobile-android:
	cd mobile && npx react-native run-android

mobile-install:
	cd mobile && npm install

mobile-pods:
	cd mobile/ios && bundle exec pod install

mobile-ts-check:
	cd mobile && npx tsc --noEmit
