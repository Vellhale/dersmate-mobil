# dersmate Mobil — çalışma kuralları

dersmate (PeerLearn) akran öğrenme platformunun **React Native (Expo) mobil uygulaması**.
Web sürümü ve backend `C:\projeler\dersmate` içinde; backend .NET 8 + PostgreSQL + SignalR
ve **değişmez** — mobil yalnızca istemcidir. **İletişim dili Türkçe** — kod yorumları,
commit mesajları ve kullanıcıya görünen her metin Türkçe.

Expo SDK 57 / expo-router / NativeWind 4 / JavaScript (TS değil — web projesiyle aynı dil,
kod çevirisi birebir kalsın diye).

---

## Komutlar

```bash
npx expo start                 # Metro + Expo Go QR
npx expo start --android       # Android emülatörde aç
npx expo export --platform android   # derleme sağlaması (cihazsız hata yakalama)
```

### ⚠️ APK derlemesi bu yoldan ÇALIŞMAZ — 260 karakter sınırı

`gradlew assembleRelease`, `C:\projeler\dersmate Mobil` altında **kırılıyor**:

```
ninja: error: Stat(...RNGestureHandlerDetectorShadowNode.cpp.o):
Filename longer than 260 characters
```

Sebep boşluk DEĞİL, uzunluk: CMake nesne dosyasının yoluna KAYNAK yolunu da gömüyor
(`.cxx/.../CMakeFiles/react_codegen_....dir/C_/projeler/dersmate_Mobil/node_modules/...`),
yani proje yolu iki kez sayılıyor ve `react-native-gesture-handler` codegen'inde sınır
aşılıyor. Metro/`expo export` etkilenmez — yalnızca native derleme.

İki çözüm var:

1. **Kısa yoldan derle** (kurulum gerektirmez): projeyi `C:\dm` gibi kısa bir yola
   kopyala, orada derle, APK'yı geri al.
2. **Windows uzun yol desteğini aç** (kalıcı, yönetici gerekir — makinede şu an KAPALI):
   `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem` → `LongPathsEnabled = 1`, ardından
   yeniden başlat. Sonrasında proje kendi yerinde derlenir.

`android/local.properties` içine SDK yolunu **eğik bölüyle** yaz — Java `.properties`
biçiminde ters bölü kaçış karakteridir ve `C:\Android\Sdk` sessizce `C:AndroidSdk`
olur (bu hata iki derlemeyi kırdı):

```
sdk.dir=C:/Android/Sdk
```

API'nin mobilden erişilebilir olması için backend LAN'dan dinlemeli
(`dotnet run --project src/PeerLearn.Api` varsayılan localhost'tur; fiziksel cihaz için
`--urls http://0.0.0.0:5000`). Geliştirmede `src/lib/api.js` bilgisayarın LAN IP'sini
Metro hostUri'sinden kendisi türetir; başka ortam için `.env` → `EXPO_PUBLIC_API_URL`.

---


## Yerel arka uç — mobil ve web aynı veritabanını paylaşır

Mobil istemci web ile **aynı** `/api/*` uçlarına, aynı .NET API'sine ve aynı PostgreSQL
veritabanına gider. Paylaşım için yazılacak kod yok; yapılması gereken tek şey arka ucu
ayağa kaldırmak.

### Veritabanı (yönetici gerektirmeyen kurulum)

`C:\Program Files\PostgreSQL\{16,17}` altında ikililer var ama **hiçbir küme
başlatılmamış ve Windows hizmeti kayıtlı değil**. Hizmet kaydı ve `Program Files`
altına yazmak yönetici ister; küme bu yüzden kullanıcı klasöründe:

```bash
initdb -D C:/Users/abdul/pgdata/dersmate -U postgres \
  --auth-local=trust --auth-host=scram-sha-256 --pwfile=<parola-dosyasi> \
  -E UTF8 --locale=C --locale-provider=icu --icu-locale=tr-TR
pg_ctl -D C:/Users/abdul/pgdata/dersmate -l C:/Users/abdul/pgdata/dersmate-server.log start
```

⚠️ `--locale=C` ZORUNLU: sistem yereli `Turkish_Türkiye.utf8` ve initdb ASCII dışı
locale adını reddediyor. Türkçe sıralama/harf katlaması ICU sağlayıcısından geliyor —
`C` ctype ile bırakılsaydı `ILIKE` aramalarında İ/ı doğru eşleşmezdi.

⚠️ Windows'ta `127.0.0.1` bağlantısı **host** sayılır, `local` değil: `--auth-local=trust`
psql'i parolasız yapmaz, `PGPASSWORD` gerekir. Parolasız çağrı TTY beklerken kilitlenir,
bu yüzden `psql -w` kullan.

Rol ve veritabanı `appsettings.json`'daki geliştirme bağlantı dizesiyle birebir aynı
(`peerlearn` / `peerlearn`). Şema ve katalog:

```bash
cd C:/projeler/dersmate && ConnectionStrings__Redis= dotnet run --project src/PeerLearn.Api -- --migrate
```

**Redis gerekmiyor.** `DependencyInjection.cs` bağlantı dizesi boşsa süreç içi kilide
düşüyor — tek instance için belgelenmiş yapılandırma. Docker/WSL2 kurmaya gerek yok.

### API

```bash
cd C:/projeler/dersmate && ConnectionStrings__Redis= ASPNETCORE_ENVIRONMENT=Development \
  dotnet run --project src/PeerLearn.Api --urls http://0.0.0.0:5000
```

`Development` ortamı kayıt yanıtında `verificationToken` döndürür; e-posta sunucusu
olmadan hesap doğrulanabilir. İlk yönetici: `dotnet run --project src/PeerLearn.Api --
--promote-admin <eposta>`.

### Üçünü birden başlat

Makine yeniden başladığında üçü de gider (veritabanı Windows hizmeti olarak kayıtlı
değil). Betik yalnızca çalışmayanı başlatır ve telefonun bağlanacağı adresi yazar:

```bash
powershell -ExecutionPolicy Bypass -File araclar/arka-uc-baslat.ps1
```

### ⚠️ Güvenlik duvarı: telefon `dotnet`'e DOĞRUDAN ulaşamaz

Windows Güvenlik Duvarı kuralları **programa** bağlıdır, porta değil. Bu makinede:

```
Action=Allow|Dir=In|App=C:\program files\nodejs\node.exe   ← VAR
(dotnet.exe için gelen kural)                              ← YOK
```

Yani `http://<lan-ip>:5000` telefondan sessizce düşer. Kural eklemek yönetici hakkı ve
güvenlik ayarı değişikliğidir; bunun yerine izinli programın içinden köprü kuruluyor:

```bash
node araclar/lan-koprusu.js     # 0.0.0.0:5099 → 127.0.0.1:5000
```

Köprü WebSocket yükseltmesini de aktarıyor; onsuz SignalR sohbeti long-polling'e düşer
ya da hiç bağlanmaz. Kalıcı çözüm dotnet için gelen kural eklemek ya da API'yi gerçek
bir sunucuya almaktır — o zaman `araclar/` silinebilir ve `.env` doğrudan `:5000`
gösterir.

### Bağımsız APK

`.env` derleme anında gömülür (`EXPO_PUBLIC_API_URL`). Demo bayrağı **verilmez**:
`EXPO_PUBLIC_ONIZLEME` tanımlıysa tüm yazma işlemleri `src/lib/onizleme.js` içindeki
sahte uçlara gider ve profil fotoğrafı gibi değişiklikler sessizce kaybolur.

```
EXPO_PUBLIC_API_URL=http://192.168.1.111:5099
```

#### ⚠️ Şifresiz HTTP: release APK'da VARSAYILAN OLARAK ENGELLİ

Android 9'dan (API 28) beri `http://` trafiği yasak. Expo bu izni yalnızca
`android/app/src/debug/AndroidManifest.xml`'e koyuyor; **release manifest'te yok**.
Belirtisi yanıltıcı: uygulama "Sunucuya ulaşılamadı" diyor ama sunucu tarafında
HİÇBİR KAYIT yok — çünkü paket cihazdan hiç çıkmıyor. Ağı, IP'yi, güvenlik duvarını
kovalamadan önce bunu kontrol et:

```bash
grep -o 'usesCleartextTraffic="[a-z]*"' android/app/src/main/AndroidManifest.xml
```

İzin `app.config.js` üzerinden ve KOŞULLU veriliyor: `EXPO_PUBLIC_API_URL` `http://`
ile başlıyorsa açılır, `https://` olunca kendiliğinden kapanır. Sabit `true` yazmak
mağazaya çıkacak sürümde de şifresiz trafiği açık bırakırdı.

⚠️ Bu ayar manifest'e yalnızca `npx expo prebuild --platform android` çalıştırılınca
yansır; `gradlew assembleRelease` tek başına manifest'i güncellemez. Prebuild `android/`
klasörünü SIFIRLIYOR — sonrasında `android/local.properties` yeniden yazılmalı
(`sdk.dir=C:/Android/Sdk`, eğik bölüyle). Debug imza anahtarı Expo'da sabit olduğu için
yeniden üretilse de aynı kalıyor, yani APK üstüne kurulum bozulmuyor (sha256 ile ölçüldü).

Derleme logunda `env: export ...` satırları hangi değişkenlerin gömüldüğünü söyler —
demo bayrağının orada OLMADIĞINI doğrula. (Paketin içinde demo metinleri yine görünür;
Metro `onizleme.js`'i budamıyor, bayrak çalışma anında karar veriyor.)

---

## Web projesiyle ilişki — tek yönlü çeviri

- **`api.*` yüzeyi web'dekiyle AYNI tutulur** (`src/lib/api.js`). Web sayfası mobile
  çevrilirken çağrılar değişmeden taşınmalı. Yeni uç eklenirse İKİ projede birden eklenir.
- **Marka paleti web'deki `frontend/tailwind.config.js`'ten birebir kopya.** Tek kaynak
  web tarafı; palet değişirse iki dosya birden güncellenir. #0088CC bilerek 500'de:
  buton zeminleri 600/700'den gelir (WCAG ölçümleri web dosyasındaki yorumda).
- **`format.js`, `seviye.js`, `useAsync.js`, `useDebounced.js` birebir kopya** — saf JS,
  platform bağımsız. Web'de değişirlerse buraya da taşı.
- **HWID mobilde AYRI üretilir** (`src/lib/hwid.js`): canvas yok, cihaz kimliği
  expo-application/device sinyallerinden gelir. Web'in `canvasSignal()` sabitleri web'de
  dokunulmazdır ve buraya TAŞINMAZ — HWID cihazı tanımlar, kullanıcıyı değil; aynı
  kullanıcının telefonu "başka bir cihaz"dır ve backend için sorun değildir.

## Web'den bilinçli sapmalar

- `localStorage` → oturum + HWID **SecureStore**'da, tercihler AsyncStorage'da
  (`src/lib/storage.js`). Oturum açılışta BİR KEZ okunur, sonrası bellekte —
  `getToken()` senkron kalmalı (axios interceptor + SignalR accessTokenFactory).
- Kimlik gerektiren görseller (avatar, kanıt) → baytlar **axios ile indirilip** data URI
  olarak veriliyor (`src/components/YetkiliGorsel.jsx`).

  ⛔ `<Image source={{ uri, headers }}>` KULLANMA. Bu dosyada uzun süre öyle yazıyordu ve
  YANLIŞTI: RN Image, Android'de (newArchEnabled) Authorization başlığını GÖNDERMİYOR.
  Telefonun kendi istekleri köprü günlüğünde ölçüldü — aynı oturum, aynı saniye:

  ```
  GET /api/users/<id>/profile      → 200  jetonlu     (axios)
  GET /api/users/<id>/avatar?v=1   → 401  JETONSUZ    (RN Image)
  ```

  Sonuç: her avatar ve her kanıt görseli sessizce 401 alıyordu. Belirtisi "profil
  fotoğrafı güncellenmiyor"du ve teşhisi zordu: 401'i middleware controller'dan ÖNCE
  reddettiği için sunucu günlüğünde sorgu bile görünmüyor. Web'in blob + object URL
  çözümü mobilde data URI olarak karşılanıyor.

- Avatar önbellek sayacı **diskte** (`KEYS.avatarSurumleri`). Fresco'nun disk önbelleği
  uygulama yeniden başlatmalarını aşıyor; sayaç bellekte kalırsa açılışta temel URI'ye
  dönülür ve eski görsel ağa hiç çıkmadan sunulur.
- Giriş sonrası `navigate` ÇAĞRILMAZ: kök `Stack.Protected` guard'ları oturum durumuna
  göre kendisi geçiş yapar (`app/_layout.jsx`).
- Ders geçmişi sayfa boyutu **5** ve FlatList `onEndReached` ile yüklenir (mobil iş
  kuralı); web 20 kullanıyor.

## Korunan iş kuralları (backend'de yaşar, arayüz ihlal etmez)

1. **Ders almak ücretsiz** — kredi düşme/harcama arayüzü YOK. Puan yalnızca anlatana
   basılır (30 dk = 50, 60 dk = 100) ve harcanmaz; seviye unvanıdır.
2. **Seviye/rozet hesabı SUNUCUDA.** `seviye.js` eşik taşımaz; `level`/`nextLevelAt`
   hazır gelir. Branş rozetleri (Öğretici 8 sa / Üstad 15 sa) de sunucudan.
3. **SignalR tek bağlantı** — `InboxProvider` tab kabuğunda kurulur, sohbet ekranı kendi
   hub'ını AÇMAZ (iki bağlantı = bölünen gruplar, kaybolan mesajlar).

## Dokunma ve yüzey dili

- Basılabilir her öğe **min 44px**; girdi puntosu **16px** (`text-base`). Web'de bu
  kurallar `lg` kırılımına bağlıydı; mobilde koşulsuz.
- Yüzey dili `src/components/ui.jsx`'te tek yerde: kart = beyaz + `border-slate-100` +
  hafif gölge + `rounded-2xl`; sayfa zemini `bg-slate-50`. Sayfalar kendi yüzey dilini
  icat etmez.
- Renk DEĞERİ gereken yerler (tab bar, SVG, StatusBar) `src/lib/theme.js`'ten okur —
  hex'i elle yazma, palet tek kaynaktan gelsin.

## Adım planı

- **ADIM 1 (tamam):** iskelet, auth stack + tabs, tema, api/state katmanı.
- **ADIM 2 (tamam):** AuthKabuk (bölünmüş tek ekran) + giriş/kayıt/doğrulama; Akış
  (Instagram kartları — `api.suggestions`) + eşleşme isteği alt sayfası.
- **ADIM 3 (tamam):** Kompakt profil (ProfilGorunumu + SubjectBadges + değerlendirmeler),
  profil düzenleme + avatar (ImagePicker), `profil/[userId]`; SignalR sohbet
  (`mesajlar` listesi + `sohbet/[conversationId]` ters FlatList). Sağlayıcılar kökte
  (`app/_layout.jsx`) — yalnızca oturumlu dalda kurulur.
- **ADIM 4 (tamam):** Keşfet (arama + TYT/AYT filtre modalı + üniversite ağı, biriken
  sonsuz kaydırma); İlan oluştur (Portfolio portu — KonuSecici: Sınav→TYT/AYT→Ders→Konu,
  son basamak aranabilir); Derslerim (`app/dersler.jsx`: 5'erli infinite scroll geçmiş,
  rezervasyon + DateTimePicker, ImagePicker kanıt yükleme, onay→değerlendirme zinciri,
  şikayet/iptal, puan geçmişi); Eşleşmeler (`app/eslesmeler.jsx` — kabul/ret/sonlandır).
  Derslerim ve Eşleşmeler tab DEĞİL: Akış başlığındaki ikonlardan ve Profil
  kısayollarından açılan yığın ekranları.
- **ADIM 5 (tamam):** web'in `7f140a9` sonrası tüm işi mobile taşındı — Topluluk forumu
  (`app/topluluk.jsx`), yönetim kuyrukları (`app/yonetim.jsx`), yasal metinler
  (hakkimizda/gizlilik/kosullar + `yasalMetinler.js`), parola sıfırlama, kayıt onayı,
  sohbette taciz bildirimi, üç rozet şeridi, ürün turu, analitik + veri izni.
  `api.js` yüzeyi web ile eşit (71 metot).
- **ADIM 6 (tamam):** hesap silme, itiraz akışı, belge görüntüleyici, `/api/v1` öneki.
- **ADIM 7 (tamam):** e-posta doğrulama 6 haneli koda geçti, yönetim rozeti profile
  bağlandı, gövdesiz 403/404/5xx'e anlamlı metin, topluluk katkı sayaçları.

## Web ile senkron tutma

Web projesi ilerlemeye devam ediyor. Fark almanın en hızlı yolu, mobilin port edildiği
commit'ten diff çekmek:

```bash
cd C:/projeler/dersmate && git diff <baseline>..HEAD --stat -- frontend/src
```

Son senkron baseline'ı: **`b93422a`** (2026-09-04). Bir sonraki senkronda buradaki
değeri güncelle, yoksa aynı diff iki kez uygulanır.

⚠️ BASELINE'I GÜNCELLEMEYİ UNUTMAK SESSİZ BİR HATADIR ve bir kez yaşandı: değer
`7f140a9`'da (25 Ağustos) kalmışken mobil aslında iki tur daha ilerlemişti, bu yüzden
diff on günlük bitmiş işi de "yapılacak" diye gösteriyordu. Ters yönü daha kötü:
baseline ileri kalırsa gerçek bir fark hiç görünmez.

**Bilerek taşınmayan tek iş** (`0015860`, Keşfet filtre sütununun ekrana yapışması):
web'de yan sütun sayfa ile birlikte kayıyordu, `position: sticky` ile sabitlendi.
Mobilde filtreler yan sütunda değil ALT SAYFA MODALINDE ve modal zaten ekranda sabit —
karşılığı yok, port edilecek bir şey yok.

⚠️ `api.js` yüzeyini karşılaştırmak için metot adlarını çıkarıp kümeleri karşılaştır;
mobilde bilinçli olarak FARKLI olan üç metot var (`proofContentUrl` → `proofImageSource`,
`avatarObjectUrl` → `avatarImageSource`, `adminProofContentUrl` → `adminProofImageSource`)
— blob/object-URL yerine `<Image source={{uri, headers}}>` kullanıldığı için.

⚠️ `verifyEmail` İKİ ARGÜMAN ALIYOR (`email`, `code`) — tek argümanlı token sürümü
2 Eylül'de sunucudan kalktı. Bu, senkron gecikmesinin en pahalı örneği: sunucu
sözleşmeyi değiştirdi, mobil eski gövdeyi göndermeye devam etti ve **hiç kimse hesabını
doğrulayamadı** (doğrulanmadan giriş de kapalı, yani yeni kayıt tamamen kilitliydi).
Ne uygulama ne sunucu çöküyordu; ekran yalnızca "kod yanlış" diyordu. Kimlik uçlarının
gövdesi değiştiğinde mobil AYNI TURDA güncellenmeli.

⚠️ Parola sıfırlama HÂLÂ TOKEN'LA. Doğrulama koda geçti, sıfırlama geçmedi
(`ResetPasswordRequest(Token, NewPassword)`). İki akış artık farklı; birini diğerine
bakarak "düzeltme".

⚠️ `SOZLESME_SURUMU` artık ÜÇ yerde: sunucu (`LegalDocuments.cs`), web ve mobil
(`src/lib/yasalMetinler.js`). Sürüm artarken mağazadaki eski mobil sürüm kendi eski
sabitini göndereceği için kayıt kırılır — sürüm artışı, mobil yayınla birlikte planlanmalı.
