# 吱熊猫 App

The ZhiPanda iOS and Android app, built with Expo (React Native) and expo-router. It reads the
same public API as the website through `@zhipanda/api-client`.

## Run it on a phone (Windows, macOS or Linux)

1. From the repository root, install dependencies once: `npm install`.
2. Start the dev server: `npm run start -w @zhipanda/mobile`.
3. Install **Expo Go** from the App Store on the iPhone, then scan the QR code the dev server
   prints with the iPhone camera. The phone and the computer must be on the same network; if
   they are not, start with `npm run start -w @zhipanda/mobile -- --tunnel`.

No Mac or Xcode is needed for this. Code changes reload on the phone as you save.

The app talks to `https://api.zhipanda.com` by default. To point it at a local API, set
`EXPO_PUBLIC_API_BASE_URL` (for example `http://192.168.1.20:3000`) before starting.

## Checks

- `npm run lint -w @zhipanda/mobile`
- `npm run typecheck -w @zhipanda/mobile`

Both run in CI when files under `apps/mobile/` change (`npm run verify:dev -- --scope mobile`).

## App Store builds

Store builds are made in the cloud with EAS Build, so they also work without a Mac:
`npx eas-cli build --platform ios`. That needs an Expo account and an Apple Developer account;
EAS signs and uploads the build. The bundle identifier is `com.zhipanda.app` (see `app.json`).

Add a native dependency with `npx expo install <package>` so its version matches the Expo SDK.
