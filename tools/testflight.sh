#!/usr/bin/env bash
# Archives apps/ios (Release) and uploads it to TestFlight.
# Needs Xcode signed in to team 95YDC2AP63 (Xcode → Settings → Accounts).
# Xcode creates the distribution certificate itself.
# The build number is the date and time (YYYYMMDDHHMM), so it always goes up.
# Usage: tools/testflight.sh [--force]   (--force skips the clean-main check)
set -euo pipefail

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *)
      echo "Unknown argument: $arg (usage: $0 [--force])" >&2
      exit 1
      ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/ios"
xcodegen generate

if [[ "$FORCE" -eq 0 ]]; then
  if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
    echo "Refusing: uncommitted changes in the working tree (use --force to override)." >&2
    exit 1
  fi
  git -C "$ROOT" fetch --quiet origin main
  if [[ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$ROOT" rev-parse origin/main)" ]]; then
    echo "Refusing: HEAD is not origin/main (use --force to override)." >&2
    exit 1
  fi
  if [[ -e "$ROOT/apps/ios/Config/Local.xcconfig" ]]; then
    echo "Refusing: Config/Local.xcconfig exists and can override the team or bundle id (use --force to override)." >&2
    exit 1
  fi
fi

BUILD="$(date +%Y%m%d%H%M)"
WORK="$(mktemp -d)"
cleanup() {
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    rm -rf "$WORK"
  else
    echo "Failed (exit $rc). Work directory kept: $WORK" >&2
  fi
}
trap cleanup EXIT

# The team is pinned on the command line. The bundle id can't be: command-line
# settings reach the package bundles too, so they would get the app's id and
# the upload would fail. That is why a Local.xcconfig is refused above.
xcodebuild -project Yebeyt.xcodeproj -scheme Yebeyt -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$WORK/Yebeyt.xcarchive" \
  -derivedDataPath "$WORK/dd" \
  -allowProvisioningUpdates \
  CURRENT_PROJECT_VERSION="$BUILD" \
  DEVELOPMENT_TEAM=95YDC2AP63 \
  archive

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
  "$WORK/Yebeyt.xcarchive/Products/Applications/Yebeyt.app/Info.plist")"

cat > "$WORK/export.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>upload</string>
	<key>teamID</key>
	<string>95YDC2AP63</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>manageAppVersionAndBuildNumber</key>
	<false/>
</dict>
</plist>
PLIST

xcodebuild -exportArchive \
  -archivePath "$WORK/Yebeyt.xcarchive" \
  -exportOptionsPlist "$WORK/export.plist" \
  -exportPath "$WORK/up" \
  -allowProvisioningUpdates

echo "Uploaded $VERSION ($BUILD)"
