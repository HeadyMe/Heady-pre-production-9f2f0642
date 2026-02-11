# HeadyBuddy Quickstart - Android Companion

## Installation
```powershell
cd headybuddy-mobile
# Build APK
.\gradlew.bat assembleDebug

# Install on connected device
adb install app\build\outputs\apk\debug\app-debug.apk
```

## Configuration
1. **Permissions**:
   - Allow "Display over other apps"
   - Enable notifications
   - Enable background activity
2. **Battery Optimization**:
   - Settings → Battery → Battery Optimization → Don't optimize
3. **Service Connection**:
   - Set backend URL in Settings → `https://sync.headyio.com`

## Usage
- Tap floating bubble to chat
- Long-press for quick actions
- Share to HeadyBuddy from any app
