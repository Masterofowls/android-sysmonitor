# Android System Monitor

A lightweight Android system monitoring app built with **Tauri v2** + **JavaScript**, featuring Material Design 3 UI and a home screen widget.

## Features

- **CPU Usage** — delta-based reading from `/proc/stat`, updates every 60 seconds while app is open
- **CPU Temperature** — reads from `/sys/class/thermal/thermal_zone*/temp`
- **Memory Usage** — physical RAM + Android Extended Memory (virtual RAM / SwapTotal) via `/proc/meminfo`
- **Material Design 3** — dark theme, animated doughnut gauge, spark line history
- **Home Screen Widget** — tap-to-refresh only, no background polling
- **No background service** — app closes fully, zero battery drain when not in use

## Download

Go to [Releases](../../releases) and download the latest `system-monitor.apk`.

**Install:**
1. Transfer APK to your Android device
2. Enable "Install unknown apps" for your browser/file manager
3. Tap the APK to install

## Build

Builds run automatically via GitHub Actions on every push to `main`.

The workflow:
1. Sets up Java 17, Android SDK, NDK 27, Rust (aarch64-linux-android target)
2. Generates icons from SVG
3. Runs `cargo tauri android init`
4. Patches the generated project with the home screen widget
5. Builds APK with `cargo tauri android build --debug --target aarch64 --apk`
6. Signs with cached auto-generated keystore
7. Uploads to GitHub Releases

## Architecture

```
src/              # Web frontend (HTML + CSS + JS + Chart.js)
src-tauri/
  src/lib.rs      # Rust backend: reads /proc/stat, /proc/meminfo, thermal zones
  tauri.conf.json # App config (minSdkVersion 26)
android-src/
  kotlin/         # StatsWidget.kt - AppWidgetProvider for home screen widget
  res/            # Widget layouts, XML, drawable, strings
scripts/
  patch-android.py # Copies widget files into Tauri-generated Android project
.github/workflows/
  build-android.yml # Full CI/CD pipeline
```

## Requirements

- Android 8.0+ (API 26)
- ARM64 device (aarch64)
