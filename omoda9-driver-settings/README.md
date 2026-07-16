# Omoda 9 Driver Settings (learning project)

A small Kotlin + Jetpack Compose Android app built for personal learning. It
recreates the "Driver Settings" flow found in aftermarket DMS (Driver
Monitoring System) companion apps — the kind paired with ADAS/dashcam boxes
installed alongside multimedia head units:

- **Drivers** — add, select (make active), and delete driver profiles.
- **Alarm Settings** — per-driver DMS alarm toggles (forward collision
  warning, fatigue alert with sensitivity, distraction alert, lane departure
  warning, smoking detection, seatbelt reminder).
- **Settings** — a "Manually select driver" switch: when on, a driver-select
  popup appears on ignition instead of silently auto-applying the last active
  driver's settings, plus a demo "Simulate driving" switch that blocks
  changing the active driver while "driving" (same guard the source app has).

State is persisted locally on-device with Jetpack DataStore (no backend, no
real vehicle integration — this is a UI/architecture learning exercise, not a
production DMS app).

## Dashboard notification (car-launcher-style quick actions)

Also included: a lightweight, non-privileged take on the "quick popup"
pattern used by full car-launcher apps (the kind that replace an Android
head unit's home screen) — **without** any of the system/privileged
permissions those apps use (no device admin, no accessibility-service screen
takeover, no notification-listener snooping, no silent background installs).
Everything here uses permissions a user grants through a normal Settings
toggle:

- `CarDashboardService` — a foreground service (`FOREGROUND_SERVICE_SPECIAL_USE`)
  that posts a persistent, low-priority notification with three quick-action
  buttons: **Driver**, **A/C**, **Drive Mode**.
- Each button opens a small translucent popup Activity (`popup/`) —
  `DriverSelectPopupActivity` (backed by the real, persisted driver list),
  `AcPopupActivity` (power + temperature, demo state), and
  `DriveModePopupActivity` (Normal/Eco/Sport/Snow + EV-Hybrid toggle, demo
  state). They're plain translucent activities, not `SYSTEM_ALERT_WINDOW`
  overlays.
- `BootReceiver` restarts the dashboard notification on device boot
  (`RECEIVE_BOOT_COMPLETED`) once you've started it manually at least once
  from the Settings tab.
- Posting the notification asks for `POST_NOTIFICATIONS` (Android 13+) the
  normal way, via a runtime permission prompt.

## Stack

- Kotlin 2.0, Jetpack Compose (Material 3)
- AndroidX DataStore Preferences + kotlinx.serialization for persistence
- Single-activity, ViewModel + StateFlow

## Building

Open this folder (`omoda9-driver-settings/`) directly in Android Studio
(Koala+) and let it sync, or from the command line:

```
./gradlew assembleDebug
```

Requires an installed Android SDK (compileSdk 35) — set `ANDROID_HOME` or let
Android Studio configure `local.properties` for you. This project was
authored in a sandboxed environment without the Android SDK or access to
Google's Maven repo, so it has **not** been built/run here — review it in
Android Studio before relying on it.

A GitHub Actions workflow (`.github/workflows/build-omoda9-driver-settings-apk.yml`)
builds a debug APK on every push to this branch under this path, and
uploads it as a workflow run artifact.
