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
