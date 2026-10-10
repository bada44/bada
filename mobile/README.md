# RetroHub Android

Masaüstü arayüzünün aynısı; oyunları telefondaki **Dolphin** (GameCube) ve **NetherSX2/AetherSX2** (PS2) ile açar.

## APK'yı GitHub'dan indir (bilgisayarda kurulum gerekmez)
1. Depoda **Actions → Build → son çalışma → Artifacts → RetroHub-Android** (veya Releases sayfasındaki `RetroHub-Android.apk`).
2. APK'yı telefona at, aç. "Bilinmeyen kaynaklardan yükleme" izni isteyebilir (debug APK olduğu için normaldir).
3. İlk açılışta oyun klasörünü seç; Android klasör iznini kalıcı verir.

## Kendin derlemek istersen
Node.js 20, JDK 17, Android SDK 34 gerekir:

    cd mobile
    npm install
    npm run android
    cd android && ./gradlew assembleDebug     # APK: app/build/outputs/apk/debug/

## Android'de olmayanlar (Android kuralları yüzünden)
Türkçe yama, otomatik 60 FPS kodu ve bulut klasörü yoktur: Android 11+, bir uygulamanın başka bir uygulamanın
veri klasörüne (Dolphin/NetherSX2 ayarları) yazmasına izin vermez. 60 FPS için emülatörün kendi içindeki
**Gecko/Patch** menüsünü kullan.
