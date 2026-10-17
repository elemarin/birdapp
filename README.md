# Birdsong

Identifies birds by their song, on-device and offline.

The app listens in 3-second windows and gets a new prediction every second. The BirdNET location model narrows results to the species expected at your GPS location and week.

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

## Your birds

The compact listening bar leaves space for a grid of bird stickers above Audio check. Tap a bird to open a bottom sheet with its common and scientific names, best model confidence, encounter count, and first/last heard times. Drag the sheet up for more room or down to dismiss it. Listening continues while you browse details. An encounter is a match after a gap of more than 4 seconds, not a count of individual birds.

These details work offline. The collection stays in memory until cleared or the app closes; it is not a saved life list. Stickers are decorative, not species illustrations. The optional Wikipedia link opens a website and needs internet; the app does not fetch species facts or photos.

Species facts can be bundled in a future offline field guide. Before collecting any, choose a source that permits redistribution, retain its license and attribution, and check image licenses separately. No scraped content is included in this version.

## Layout

- `src/app/`: screens (Expo Router)
- `src/hooks/useBirdListener.ts`: mic stream, rolling window, inference, detections
- `src/hooks/useLocationFilter.ts`: offline GPS and the location species filter
- `src/birdnet/`: model loading and labels
- `assets/models/`: BirdNET v2.4 audio (FP16) and meta models

## Credits

[BirdNET](https://github.com/birdnet-team/BirdNET-Analyzer) is by the K. Lisa Yang Center for Conservation Bioacoustics at the Cornell Lab of Ornithology, and Chemnitz University of Technology. The models are licensed CC BY-NC-SA 4.0, so non-commercial use only.
