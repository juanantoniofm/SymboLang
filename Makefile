.DEFAULT_GOAL := help

.PHONY: help up down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Start the stack
	docker compose up -d

down: ## Stop the stack
	docker compose down

fondue: ## Construct the font
	python foundry/build_symbolang.py -o public/fonts/SymbolLang.ttf --masters-dir foundry/masters

