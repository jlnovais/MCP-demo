#!/usr/bin/env bash
#
# Ingest RAG knowledge documents into LanceDB on the mcp-server deploy host.
#
# Run from the mcp-server deploy root (default: /var/www/mcp-server):
#
#   cd /var/www/mcp-server
#   ./ingest-knowledge.sh
#
# Options:
#   --no-restart     Skip pm2 restart after successful ingestion
#   --help           Show usage
#
# Optional path argument is forwarded to ingest.js (default: ./knowledge).
#
set -euo pipefail

DEPLOY_ROOT="${MCP_SERVER_ROOT:-$(pwd)}"
INGEST_JS="dist/apps/mcp-server/mcp/knowledge/ingest.js"
ENV_FILE=".env"
KNOWLEDGE_DIR="knowledge"
RESTART_APPS=true
CUSTOM_DIR=""

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \?//'
}

log() {
  printf '%s\n' "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-restart)
      RESTART_APPS=false
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      die "Unknown option: $1 (try --help)"
      ;;
    *)
      CUSTOM_DIR="$1"
      shift
      break
      ;;
  esac
done

if [[ $# -gt 0 ]]; then
  die "Unexpected argument(s): $* (try --help)"
fi

if [[ ! -f "$DEPLOY_ROOT/$INGEST_JS" ]]; then
  die "Ingest entrypoint not found: $DEPLOY_ROOT/$INGEST_JS — deploy dist/ first."
fi

if [[ ! -f "$DEPLOY_ROOT/$ENV_FILE" ]]; then
  die "Missing $DEPLOY_ROOT/$ENV_FILE — create it from apps/mcp-server/.env.template."
fi

if ! grep -qE '^VOYAGE_API_KEY=.+' "$DEPLOY_ROOT/$ENV_FILE"; then
  die "VOYAGE_API_KEY is missing or empty in $DEPLOY_ROOT/$ENV_FILE."
fi

SOURCE_DIR="${CUSTOM_DIR:-$KNOWLEDGE_DIR}"
if [[ "$SOURCE_DIR" = /* ]]; then
  RESOLVED_SOURCE="$SOURCE_DIR"
else
  RESOLVED_SOURCE="$DEPLOY_ROOT/$SOURCE_DIR"
fi

if [[ ! -d "$RESOLVED_SOURCE" ]]; then
  die "Knowledge directory not found: $RESOLVED_SOURCE"
fi

shopt -s nullglob
doc_files=("$RESOLVED_SOURCE"/*.{md,markdown,txt})
shopt -u nullglob

if [[ ${#doc_files[@]} -eq 0 ]]; then
  die "No .md, .markdown, or .txt files in $RESOLVED_SOURCE"
fi

log "Deploy root:  $DEPLOY_ROOT"
log "Source docs:  $RESOLVED_SOURCE (${#doc_files[@]} file(s))"
log ""

cd "$DEPLOY_ROOT"

set +e
if [[ -n "$CUSTOM_DIR" ]]; then
  node "$INGEST_JS" "$CUSTOM_DIR"
else
  node "$INGEST_JS"
fi
status=$?
set -e

if [[ $status -ne 0 ]]; then
  die "Ingestion failed (exit $status)."
fi

log ""
log "Ingestion complete."

if [[ "$RESTART_APPS" != true ]]; then
  log "Skipped pm2 restart (--no-restart)."
  exit 0
fi

if ! command -v pm2 >/dev/null 2>&1; then
  log "pm2 not found — restart mcp-server and mcp-client manually."
  exit 0
fi

log "Restarting mcp-server..."
pm2 restart mcp-server

log "Waiting for mcp-server..."
sleep 2

log "Restarting mcp-client..."
pm2 restart mcp-client

log "Done. Refresh the browser and start a new chat to use updated knowledge."
