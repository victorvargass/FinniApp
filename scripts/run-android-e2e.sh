#!/usr/bin/env bash

set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP must be set by GitHub Actions}"

EXPO_PUBLIC_E2E_LANGUAGE=es EXPO_PUBLIC_E2E_DISABLE_FEATURE_GUIDES=1 EXPO_PUBLIC_E2E_DISABLE_LOGBOX=1 CI=1 npx expo start --dev-client --localhost > "$RUNNER_TEMP/metro.log" 2>&1 &
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

# The hosted Android emulator can report a transient Quickstep (launcher) ANR
# while Metro is compiling the first development bundle. The FinniApp screen is
# already responsive underneath, but the system dialog blocks Maestro selectors.
# Keep CI focused on application failures instead of launcher instability.
adb shell settings put global hide_error_dialogs 1
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true

node scripts/create-upgrade-fixture.mjs "$RUNNER_TEMP/gastos-v27.db"
adb shell pm clear com.vitoco18.FinniApp
adb push "$RUNNER_TEMP/gastos-v27.db" /data/local/tmp/gastos.db
adb shell run-as com.vitoco18.FinniApp mkdir -p files/SQLite
adb shell run-as com.vitoco18.FinniApp cp /data/local/tmp/gastos.db files/SQLite/gastos.db

run_maestro_flow() {
  local flow="$1"

  # Passing several files to a single Maestro invocation runs them concurrently.
  # A single hosted emulator cannot reliably serve several Android drivers at
  # once, and eventually becomes offline. Keep the critical journeys isolated.
  adb wait-for-device
  if [[ "$(adb get-state)" != "device" ]]; then
    echo "::error::Android emulator is unavailable before $flow"
    exit 1
  fi

  echo "::group::Maestro $flow"
  "$HOME/.maestro/bin/maestro" test "$flow"
  echo "::endgroup::"
}

run_maestro_flow .maestro/upgrade-from-v27.yml

MAESTRO_FLOWS=(
  .maestro/onboarding-full.yml
  .maestro/smoke-financial.yml
  .maestro/debt-partial-payment.yml
  .maestro/credit-installment-reconciliation.yml
  .maestro/settings-and-localization.yml
  .maestro/google-drive-boundary.yml
)

for flow in "${MAESTRO_FLOWS[@]}"; do
  run_maestro_flow "$flow"
done

touch "$RUNNER_TEMP/finniapp-maestro-passed"
