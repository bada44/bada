# RetroHub kod deposu (sablon)

Bu klasoru kendi GitHub deponun kokune koy (ucretsiz, public). Sonra RetroHub > Ayarlar > Kod Deposu'na su adresi yaz:

    https://raw.githubusercontent.com/KULLANICI/DEPO/main/index.json

## Yeni oyun/bolge eklemek
1. Kodu dosyaya yaz:  gc/GALE01.txt (GameCube, USA)  veya  ps2/1A2B3C4D.pnach (PS2)
2. index.json'a satir ekle, commit et. Uygulamayi guncellemene gerek yok; RetroHub gunde bir indeksi yeniler.

    {
      "version": 1,
      "gc":  { "GALE01": { "title": "Super Smash Bros. Melee (USA)", "file": "gc/GALE01.txt" } },
      "ps2": { "1A2B3C4D": { "title": "Oyun adi (USA)", "file": "ps2/1A2B3C4D.pnach" } }
    }

## Bolge kurali
- GameCube: ID'nin 4. harfi bolge. GALE01=USA, GALP01=PAL, GALJ01=JAP. Her bolge ayri dosya/ayri satir olmali.
- PS2: CRC her bolge ve surum icin farklidir. Oyun detayinda CRC ve seri (SLUS=USA, SLES=PAL, SLPS/SLPM=JAP) gorunur.
- Yanlis bolgenin kodu oyunu cokertir; RetroHub sadece birebir eslesen ID/CRC'yi kurar.

## Kod formati
- Gecko (.txt): istege bagli "$Kod Adi" satiri, ardindan "0XXXXXXX 0XXXXXXX" hex satirlari.
- PCSX2 (.pnach): standart pnach dosyasi.
Kodlari dogruladigin kaynaktan al; bu sablonda hicbir kod yok, uydurma kod eklenmedi.

## Otomatik index
Dosyaları ekledikten sonra: `node tools/make-index.js codes-repo` (proje kökünden) index.json'u üretir ve `version`'ı artırır.
Kod kaynağı olarak Dolphin Wiki (oyun sayfaları) ve Dolphin/PCSX2 forumları kullanılabilir; her kodu **kendi bölgesinin ID/CRC adıyla** kaydet.
