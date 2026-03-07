#!/usr/bin/env bash
set -euo pipefail

TARGET_REPO="${1:-$(pwd)}"
PACK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing Heady template pack into: ${TARGET_REPO}"
mkdir -p "${TARGET_REPO}/src/templates/catalog"
mkdir -p "${TARGET_REPO}/src/templates/services"
mkdir -p "${TARGET_REPO}/configs/templates"

cp "${PACK_ROOT}/registry/heady-template-catalog.json" "${TARGET_REPO}/src/templates/catalog/heady-template-catalog.json"
cp "${PACK_ROOT}/registry/scenario-matrix.yaml" "${TARGET_REPO}/configs/templates/scenario-matrix.yaml"
cp "${PACK_ROOT}/templates/schemas/headybee-template.schema.json" "${TARGET_REPO}/src/templates/catalog/headybee-template.schema.json"
cp "${PACK_ROOT}/templates/schemas/headyswarm-template.schema.json" "${TARGET_REPO}/src/templates/catalog/headyswarm-template.schema.json"
cp "${PACK_ROOT}/adapters/node/headybee-template-registry.service.js" "${TARGET_REPO}/src/templates/services/headybee-template-registry.service.js"
cp "${PACK_ROOT}/adapters/node/headyswarm-template-registry.service.js" "${TARGET_REPO}/src/templates/services/headyswarm-template-registry.service.js"
cp "${PACK_ROOT}/adapters/node/autonomous-template-optimizer.js" "${TARGET_REPO}/src/templates/services/autonomous-template-optimizer.js"

echo "Installed canonical catalog, schemas, and services."
echo "Next: wire your route layer to src/templates/services/headybee-template-registry.service.js"
