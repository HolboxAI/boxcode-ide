# macOS distribution plan (Path A vs Path B)

**Status:** Path A live. Path B deferred pending leadership decision.  
**Team / Apple org:** SPRINGTOWNAI LLC (`MSC8P8G9J4`)  
**Last updated:** 2026-10-05

---

## Decision summary

| Path | What it is | Status |
|------|------------|--------|
| **A — Direct download** | Developer ID sign → Apple notarize → ship `.dmg` / `.zip` (GitHub Releases / website) | **Done** (certs + CI secrets + notarized releases) |
| **B — Mac App Store** | Apple Distribution + sandbox + MAS build → App Store Connect review | **Not started** — separate product effort |

**Recommendation:** Keep Path A as the primary macOS channel. Reopen Path B only if App Store discovery is worth engineer-months and sandbox feature cuts.

---

## Path A — what we have

### Already in place

- Certificate: **Developer ID Application: SPRINGTOWNAI LLC (MSC8P8G9J4)** on the Mac keychain and in CI.
- GitHub secrets on `HolboxAI/boxcode-ide`:
  - `CERTIFICATE_OSX_P12_DATA`
  - `CERTIFICATE_OSX_P12_PASSWORD`
  - `CERTIFICATE_OSX_APPLE_ID`
  - `CERTIFICATE_OSX_TEAM_ID`
  - `CERTIFICATE_OSX_APP_PASSWORD`
- Build path: `build/osx/prepare_assets.sh` signs with `@electron/osx-sign`, notarizes via `notarytool`, staples, then builds zip/dmg.
- Template for local reuse: `dev/osx/codesign.env.template`.

### How Path A ships day to day

1. Merge to `main` when CI is green.
2. macOS workflow produces notarized `.zip` + `.dmg` on the versioned GitHub Release.
3. Users download and open normally (Gatekeeper accepts stapled notarization).
4. Optional check: `spctl --assess --type execute -v "/Applications/Boxcode IDE.app"`.

### Path A money

| Item | Cost |
|------|------|
| Apple Developer Program (Organization) | ~$99 USD / year (already paid) |
| Developer ID cert + notarization | $0 |
| App Store commission | N/A |

---

## Path B — Mac App Store (if leadership chooses it)

Path B is **not** a switch on the Path A pipeline. Boxcode IDE is a Code-OSS / VSCodium-style build (`gulp` → `.app` → zip/dmg), not `electron-builder --mac mas`. MAS requires a sandboxed MAS Electron build, different signing, and App Store review.

### Money beyond the $99/yr

| Item | Cost |
|------|------|
| Extra Apple subscription | **$0** (same membership) |
| Certificates / provisioning / listing / review | **$0** |
| If the store listing is **free** | **$0** to Apple beyond membership |
| If users **pay through the App Store** (paid app / IAP) | **15% or 30%** of that revenue to Apple, ongoing |
| Real cost | **Engineering time** + possible contractor/legal/design for store assets |

### Engineering estimate (order of magnitude)

| Work | Rough effort |
|------|----------------|
| First App Store–viable build (sandbox, entitlements, MAS packaging, provisioning, Transporter, review fixes) | **~6–12+ weeks** focused |
| Ongoing | Each capability/OS change risks rejection; every update goes through Apple review |

### Product tradeoff

| | Path A (direct) | Path B (App Store) |
|--|-----------------|---------------------|
| Gatekeeper / trust | Solved via notarization | Apple handles install |
| Discovery | Our site / GitHub / marketing | App Store search |
| Full IDE behavior (any folder, spawn CLI/`boxcode`, extensions, our auto-update) | Kept | **Constrained or rewritten** under App Sandbox |
| Update control | We publish when ready | Apple review each release |
| Revenue (if paid via Apple) | 100% to us (minus payment processor if any) | Apple takes 15–30% |
| Build we already have | Matches Path A | **Cannot** reuse Developer ID–signed app as-is |

### Path B checklist (account + engineering)

**Account / Admin**

1. Confirm membership active; accept pending Program / App Store Connect agreements (Free Apps; Paid Apps only if charging).
2. Create **Apple Distribution** and **Mac Installer Distribution** certificates (not Developer ID).
3. Register App ID / Bundle ID (must match the app, e.g. current product id such as `ai.holbox.Boxcode`).
4. Create a **Mac App Store** provisioning profile; download and embed in the MAS build.
5. Create a **macOS app** record in App Store Connect (metadata, screenshots, privacy, age rating).

**Engineering**

6. Produce a **MAS / sandboxed** macOS build (separate from the notarized Path A artifact).
7. Entitlements for sandbox + helpers; embed provisioning profile; sign with Apple Distribution; pack **`.pkg`**.
8. Redesign or drop behaviors sandbox blocks (unrestricted FS, spawning tools/CLI, some extension/update paths).
9. Upload with **Transporter** → Submit for Review → iterate on rejections.
10. Decide whether Path A downloads remain available for the unrestricted IDE.

---

## Manager-facing one-pager

**Ask:** Keep Path A as default. Only start Path B if we explicitly fund App Store discovery.

**Why not Path B by default**

1. Trust is already solved (notarized Path A).
2. Path B is a sandbox/MAS product project, not a packaging toggle — estimate **6–12+ weeks** plus ongoing review cost.
3. An IDE fights App Sandbox (filesystem, CLI spawn, extensions, updates) → weaker or different product.
4. Aside from $99/yr already paid: **no extra Apple fee** to list; Apple takes **15–30%** only if we charge through the store. The bill is engineer-months and feature compromise.

**Decision:** Stay on Path A, or allocate ~2–3 months and accept sandbox limits for App Store discovery.

---

## Out of scope / do not confuse

- **Developer ID Application** = Path A (outside store). Keep using it for GitHub/website builds.
- **Apple Development** = local debug only; not for shipping.
- **Apple Distribution / Mac Installer** = Path B only.
- Do **not** run `electron-builder --mac mas` against this repo as-is — there is no MAS target wired today.

---

## Related files

- `build/osx/prepare_assets.sh` — Path A sign / notarize / staple / dmg
- `build/osx/sign-app.mjs` — osx-sign entry
- `dev/osx/codesign.env.template` — local secret names
- `.github/workflows/ci-build-macos.yml` — CI wiring for macOS assets
- `docs/BACKLOG.md` — historical Tier-1 signing notes
