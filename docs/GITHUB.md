# GitHub'a koyma ve otomatik derleme

## 1. Depoyu oluştur
1. github.com → **New repository** (public veya private) → boş oluştur.
2. Bu klasörde (zip'i çıkardığın yerde) terminal:

       git init
       git add .
       git commit -m "RetroHub"
       git branch -M main
       git remote add origin https://github.com/KULLANICI/DEPO.git
       git push -u origin main

   `.gitignore` hazır: `node_modules`, `dist`, `mobile/android` gönderilmez (GitHub 100 MB'tan büyük dosyayı reddeder).

## 2. Windows .exe ve Android .apk otomatik derlenir
- **Her `main` gönderiminde:** Actions sekmesi → *Build* → çalışma → altta **Artifacts**: `RetroHub-Windows` (kurulum + portable .exe), `RetroHub-Android` (.apk).
- **Sürüm yayınlamak için:** etiket gönder, ikisi de **Releases** sayfasına kendiliğinden yüklenir:

       git tag v1.4.0
       git push origin v1.4.0

  Kullanıcılar Releases'ten indirir; kod yazmaya gerek yok.
- Derleme çalışmazsa: Actions → kırmızı adıma tıkla → hata metni orada. Android adımı ilk seferde 5-10 dk sürer.
- Android APK "debug" imzalıdır: telefonda "bilinmeyen kaynaklardan yükle" izni ister, normaldir.

## 3. Kod deposu (60 FPS kodları)
`codes-repo/` klasörü kendi kod deponun şablonudur (ayrı bir GitHub deposu yapman en temizi):

    codes-repo/
      index.json
      gc/GALE01.txt          (GameCube, ID'nin 4. harfi E = USA)
      ps2/1A2B3C4D.pnach     (PS2, ELF CRC)

Kod ekleyince `node tools/make-index.js codes-repo` index.json'u kendisi günceller (version artar), commit + push et.
RetroHub'da **Ayarlar → FPS ve Kodlar → Kendi depo adresi**:

    https://raw.githubusercontent.com/KULLANICI/DEPO/main/index.json

Uygulama günde bir indeksi yeniler. Depodan gelen her dosya diske yazılmadan önce doğrulanır
(sadece kod satırları kabul edilir).
