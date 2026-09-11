# Billing — one command per job. `make help` lists everything.
.DEFAULT_GOAL := help
SHELL := /bin/bash
PY  := backend/venv/bin/python
PIP := backend/venv/bin/pip
BIN := backend/venv/bin
FRONTEND_PORT ?= 5050
BACKEND_PORT  ?= 9000
DB_PORT       ?= 9432

# Backend tests need a PostgreSQL database (tests/conftest.py builds the schema
# with `alembic upgrade head`). conftest reads .env itself, so a DATABASE_URL
# there is enough; otherwise pass one on the command line (make exports it):
#   make test-backend DATABASE_URL=postgresql://postgres@127.0.0.1:5432/billing_test
# TEST_DATABASE_URL wins over DATABASE_URL when both are set (same as CI).
# SECRET_KEY defaults to a test value inside conftest.

.PHONY: help setup doctor dev-deps e2e-deps hooks dev stop ports test test-backend test-unit test-e2e lint fix typecheck check api-types migrate migration status clean docker

help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Install backend + frontend dependencies, install git hooks
	./scripts/setup.sh local
	@$(MAKE) --no-print-directory e2e-deps
	@$(MAKE) --no-print-directory hooks

doctor: ## Show which interpreters and tools this repo is actually using
	@echo "  repo python   : $$($(PY) --version 2>&1)  ($(PY))"
	@echo "  venv layout   : $$(ls -d backend/venv/lib/python* 2>/dev/null | tr '\n' ' ')"
	@echo "  system python : $$(python3 --version 2>&1)"
	@echo "  node          : $$(node --version 2>/dev/null || echo missing)"
	@echo "  postgres      : $$(pg_isready --version 2>/dev/null || echo 'pg_isready missing')"
	@if ls "$${PLAYWRIGHT_BROWSERS_PATH:-$$HOME/.cache/ms-playwright}"/chromium* >/dev/null 2>&1 \
		|| ls "$$HOME/Library/Caches/ms-playwright"/chromium* >/dev/null 2>&1; then \
		echo "  ✔ playwright chromium"; \
	else \
		echo "  ✘ playwright chromium  MISSING — run: make e2e-deps"; \
	fi
	@for m in ruff pytest pytest_cov alembic psycopg2; do \
		if $(PY) -c "import $$m" >/dev/null 2>&1; then echo "  ✔ $$m"; else echo "  ✘ $$m  MISSING — run: make setup"; fi; \
	done
	@if [ -x "$(BIN)/pre-commit" ] || command -v pre-commit >/dev/null 2>&1; then \
		echo "  ✔ pre-commit"; else echo "  ✘ pre-commit  MISSING — run: make setup"; fi
	@if [ "$$(ls -d backend/venv/lib/python* 2>/dev/null | wc -l | tr -d ' ')" -gt 1 ]; then \
		echo ""; \
		echo "  ⚠ backend/venv holds more than one Python version — that is how tools go missing."; \
		echo "    Fix with: rm -rf backend/venv && make setup"; \
	fi

e2e-deps: ## Ensure Playwright's browser binaries are downloaded
	@cd frontend && npx playwright install chromium

dev-deps: ## Ensure the dev/test toolchain is installed in backend/venv
	@if [ ! -x "$(PY)" ]; then \
		echo "✘ backend/venv is missing or broken. Run: make setup"; exit 1; \
	fi
	@$(PY) -c "import ruff, pytest, pytest_cov" >/dev/null 2>&1 || { \
		echo "→ dev toolchain missing from backend/venv, installing…"; \
		$(PIP) install -q -r backend/requirements-dev.txt; \
	}

hooks: ## Install the git pre-commit / pre-push hooks
	@if [ -x "$(BIN)/pre-commit" ]; then \
		"$(BIN)/pre-commit" install; \
	elif command -v pre-commit >/dev/null 2>&1; then \
		pre-commit install; \
	else \
		echo "  pre-commit not found — run: $(PIP) install pre-commit && make hooks"; \
	fi

dev: ## Run backend + frontend together (docker if available, else local)
	./scripts/dev.sh

ports: ## Show what is holding the dev ports
	@for p in $(BACKEND_PORT) $(FRONTEND_PORT) $(DB_PORT); do \
		pid=$$(lsof -ti tcp:$$p 2>/dev/null); \
		if [ -n "$$pid" ]; then \
			echo "  port $$p → PID $$pid  ($$(ps -p $$pid -o comm= 2>/dev/null))"; \
		else \
			echo "  port $$p → free"; \
		fi; \
	done

stop: ## Free the dev ports (kills whatever is on 9000 and 5050)
	@for p in $(BACKEND_PORT) $(FRONTEND_PORT); do \
		pid=$$(lsof -ti tcp:$$p 2>/dev/null); \
		if [ -n "$$pid" ]; then \
			echo "  killing PID $$pid on port $$p"; kill $$pid 2>/dev/null || true; \
		fi; \
	done; \
	sleep 1; $(MAKE) --no-print-directory ports

test: test-backend test-unit test-e2e ## Backend tests + frontend unit + e2e

test-unit: ## Frontend unit tests only (vitest, pure helpers)
	cd frontend && npm run test

test-e2e: e2e-deps ## End-to-end tests (Playwright); starts a throw-away API on :9100 with db billing_e2e
	./scripts/e2e.sh

test-backend: dev-deps ## Backend tests only, with coverage (needs DATABASE_URL, see top of file)
	cd backend && ../$(PY) -m pytest --cov=app --cov-report=term-missing

lint: dev-deps ## Lint everything (no writes)
	cd backend && ../$(PY) -m ruff check app tests
	cd backend && ../$(PY) -m ruff format --check app tests
	cd frontend && npm run lint

fix: dev-deps ## Auto-fix what can be auto-fixed
	cd backend && ../$(PY) -m ruff check --fix app tests
	cd backend && ../$(PY) -m ruff format app tests
	cd frontend && npm run lint -- --fix

typecheck: ## TypeScript strict typecheck (tsc -b over app + node configs)
	cd frontend && npm run typecheck

check: lint typecheck test ## Everything CI runs, locally

api-types: ## Regenerate frontend/src/types/api.generated.ts from the running API (VITE_API_URL, default :9000)
	cd frontend && npm run generate-api

migrate: ## Apply database migrations
	cd backend && ../$(PY) -m alembic upgrade head

migration: ## Create a migration: make migration m="add x"
	cd backend && ../$(PY) -m alembic revision --autogenerate -m "$(m)"

status: ## Regenerate STATUS.md (version, test/migration counts, open roadmap items)
	./scripts/status.sh

docker: ## Build and run the whole stack
	docker compose up --build

clean: ## Remove caches and build artifacts
	find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/.pytest_cache backend/.ruff_cache backend/coverage.xml backend/.coverage
	rm -rf frontend/dist frontend/test-results frontend/playwright-report frontend/*.tsbuildinfo
