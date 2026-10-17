# Birdsong

Identifies birds by their song, on-device and offline.

The app listens in 3-second windows and gets a new prediction every second. The BirdNET location model narrows results to the species expected at your GPS location and week.

## Sessions, history, and profile

The bottom tabs are **Listen**, **History**, and **Profile**. Start a session with the microphone. Up to three recent bird bubbles appear around it; tap one for details. Stop the microphone to end the session. Sessions with encounters open a summary; empty sessions end without adding a history entry.

History stores sessions and encounters in local SQLite, across restarts and app updates. Each session has species totals, encounter counts, best confidence, a timeline, duration, and actual listening time. **All birds** searches the lifetime collection. A match after a gap of more than four seconds, or after resuming, starts another encounter. Encounters are audio matches, not confirmed sightings or counts of individual birds.

Changing tabs does not stop listening. Leaving the app pauses recording; return to resume or end the session. On an unexpected app exit, the next launch restores the session as interrupted. Listening time is checkpointed every five seconds, so an abrupt process termination may lose the last few seconds; the app never counts time while it was closed.

Profile stores a display name, preset avatar, language, GPS-trail preference, and local-species-filter preference on this device. Choose System, Español, or English. Spanish bird names currently use scientific names because a verified Spanish common-name dataset is not bundled. There are no accounts, backend, sync, or uploads. Uninstalling the app or clearing its data removes local history.

### Optional GPS trail

Enable the trail in Profile before starting a session and grant foreground location access. The app samples while actively listening, not while paused or in the background. Encounters may include the latest fix, its accuracy, and timestamp. Only fixes at most 60 seconds old with reported accuracy within 100 metres are used; location failure does not stop identification.

The summary draws an offline route trace with encounter markers, not a street map. Pauses and GPS gaps are not connected. GPS coordinates are approximate; no online place-name lookup or map tiles are requested. No audio is automatically saved with sessions.

## Run on Android

Plug in your phone with USB debugging enabled, then run:

```sh
npm install
npx expo run:android
```

## Standalone Android APK

With the Android SDK, JDK 17, and generated `android` project available, run in PowerShell:

```powershell
Set-Location android
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64'
```

Set `JAVA_HOME` and `ANDROID_HOME` to those installations. On Windows, include Git for Windows' `usr\bin` directory in the build process's `PATH`; the audio library's build scripts need its Unix tools.

The APK is `android\app\build\outputs\apk\release\app-release.apk` from the repository root. It supports ARM64 phones and x86-64 emulators, and bundles the app and bird models. After installation, identification needs neither Metro nor a connection to your PC. Transfer the APK with Taildrop or USB and allow installation from that source on Android.

Both models are resolved through `expo-asset` to local files before loading. In a release APK, this copies packaged resources into the device cache; it does not fetch models from the internet.

The generated project's default release signing uses the development key. This is a personal-test build, not a store-ready release. Keep the same signing key for updates; use a private release key before public distribution.

## Check the microphone

Start listening and expand **Audio check** below **Your birds**. It starts collapsed; its summary still shows microphone problems and delayed model checks.

On first use, allow microphone access and wait for the system dialog to close. Recording starts only after Birdsong returns to the foreground. Leaving the app during recording still pauses it; permission dialogs while idle do not mark listening as paused.

The location chip shows GPS coordinates and expected species when the local filter is ready. It reports disabled GPS, denied permissions, timeouts, and model errors instead of silently failing. A permanently denied permission opens app settings on tap; tap again after allowing access. Country, state, and province names are not looked up online.

- Volume bars and dBFS come from captured samples. They should change when you speak or clap. Near -100 dBFS means silence; a stalled stream means buffers stopped arriving.
- **BirdNET checks** count completed predictions, not microphone events. The strongest bird candidate explains whether confidence (50% minimum) or the location filter rejected it. Low-confidence candidates are not detections.
- After 3 seconds, **Save last 3s** keeps the latest model-input audio as a local WAV, without boosting its volume. **Replay** stops listening first. Only one clip is kept, across app restarts, until replaced or deleted; the app does not upload it.

For an Android emulator, enable **Virtual microphone uses host audio input** in its extended microphone controls, or run `adb emu avd hostmicon`. Verify changing levels and replay before testing bird identification. If a recording is from another region, turn off the location filter. A real phone is a better field test.

## Bird details

Bird bubbles and History entries open a bottom sheet with names, best confidence, encounter count, and first/latest heard times. Details work offline. Stickers are decorative, not species illustrations. The optional Wikipedia link opens a website and needs internet; the app does not fetch species facts or photos.

Species facts can be bundled in a future offline field guide. Before collecting any, choose a source that permits redistribution, retain its license and attribution, and check image licenses separately. No scraped content is included in this version.

## Layout

- `src/app/`: screens (Expo Router)
- `src/hooks/useBirdListener.ts`: mic stream, rolling window, inference, detections
- `src/hooks/useLocationFilter.ts`: offline GPS and the location species filter
- `src/data/`: SQLite repository, session/encounter rules, route projection
- `src/i18n/`: English and Spanish UI strings
- `src/birdnet/`: model loading and labels
- `assets/models/`: BirdNET v2.4 audio (FP16) and meta models

## Credits

[BirdNET](https://github.com/birdnet-team/BirdNET-Analyzer) is by the K. Lisa Yang Center for Conservation Bioacoustics at the Cornell Lab of Ornithology, and Chemnitz University of Technology. The models are licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), so non-commercial use only. The repository's code license does not replace this model license.
