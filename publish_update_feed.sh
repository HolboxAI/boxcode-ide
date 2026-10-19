#!/usr/bin/env bash
# shellcheck disable=SC1091
set -euo pipefail

# Pushes the rolling update feed (latest.json) to the update-feed branch so a
# running app can discover a newer build. The app fetches
# ${updateUrl}/${quality}/${platform}/${arch}${target?}/latest.json (see
# patches/11-update-use-github-release.patch's createUpdateURL). Lives in this
# same repo (no HolboxAI/boxcode-ide-versions) because the IDE already reads
# that path.
#
# macOS/Linux publish a single archive entry (no ${target} segment). Windows
# publishes one entry per install target -- archive (.zip), system/user
# (.exe), and msi (.msi) -- because patches/11-update-use-github-release.patch
# routes each installer type to its own ${target} feed path.

if [[ -z "${RELEASE_VERSION:-}" || -z "${VSCODE_ARCH:-}" || -z "${VSCODE_QUALITY:-}" ]]; then
  echo "RELEASE_VERSION, VSCODE_ARCH, and VSCODE_QUALITY are required"
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" && -z "${GH_TOKEN:-}" ]]; then
  echo "Will not publish the update feed because no GITHUB_TOKEN is set"
  exit 0
fi

GITHUB_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN}}"
REPO="${GITHUB_REPOSITORY:-HolboxAI/boxcode-ide}"
FEED_BRANCH="${UPDATE_FEED_BRANCH:-update-feed}"
APP_NAME="${APP_NAME:-Covexcode}"
OS_NAME="${OS_NAME:-osx}"
GH_HOST="${GH_HOST:-github.com}"
TAG="${UPDATE_RELEASE_TAG:-${RELEASE_VERSION}}"

# Map the build OS to the update-feed platform + payload(s). Each entry is
# "platform|target|asset_name" where `target` is empty for the macOS/Linux
# archive feed path (no ${target} segment) and one of archive/system/user/msi
# for Windows. Only the .zip (macOS), .tar.gz (Linux), and Windows installers
# ship the built-in updater; the .deb/.rpm update through the package manager
# and AppImage/Flatpak/Snap use their own update paths, so those formats never
# read this feed.
case "${OS_NAME}" in
  osx)
    TARGETS=("darwin||${APP_NAME}-darwin-${VSCODE_ARCH}-${RELEASE_VERSION}.zip")
    ;;
  linux)
    TARGETS=("linux||${APP_NAME}-linux-${VSCODE_ARCH}-${RELEASE_VERSION}.tar.gz")
    ;;
  windows)
    TARGETS=(
      "win32|archive|${APP_NAME}-win32-${VSCODE_ARCH}-${RELEASE_VERSION}.zip"
      "win32|system|${APP_NAME}Setup-${VSCODE_ARCH}-${RELEASE_VERSION}.exe"
      "win32|user|${APP_NAME}UserSetup-${VSCODE_ARCH}-${RELEASE_VERSION}.exe"
      "win32|msi|${APP_NAME}-${VSCODE_ARCH}-${RELEASE_VERSION}.msi"
    )
    ;;
  *)
    echo "publish_update_feed.sh does not support OS_NAME=${OS_NAME}"
    exit 0
    ;;
esac

if [[ -z "${BUILD_SOURCEVERSION:-}" ]]; then
  if command -v sha1sum >/dev/null 2>&1; then
    BUILD_SOURCEVERSION=$( echo "${RELEASE_VERSION/-*/}" | sha1sum | cut -d' ' -f1 )
  else
    BUILD_SOURCEVERSION=$( echo "${RELEASE_VERSION/-*/}" | shasum -a 1 | cut -d' ' -f1 )
  fi
fi
timestamp=$( node -e 'console.log(Date.now())' )

transformVersion() {
  local version
  version="${1%-insider}"
  if [[ "${1}" == *-insider ]]; then
    version="${version}-insider"
  fi
  echo "${version}"
}

productVersion="$( transformVersion "${RELEASE_VERSION}" )"

# Resolve every target to its feed path + JSON payload *before* cloning the
# feed branch: the assets and checksums live in this CI workspace, not in the
# feed repo. Windows skips a missing payload (arm64 has no .msi; system/user
# exe are not always both produced) rather than failing the whole job, while
# macOS/Linux keep the original hard-fail on a missing asset.
FEED_PATHS=()
FEED_JSONS=()
for entry in "${TARGETS[@]}"; do
  IFS='|' read -r platform target asset_name <<< "${entry}"

  if [[ ! -f "assets/${asset_name}" ]]; then
    if [[ "${OS_NAME}" == "windows" ]]; then
      echo "Skipping ${asset_name}: asset not present in assets/"
      continue
    fi
    echo "Missing assets/${asset_name}"
    exit 1
  fi

  if [[ ! -f "assets/${asset_name}.sha1" || ! -f "assets/${asset_name}.sha256" ]]; then
    echo "Checksums missing for ${asset_name}; running prepare_checksums.sh"
    ./prepare_checksums.sh
  fi

  sha1hash=$( awk '{ print $1 }' "assets/${asset_name}.sha1" )
  sha256hash=$( awk '{ print $1 }' "assets/${asset_name}.sha256" )
  URL="https://${GH_HOST}/${REPO}/releases/download/${TAG}/${asset_name}"
  VERSION_PATH="${VSCODE_QUALITY}/${platform}/${VSCODE_ARCH}${target:+/${target}}"

  JSON_DATA=$( jq -n \
    --arg url "${URL}" \
    --arg name "${RELEASE_VERSION}" \
    --arg version "${BUILD_SOURCEVERSION}" \
    --arg productVersion "${productVersion}" \
    --arg hash "${sha1hash}" \
    --arg timestamp "${timestamp}" \
    --arg sha256hash "${sha256hash}" \
    '{url:$url,name:$name,version:$version,productVersion:$productVersion,hash:$hash,timestamp:$timestamp,sha256hash:$sha256hash}' )

  FEED_PATHS+=("${VERSION_PATH}")
  FEED_JSONS+=("${JSON_DATA}")
done

if [[ "${#FEED_PATHS[@]}" -eq 0 ]]; then
  echo "No assets to publish for OS_NAME=${OS_NAME}"
  exit 0
fi

WORKDIR="$( mktemp -d )"
cleanup() { rm -rf "${WORKDIR}"; }
trap cleanup EXIT

git clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@${GH_HOST}/${REPO}.git" "${WORKDIR}/repo"
cd "${WORKDIR}/repo"

if git fetch origin "${FEED_BRANCH}:${FEED_BRANCH}" 2>/dev/null; then
  git checkout "${FEED_BRANCH}"
else
  git checkout --orphan "${FEED_BRANCH}"
  git rm -rf --ignore-unmatch . >/dev/null 2>&1 || true
fi

for i in "${!FEED_PATHS[@]}"; do
  mkdir -p "${FEED_PATHS[$i]}"
  printf '%s\n' "${FEED_JSONS[$i]}" > "${FEED_PATHS[$i]}/latest.json"
  git add "${FEED_PATHS[$i]}/latest.json"
done

if git diff --cached --quiet; then
  echo "Update feed already has ${RELEASE_VERSION}"
  exit 0
fi

git -c user.name="shivam-holboxai" -c user.email="shivam@holbox.ai" \
  commit -m "CI: ${OS_NAME} feed ${RELEASE_VERSION}"

git push origin "HEAD:${FEED_BRANCH}"
echo "Published ${OS_NAME} feed for ${RELEASE_VERSION} (${#FEED_PATHS[@]} path(s))"
