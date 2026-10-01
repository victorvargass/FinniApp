#!/usr/bin/env bash

set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP must be set by GitHub Actions}"

EXPO_PUBLIC_E2E_LANGUAGE=es CI=1 npx expo start --dev-client --localhost > "$RUNNER_TEMP/metro.log" 2>&1 &
METRO_PID=$!
trap 'kill "$METRO_PID" 2>/dev/null || true' EXIT

for attempt in {1..60}; do
  if curl -fsS http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    break
  fi
  if [[ "$attempt" -eq 60 ]]; then
    cat "$RUNNER_TEMP/metro.log"
    exit 1
  fi
  sleep 1
done

adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081

node scripts/create-upgrade-fixture.mjs "$RUNNER_TEMP/gastos-v27.db"
adb shell pm clear com.vitoco18.FinniApp
adb push "$RUNNER_TEMP/gastos-v27.db" /data/local/tmp/gastos.db
adb shell run-as com.vitoco18.FinniApp mkdir -p files/SQLite
adb shell run-as com.vitoco18.FinniApp cp /data/local/tmp/gastos.db files/SQLite/gastos.db

"$HOME/.maestro/bin/maestro" test .maestro/upgrade-from-v27.yml
"$HOME/.maestro/bin/maestro" test \
  .maestro/onboarding-full.yml \
  .maestro/smoke-financial.yml \
  .maestro/debt-partial-payment.yml \
  .maestro/credit-installment-reconciliation.yml \
  .maestro/settings-and-localization.yml \
  .maestro/google-drive-boundary.yml

touch "$RUNNER_TEMP/finniapp-maestro-passed"
