# RetroHub 1.1

GameCube (Dolphin) ve PS2 (PCSX2) için konsol tarzı masaüstü launcher.
Gamepad ile baştan sona kullanılır; Türkçe yama, otomatik FPS profili, oynama süresi
ve klasör tabanlı bulut kayıt eşitleme içerir.

## Yeni (1.3)
- **Tuş düzeltmesi:** Steam görünümünde klavye ve gamepad çalışıyor (oklar/D-pad gezin, Enter/A aç ve oyna, Esc/B geri, F/X favori, Q-E veya LB/RB filtre, S/Start ayarlar, / ara). Sol menü düğmeleri artık her açılışta bağlanıyor (betik yükleme sırası hatası giderildi).
- **Emülatör yolu yoksa** Oyna'ya basınca açıklayıcı pencere çıkar ve doğrudan ilgili ayara götürür.
- **Yeni menü:** sol menüde bölümler, ikonlar, seçili öğe çubuğu, Dolphin/PCSX2 hazır mı göstergesi (tıklayınca ayara gider). Ayarlar tek uzun sayfa yerine sekmeli: Kütüphane, Emülatörler, FPS ve Kodlar, Bulut, Türkçe Yama, Görünüm.

## Yeni (1.2)
- **Steam tarzı kütüphane:** sol menü (filtre, sıralama, kart boyutu), kapak ızgarası, oyun sayfası (büyük YEŞİL "OYNA" butonu, süre, son oynama). Gamepad için eski konsol ekranı "Büyük Ekran modu" olarak duruyor.
- **Kapaklar otomatik iner** (libretro thumbnails). Bulunamayan oyunlar harfli renkli kart olarak görünür; 7 günde bir tekrar denenir.
- **FPS teşhisi:** Oyun sayfasında "60 FPS durumu" kartı: depoda yama var mı, son açılışta ne yapıldı, uyarılar. (Oyun açılınca RetroHub küçüldüğü için bildirimleri kaçırırsın; rapor orada kalır.)
- **Düzeltmeler:** Portable PCSX2/Dolphin tanınır (ayarlar emülatörün kendi klasörüne yazılır). Yama deposu hiç inmediyse oyun açılırken beklenir. Depoda yama yoksa nedenini yazar.
- **Android:** aynı Steam görünümü, dar ekranda sütunlar ve yatay filtre çipleri; geri tuşu açık sayfayı kapatır.

## Yeni (1.1)
- **Otomatik tarama:** Uygulama açılırken ve ROM klasörüne dosya eklenince/silinince kütüphane kendiliğinden güncellenir.
- **İnternetten kod deposu:** 60 FPS kodları oyunun ID/CRC değerine göre indirilir ve önbelleğe alınır (Ayarlar → Kod Deposu).
  - PS2: PCSX2'nin resmi yama paketi + topluluk 50/60 FPS yama deposu (PeterDelta/PCSX2, yüzlerce oyun, USA sürümleri dahil). Haftada bir yenilenir. Yamadaki `60 FPS` grubunu oyun açılırken RetroHub kendisi etkinleştirir (genişekran gibi diğer gruplara dokunmaz).
  - GameCube ve ekstra PS2: kendi GitHub deponun `index.json` adresi (şablon: `codes-repo/`).
- **Bölge kontrolü (USA / PAL / JAP):** Oyun detayında bölge ve kod durumu görünür. Kod bellek adreslerini değiştirdiği için yalnızca
  birebir aynı ID/CRC'nin kodu kurulur; yanlış bölge kurulmaz, "bu bölge için yok, USA için var" uyarısı çıkar.
- **Normal uygulama:** Kurulumlu `.exe` (başlat menüsü + masaüstü kısayolu), taşınabilir sürüm, uygulama ikonu, "Windows ile başlat" ayarı.
- **Android:** `mobile/` klasörü (aşağıya bak).

## Windows uygulaması olarak derleme
`npm install` sonra `npm run dist:win` → `dist/` içinde `RetroHub Setup x.y.z.exe` (kurulum) ve `RetroHub-Portable-x.y.z.exe`.
Bilgisayarında derlemek istemezsen GitHub'a yükle: Actions → Build → Run workflow (hem .exe hem .apk üretir).

## Android
`mobile/` aynı arayüzü Capacitor ile Android uygulamasına çevirir. Oyunları telefondaki **Dolphin** (GameCube) ve
**NetherSX2/AetherSX2** (PS2) ile açar. Gereken: Node.js, JDK 17, Android SDK.

    cd mobile
    npm install
    npm run android          # www + android/ projesi + native eklenti
    cd android && ./gradlew assembleDebug    # APK: android/app/build/outputs/apk/debug/

Mobilde olanlar: kütüphane, otomatik tarama, favori, oynama süresi, dokunmatik arayüz.
Mobilde olmayanlar: Türkçe yama, otomatik 60 FPS kodu ve bulut klasörü (Android, emülatörün kendi verisine erişime izin vermiyor).
Oynama süresi yaklaşık hesaplanır (emülatörden RetroHub'a dönüş anına göre).

## Kurulum (Windows)
1. [Node.js](https://nodejs.org) LTS kur.
2. Klasörde terminal aç: `npm install` ardından `npm start`
3. Kalıcı .exe için: `npm run dist:win` (`dist/` içinde kurulumlu ve portable çıkar)

Eski sürümden güncelliyorsan: eski klasörü sil, yeni zip'i çıkar, `npm install` tekrar çalıştır.
Ayarların ve oynama sürelerin korunur (ayrı bir veri dosyasında tutulur).

## İlk açılış
Kütüphane boşsa 3 adım gösterilir: **ROM klasörlerini seç → Emülatörleri otomatik bul → Tara.**
Emülatörler (Dolphin.exe, pcsx2*.exe) Masaüstü/İndirilenler/Program Files altında otomatik aranır.

## Kontroller
| Gamepad (Xbox düzeni) | Klavye | İşlev |
|---|---|---|
| D-pad / sol çubuk | Ok tuşları | Gezin |
| A | Enter | Oyna / seç |
| B | Esc | Geri |
| X | F | Favori |
| Y | D | Oyun detayı |
| LB / RB | Q / E | Sekme değiştir |
| LT / RT | PgUp / PgDn | 6 oyun atla |
| Select | R | Rastgele oyun |
| Start | S | Ayarlar |
| — | F11 | Tam ekran |
| — | / | Ara |

Oyun açıkken RetroHub gamepad girişini yok sayar (emülatör kullanır); oyun kapanınca geri döner.

## ☁ Bulut kayıt (anahtar yok, giriş yok)
Ayarlar → Bulut Kayıt → **Google Drive (masaüstü uygulaması), Dropbox veya OneDrive klasörü içinde
bir klasör seç.** Bitti.
- Oyun açılırken buluttaki daha yeni kayıtlar indirilir; oyun kapanınca yerelde daha yeni olanlar yüklenir.
- Kazanan her zaman **en yeni dosyadır**. Üstüne yazılan yerel dosyanın yedeği `.retrohub-bak` olarak kalır.
- Dolphin (`Documents\Dolphin Emulator\GC`) ve PCSX2 (`Documents\PCSX2\memcards`) hafıza kartları otomatik bulunur.
- İki bilgisayar arasında aynı anda oynama; son kapatan kazanır.

## ⚡ FPS Unlocker (otomatik)
(Kodlar önce `codes/` klasörüne, sonra internetten indirilen önbelleğe bakılarak bulunur.)
Dosya seçmen gerekmez; oyun açılırken kendiliğinden çalışır (oyun bazında detaydan kapatılabilir).
1. **Performans profili (her oyunda):** Dolphin için oyuna özel `.ini`'ye CPU overclock x1.5 + hızlı disk
   yazılır; PCSX2'de yama/cheat sistemi açılır. Emülatör yavaşlığından kaynaklanan FPS düşüşünü giderir.
2. **Oyuna özel 60 FPS kodu:** Oyunun kimliği (GameCube Game ID / PS2 CRC) bulunur ve `codes/` klasöründe
   eşleşen dosya varsa kendiliğinden kurulur:
   - `codes/gc/GALE01.txt` (Gecko kodu)
   - `codes/ps2/1A2B3C4D.pnach`

   Oyunun ID/CRC değeri **Detay** panelinde yazar. "30 → 60 FPS" açmak oyuna özel koddur; evrensel bir
   yolu yoktur. Kod havuzu büyüdükçe kapsam artar. Kendi klasörünü Ayarlar'dan da gösterebilirsin.
- PS2 CRC okuma sadece ham `.iso` dosyalarında çalışır (`.chd/.cso` için PCSX2 kendi veritabanına bakar).

## Türkçe yama
Detaydan tek tek ya da Ayarlar → Otomatik Türkçe Yama ile toplu uygula. `.ppf` doğrudan, `.xdelta` için
xdelta3.exe yolu gerekir. Yama öncesi `oyun.orig.iso` yedeği alınır (kütüphanede görünmez).

## Desteklenen formatlar
| | Oynanır | Yama | Oto kod |
|---|---|---|---|
| GameCube | `.iso .gcm .rvz .wia .ciso .gcz` | ham `.iso/.gcm` | `.gcz` hariç hepsi (gcz için dosya adına `[GALE01]` ekle) |
| PS2 | `.iso .bin .chd .cso .zso` | ham `.iso/.bin` | ham `.iso` |

Switch (`.nsp`) desteklenmez (ayrı emülatör gerekir).

## Sorun giderme
- **Oyun açılmıyor:** Ayarlar → Emülatörler → yolu kontrol et.
- **Gamepad görünmüyor:** Bir tuşa bas (tarayıcı kuralı gereği kontrolcü ilk tuşla uyanır).
- **PCSX2 tam ekran açılmıyor:** Ayarlar'dan "Emülatörü tam ekran aç"ı kapat, PCSX2'nin kendi ayarını kullan.
