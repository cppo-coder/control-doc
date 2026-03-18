#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
POSTGRES_SERVICE="${POSTGRES_BREW_SERVICE:-postgresql@14}"
PG_READY_BIN="${PG_READY_BIN:-pg_isready}"

echo "==> Proyecto: $ROOT_DIR"
echo "==> Verificando PostgreSQL en ${DB_HOST}:${DB_PORT}"

wait_for_postgres() {
    local attempts=0

    until "$PG_READY_BIN" -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; do
        attempts=$((attempts + 1))

        if [ "$attempts" -ge 15 ]; then
            echo "PostgreSQL no respondió en ${DB_HOST}:${DB_PORT}."
            echo "Revisa el servicio '${POSTGRES_SERVICE}' o exporta POSTGRES_BREW_SERVICE con el nombre correcto."
            exit 1
        fi

        sleep 1
    done
}

if "$PG_READY_BIN" -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    echo "==> PostgreSQL ya está operativo"
else
    echo "==> Iniciando servicio Homebrew: ${POSTGRES_SERVICE}"
    brew services start "$POSTGRES_SERVICE"
    wait_for_postgres
    echo "==> PostgreSQL listo"
fi

if [ ! -d vendor ]; then
    echo "Falta la carpeta vendor. Ejecuta 'composer install' antes de levantar el entorno."
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "Falta la carpeta node_modules. Ejecuta 'npm install' antes de levantar el entorno."
    exit 1
fi

echo "==> Iniciando backend, cola, logs y frontend"
exec composer run dev
