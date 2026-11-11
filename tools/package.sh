#!/usr/bin/env bash
# Builds the hand-off folder release/: source zip, AAB, APK, store assets, and the signing key zip.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=release; rm -rf "$OUT"; mkdir -p "$OUT"
cp android/app/build/outputs/bundle/release/app-release.aab "$OUT/PipForestRun-1.0.0-release.aab"
cp android/app/build/outputs/apk/debug/app-debug.apk "$OUT/PipForestRun-1.0.0-test.apk"
git archive --format=zip -o "$OUT/pip-forest-run-source.zip" HEAD
(cd store && zip -qr "../$OUT/store-assets.zip" .)
(cd android && zip -q "../$OUT/SIGNING-KEY-keep-private.zip" upload-keystore.jks keystore.properties)
ls -la "$OUT"
