#!/usr/bin/env bash
# État chiffré du robot (jeton Pronote, abonnements, documents) gardé dans la branche « state ».
# Un seul commit, réécrit à chaque passage, pour que le dépôt ne grossisse pas.
set -euo pipefail
DIR="${QG_STATE_DIR:-state}"
REMOTE="${QG_STATE_REMOTE:-https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
case "${1:-}" in
  load)
    rm -rf "$DIR"; mkdir -p "$DIR"; cd "$DIR"
    git init -q -b state
    git config user.name "qg-robot"; git config user.email "qg-robot@users.noreply.github.com"
    git remote add origin "$REMOTE"
    if git fetch -q --depth 1 origin state 2>/dev/null; then git reset -q --hard FETCH_HEAD; echo "État récupéré"; else echo "Premier passage : nouvel état"; fi
    ;;
  save)
    cd "$DIR"
    git add -A
    git commit -q --allow-empty -m "état du robot" 
    git reset -q --soft "$(git commit-tree HEAD^{tree} -m 'état du robot')"
    git -c push.negotiate=false push -q -f origin HEAD:state
    echo "État enregistré"
    ;;
  *) echo "usage: state.sh load|save"; exit 1;;
esac
