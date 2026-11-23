#!/usr/bin/env bash
# Surt amb un error si el codi que genera i publica les dades ha canviat a main des del commit
# d'aquesta execució (GITHUB_SHA):
#   .github/codi-de-dades-de-main.sh <còpia del repositori a GITHUB_SHA>
# Una execució de main no ha de deixar de publicar perquè s'hi ha fusionat un canvi que no toca les
# dades (la web, la documentació, la CI). Però una execució antiga, o tornada a llançar, amb un codi de
# dades que ja no és el de main, no ha de publicar: el seu workflow i el seu codi poden ser d'abans
# d'una correcció.
set -euo pipefail
cd "$1"
git fetch --quiet --depth=1 origin main
MAIN=$(git rev-parse FETCH_HEAD)
if [ "$MAIN" != "$GITHUB_SHA" ] && ! git diff --quiet "$GITHUB_SHA" "$MAIN" -- src fonts .nvmrc .github/workflows/dades.yml .github/codi-de-dades-de-main.sh; then
  echo "::error::El codi de les dades ha canviat a main ($MAIN) des de $GITHUB_SHA. Aquesta execució no publica."
  exit 1
fi
