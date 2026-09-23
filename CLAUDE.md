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
npx expo export --platform ios       # iOS için aynı sağlama — Windows'ta ÇALIŞIR
npx expo config --type introspect --json   # üretilecek Info.plist/manifest'i görmeden derleme
```

⚠️ `npm run ios` (`expo run:ios`) **bu makinede çalışmaz** — Xcode yalnızca macOS'ta.
iOS'un tek yolu bulut derlemesi; bkz. "iOS ve App Store".

### ⛔ `eas.json`'A YORUM YAZILAMAZ — her EAS komutunu kırar

Dosya bir süre `"//"` anahtarlarıyla belgelenmişti. eas-cli bunları **reddediyor** ve
hata tek bir komuta özgü değil: `eas config`, `eas device:list`, `eas build` — hepsi
düşüyor:

```
eas.json is not valid.
- "build.//" must be of type object
- "build.preview.//" is not allowed
    Error: config command failed.
```

Sebep şema: `@expo/eas-json` doğrulamayı `allowUnknown: false` ile yapıyor ve
desteklenen bir açıklama alanı **yok** (JSON5/JSONC de değil, düz JSON).

⚠️ Bu 2026-09-23'e kadar FARK EDİLMEDİ çünkü depoda hiç EAS derlemesi yapılmamıştı
(ne `owner` ne `extra.eas.projectId` vardı; Android APK'ları yerelde Gradle ile
derlenmişti). İlk iOS derlemesini tam olarak bu engelledi.

Profillerin ne işe yaradığı ve her kararın gerekçesi **`docs/eas-profilleri.md`**'de.
Yeni profil ya da karar eklenince açıklaması oraya yazılır; `eas.json` veri olarak kalır.

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

## iOS ve App Store

### Ayrı depo YOK ve açılmayacak

iOS ayrı bir proje değil, **aynı kod tabanının ikinci derleme hedefi**. Depo tek:
`Vellhale/dersmate-mobil`. `/ios` ve `/android` ikisi de `.gitignore`'da (CNG) — native
klasörleri EAS her derlemede prebuild ile üretiyor, yani iOS için depoya eklenecek
hiçbir dosya yok. Yapılan iş tamamen `app.json` + `app.config.js` + `eas.json`.

⛔ "iOS için ayrı repo açalım" bir kez gündeme geldi (2026-09-21) ve **reddedildi**.
Ayırmak 1792 modüllük tek kaynağı ikiye bölerdi: her özellik iki kez yazılır, `api.js`
yüzey pariteti (web ↔ mobil) üç ayaklı hâle gelir ve CLAUDE.md'deki "Web ile senkron
tutma" disiplini ikinci bir baseline daha taşımak zorunda kalırdı. Platform farkları
konfigürasyonda çözülüyor, depoda değil.

### Bu makineden iOS: ne çalışır, ne çalışmaz

| Çalışır (Windows) | Çalışmaz (Mac gerekir) |
|---|---|
| `npx expo export --platform ios` (JS paketi sağlaması) | `npx expo run:ios` / Xcode |
| `npx expo config --type introspect` (Info.plist önizleme) | iOS Simulator |
| `eas build --platform ios` (derleme BULUTTA, macOS işçide) | yerel `pod install` |

Yani geliştirme akışı Android'den farksız: **development** profiliyle bulutta bir kez
geliştirme istemcisi derlenir, iPhone'a kurulur, sonrası `npx expo start` ile canlıdır.

### ⛔ Kilit: Apple Developer üyeliği

Android'de EAS imza anahtarını kendisi üretebiliyor. **iOS'ta üretemez** — sertifika ve
tedarik profili Apple'dan gelir. Üyelik ($99/yıl) olmadan `eas build --platform ios`
**hiçbir profilde** çalışmaz. Bireysel hesap genelde aynı gün, kurumsal hesap D-U-N-S
numarası istediği için haftalar alabilir. Sıradaki her iş buna bağlı.

Üyelik açıldıktan sonra sıra: App Store Connect'te `com.dersmate.app` kaydı → `eas
device:create` (test iPhone'unun UDID'si) → `eas build -p ios --profile development`.

### ⚠️ ATS: Expo'nun varsayılanı Android'in TAM TERSİ

Şifresiz trafik duvarı iOS'ta da var (App Transport Security) ama varsayılan ters yönde
hatalı:

- **Android**: Expo izni yalnızca debug manifest'ine koyar → release paketi kapalı gelir,
  hata "çalışmıyor" diye görünür.
- **iOS**: Expo şablonu Info.plist'e `NSAllowsArbitraryLoads: true` koyar → mağaza paketi
  **tamamen açık** gider, hata **hiç görünmez**.

Ölçüldü (2026-09-21, `expo config --type introspect`): `.env` `https://` iken bile
üretilen Info.plist `NSAllowsArbitraryLoads: true` + localhost istisnası taşıyordu. Yani
`app.config.js`'in Android için kurduğu "adres https olunca izin kendiliğinden kapanır"
güvencesi iOS'ta **tutmuyordu** — koşul doğru çalışıp hiçbir şey eklemiyor, şablon zaten
açık bırakıyordu.

Bu yüzden `app.config.js` anahtarı **koşulun iki dalında da açıkça** yazıyor. İkisi de
ölçüldü:

```
EXPO_PUBLIC_API_URL=https://...  →  { NSAllowsArbitraryLoads: false }
EXPO_PUBLIC_API_URL=http://...   →  { NSAllowsArbitraryLoads: true, NSAllowsLocalNetworking: true }
                                    + NSLocalNetworkUsageDescription
```

⛔ `false` dalını "gereksiz" sanıp silme — anahtarı hiç vermemek Expo'nun açık
varsayılanına dönmektir.

Geliştirmede ayrıca **iOS 14 Yerel Ağ izni** var: LAN'daki sunucuya ilk bağlantıda
kullanıcıya istem çıkar. Reddedilirse belirti Android'deki sessiz hatanın aynısıdır
(istek cihazdan çıkmaz, sunucu günlüğü boş). `NSLocalNetworkUsageDescription` bu yüzden
veriliyor — metinsiz istem iOS'ta hiç gösterilmez.

### Privacy manifest (`PrivacyInfo.xcprivacy`)

1 Mayıs 2024'ten beri zorunlu: uygulamanın "required reason API"lere neden dokunduğu
önceden beyan edilir. `app.json` → `ios.privacyManifests` (2026-09-22'de eklendi).

⛔ **Pod'ların kendi manifestosu YETMEZ.** node_modules'te 6 paket kendi
`PrivacyInfo.xcprivacy`'sini taşıyor ama Expo/RN pod'ları STATİK kütüphane olarak
uygulamanın ana ikilisine linkleniyor; Apple taraması sembolleri o ikilide bulup
kullanımı UYGULAMAYA atfediyor. Expo da açıkça yazıyor: *"Apple does not correctly parse
all the PrivacyInfo files included by static CocoaPods dependencies."*

Beyan edilenler — dördü de ölçülerek seçildi:

| Kategori | Kod | Nereden |
|---|---|---|
| FileTimestamp | `C617.1` | AsyncStorage, expo-application, expo-file-system, RN çekirdeği |
| UserDefaults | `CA92.1` | expo-constants (kurulum kimliği), RN çekirdeği |
| SystemBootTime | `35F9.1` | expo-device, RN `ReactCommon/react/timing` |
| DiskSpace | `E174.1` | expo-file-system (derlemeye giriyor, çağrılmasa da) |

⛔ **Bilerek DIŞARIDA bırakılanlar** — yanlış beyan, eksik beyandan daha kötü:

- `0A2A.1` ve `C56D.1` — Apple metni birebir: *"This reason may only be declared by
  third-party SDKs."* Uygulama hedefine yazmak, kendini üçüncü taraf SDK ilan etmektir.
- `85F4.1` — "disk alanını KULLANICIYA GÖSTERMEK" için. Böyle bir ekran yok.
- `3B52.1` — belge seçiciyle kalıcı erişim verilen dosya için. expo-image-picker metadata'yı
  kullanıcının dosyasından değil, uygulamanın kendi `Caches` kopyasından okuyor → `C617.1`.
- `1C8F.1` (App Group yok), `AC6B.1` (MDM yok), `B728.1` (sağlık araştırması değil).
- `ActiveKeyboards` kategorisi — dokunan hiçbir şey yok.

✅ **ÖLÇÜLDÜ (2026-09-23, ilk iOS derlemesinin .ipa'sı açılarak):** gönderilen
`Payload/dersmate.app/PrivacyInfo.xcprivacy` tam olarak yukarıdaki dört kategoriyi ve
yedi türü taşıyor, `NSPrivacyTracking: false`. **Fazladan hiçbir kod eklenmemiş.**

Bu, önceki beklentiyi düzeltiyor: RN'in `post_install` betiğinin
(`privacy_manifest_utils.rb`) pod beyanlarını uygulama manifestine ekleyip `0A2A.1` /
`85F4.1` kodlarını geri getireceği düşünülmüştü. Getirmedi — her pod kendi ayrı
`*_privacy.bundle/PrivacyInfo.xcprivacy` dosyasında duruyor (pakette 10 tane var:
React-timing, ExpoConstants, ExpoApplication, ExpoDevice, RNCAsyncStorage, folly, glog,
boost…). Uygulama manifesti yalnızca bizim yazdığımız.

`expo-build-properties` → `ios.privacyManifestAggregationEnabled: false` anahtarına
GEREK KALMADI; varsayılan davranış zaten istediğimiz sonucu veriyor.

⚠️ Bu ölçüm `onizleme` profilinde yapıldı. `production` farklı pod kümesi derlemiyor,
yani sonucun değişmesi beklenmiyor — ama mağazaya ilk gönderimden önce aynı kontrol
tekrarlanabilir: .ipa bir zip, `Payload/<ad>.app/PrivacyInfo.xcprivacy` içinden okunur.

`NSPrivacyCollectedDataTypes` yedi tür sayıyor (ad, e-posta, kullanıcı kimliği, cihaz
kimliği, fotoğraf, mesaj, diğer kullanıcı içeriği). Hepsi `Linked: true`, `Tracking: false`.
**Cihaz kimliği (`hwid.js`) beyan EDİLİYOR** — özetlenmiş olması muafiyet değil; ama
Apple'ın *tracking* tanımına (üçüncü taraf verisiyle eşleştirme / veri simsarı) girmiyor,
o yüzden ATT yine gerekmiyor.

⚠️ **BAYATLAMA NÖBETİ.** API kategorileri kendiliğinden tazeleniyor (birleştirme açık).
Bayatlayan kısım veri türleri: ölçüm/crash/reklam SDK'sı eklendiği gün
`NSPrivacyCollectedDataTypes` ve `NSPrivacyTracking` ELLE güncellenmeli. `NSPrivacyTracking`
yanlış `false` kalırsa sistem o alan adlarına giden istekleri izin alınmadan sessizce
düşürür — derleme hatası değil, çalışma anında boş sunucu günlüğü.

⚠️ **App Store Connect formu manifestin kopyası DEĞİL, süperkümesi.** Manifest yalnızca
bizim topladığımızı anlatır; form üçüncü taraf SDK'ların topladığını da ister. Bugün SDK
yok, ikisi aynı yedi türde buluşuyor — ama "formu manifestten kopyala" bir yöntem olarak
yerleşirse ilk SDK eklendiği gün sessizce eksik beyan verilir.

⚠️ **`.easignore` tuzağı.** CNG güvencesinin tamamı `.gitignore`'daki `/ios`, `/android`
satırlarına bağlı. `.easignore` eklenirse `.gitignore` TAMAMEN devre dışı kalır; kökte
fiziksel olarak duran `android/` klasörü yüklenir, EAS prebuild'i ATLAR ve eski manifest
sessizce gönderilir. `.easignore` eklenecekse `/ios` ve `/android` oraya da yazılmalı.

### ⚠️ Ders kanıtı yükleme iOS'ta ÇALIŞMIYORDU — HEIC (2026-09-22'de düzeltildi)

`CompleteSession.cs` yalnızca `image/png`, `image/jpeg`, `image/webp` kabul ediyor.
iPhone'un varsayılan kamera biçimi **HEIC** ve `expo-image-picker` onu DÖNÜŞTÜRMÜYOR:
`quality < 1` olsa bile `ImageUtils.swift` HEIC/TIFF/AVIF dallarında ham baytı olduğu
gibi döndürüyor, yalnızca JPEG dalı yeniden kodluyor. Yani galeriden seçilen her kamera
fotoğrafı `image/heic` olarak gidip **"Yalnızca PNG/JPEG/WebP kabul edilir."** ile
reddedilirdi — ders tamamlama iOS'ta hiç çalışmazdı.

Android'de seçici JPEG verdiği için bu hata **hiç görünmedi**. İlk App Review'da
incelemecinin ders tamamlamayı denemesiyle Guideline 2.1 reddi olarak çıkardı.

Düzeltme: `app/dersler.jsx` → `fotoSec` artık avatar yolundaki deseni kullanıyor
(`profil.jsx` → `fotografDegistir`): `ImageManipulator` yeniden kodluyor, çıktı her
zaman JPEG. Yan kazanç: EXIF/GPS cihazdan hiç çıkmıyor (sunucu zaten temizliyordu, ama
artık ağa da binmiyor) ve privacy manifest'e konum türü eklemek gerekmiyor.

⚠️ Ölçek KOŞULLU (`a.width > 1920`): `resize({ width })` oranı korur ama küçük görseli
BÜYÜTÜR de — ekran görüntüsü zaten dardaysa büyütmek dosyayı şişirir, ayrıntı katmaz.

⛔ Dönüştürme başarısızsa ham dosyaya DÜŞÜLMÜYOR: iOS'ta o dosya büyük olasılıkla
HEIC'tir ve sunucu reddeder — kullanıcı sebebini anlamadığı bir hata alırdı.

### Dağıtım: ad-hoc mu TestFlight mi

iOS'ta `distribution: "internal"` Android'deki gibi serbest değil. Üretilen `.ipa`
ad-hoc imzalıdır ve **yalnızca UDID'si kayıtlı cihazlara** kurulur (`eas device:create`,
yılda 100 cihaz). Kayıtsız bir iPhone'a bağlantıyı açmak yetmez.

- **development / preview / onizleme** → ad-hoc. Kendi cihazlarımız için.
- **production + `eas submit`** → TestFlight. UDID kaydı gerekmez, e-posta davetiyle
  dağıtılır. Dışarıdaki testçiye giden yol budur.

⚠️ `preview` profili yerel arka uca (`http://192.168.1.111:5099`) bağlı olduğu için
**TestFlight'a uygun değil** — LAN adresi ne Apple'ın incelemesinde ne de başkasının
telefonunda çalışır.

### App Review — zaten karşılanan ve karşılanmayan

Bunlar kontrol edildi (2026-09-21), yeniden araştırma gerekmiyor:

| Kural | Durum |
|---|---|
| 5.1.1(v) uygulama içinde hesap silme | ✅ var (`api.deleteAccount`, "Hesabımı sil" ekranı) |
| 5.1.1 gizlilik metnine erişim | ✅ var (`MetinSayfasi.jsx`) |
| 4.8 Sign in with Apple | ✅ **gerekmiyor** — üçüncü taraf sosyal giriş yok, kimlik e-posta+parola |
| ATT (izleme izni) | ✅ **gerekmiyor** — ölçüm taşıyıcısı kurulu değil (`analytics.js`) |
| Kullanılmayan izin metinleri | ✅ yok — `expo-image-picker` kamera/mikrofon `false`, yalnızca foto izni üretiliyor |
| İkon alfa kanalı (App Store reddeder) | ✅ `assets/icon.png` 1024×1024, alfasız (colorType=2) |
| Privacy manifest (`PrivacyInfo.xcprivacy`) | ✅ `app.json` → `ios.privacyManifests` (2026-09-22) |
| Gizlilik "nutrition label" formu | ⬜ App Store Connect'te elle doldurulacak — manifestteki 7 türle tutarlı olmalı |
| Ekran görüntüleri (6.7" ve 6.5") | ⬜ üretilecek — Android'inkiler kullanılamaz |

`ios.infoPlist.ITSAppUsesNonExemptEncryption = false` app.json'a eklendi: uygulama
yalnızca standart HTTPS kullanıyor ve ihracat muafiyetine giriyor. Anahtar olmasa her
TestFlight yüklemesinde aynı soru elle yanıtlanır ve yanıtlanana kadar paket testçilere
**dağıtılmaz**.

### ⚠️ `SOZLESME_SURUMU` artık iki mağazaya birden bağlı

Sürüm sabiti üç yerde (sunucu, web, mobil) — bkz. "Web ile senkron tutma". iOS yayına
girdikten sonra bu **dört** yer gibi davranır: sürüm artarken Play'deki eski sürüm kadar
App Store'daki eski sürüm de kendi eski sabitini gönderir. İki mağazanın inceleme süresi
farklı olduğu için artış, **her iki yayının da geçtiği** ana planlanmalı.

#### İlk iOS yayınından önce ödenen borç (2026-09-21)

Bu kural ilk kez iOS hazırlığında ısırdı ve ÖLÇÜLDÜ:

```
sunucu 2026-09-19 · web 2026-09-19 · MOBİL 2026-09-05
```

`Register.cs` eşitlik arıyor. Bu farkla çıkacak bir paketten **hiç kimse kayıt
olamazdı** — uygulama da sunucu da çökmeden, ekranda yalnızca bir doğrulama hatasıyla.
Web artışı "mobil mağazada henüz uygulama yokken" yapıldığı için o gün kimseyi
kilitlemedi; borç ilk mağaza yayınına kadar açık kaldı ve orada ödendi.

⚠️ Sayı tek başına yükseltilmedi, METİNLE BİRLİKTE taşındı (künye, §1'ler, imza).
Sabit bir veri değil, "kullanıcıya hangi metni gösterdim" beyanı; metni taşımadan
sayıyı yükseltmek sunucuya gösterilmemiş bir metnin kabul edildiğini bildirmek olurdu.

**Mağazada uygulama VARKEN sıra tersine döner** (yasalMetinler.js'te de yazılı):
önce mobil sürüm artar ve YAYINLANIR, sonra sunucu dağıtılır. Bu kez tersi yapılabildi
çünkü mağazada henüz uygulama yoktu — bir daha o serbestlik olmayacak.

### ⛔ App Store Connect gizlilik politikası ADRESİ istiyor — uygulama içi metin saymaz

`app/gizlilik.jsx` mobil gerçeğe göre yazılmış durumda (canvas yerine `hwid.js`, çerez
yerine uygulama depolaması, "analitik taşıyıcısı yok"). Ama App Store Connect zorunlu
alan olarak **herkese açık bir URL** istiyor ve bugün verilebilecek tek adres
`dersmate.com/gizlilik` — o da **web metnini** sunuyor: tarayıcı parmak izi, çerez
kategorileri ve Google Analytics. Üçü de iOS uygulamasında YOK.

Yani o adres verilirse, `gizlilik.jsx`'in başında yazılı kuralın tersi olur: *"web
metnini birebir kopyalamak burada doğru metin değil, YANLIŞ BEYAN olurdu."* Apple
formdaki beyanı, politikayı ve uygulamanın davranışını karşılaştırıyor.

⬜ **Açık iş:** web deposunda mobil metni sunan ayrı bir sayfa (ör. `/gizlilik-uygulama`)
ve App Store Connect'e o adres. Metin zaten yazılı; taşınması gerekiyor.

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
  `getToken()` senkron kalmalı (axios interceptor; SignalR fabrikası `tazeTokenAl` de
  onu okur).
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

- **Oturum yenileme** (`src/lib/api.js` → `oturumuYenile`) web'le aynı sözleşmeyi
  kullanıyor: tek uçuş, 401 → yenile → bir kez tekrar dene. Beş yerde bilerek ayrılıyor:
  1. Yol `/api/v1/session/refresh`. Web ön eksiz `/api/session/refresh` çağırıyor;
     mağazadaki sürüm onu çağırırsa o takma ad sunucudan bir daha kaldırılamaz.
  2. Geçici hatada (yanıtsız ağ hatası, 429, 5xx) oturum SİLİNMEZ, istek hata metniyle
     düşer. Web her başarısızlıkta çıkış yaptırıyor. Bedeli: yanıtı yolda kaybolan
     (sunucuda dönüşmüş) bir yenilemenin eski token'ı 30 sn'den geç yeniden sunulursa
     sunucu bunu hırsızlık sayıp her yerden çıkış yaptırır. Nadir, kabul edildi.
  3. Yalnızca GÖVDESİZ 401 yenilenir (`tokenOlduMu`: JwtBearer'ın token reddi); web her
     401'de yeniliyor. Gövdeli 401'ler yenilenmez. `INVALID_CREDENTIALS` "Hesabımı sil"
     ekranındaki yanlış parola; çıkış da yapılmaz. `SESSION_REVOKED` sunucunun oturumları
     düşürdüğü durum ve yenileme token'ı da iptal. Onu sunmak sunucuya "hırsızlık"
     dedirtir ve kullanıcının parola sıfırladıktan SONRA açtığı taze oturumları da düşürür.

     ⚠️ Bu koruma YALNIZCA erişim token'ının ömrü içinde çalışıyor (sıfırlamadan sonra en
     fazla ~2 saat). Sunucu önce ömrü sınıyor (JwtBearer, `UseAuthentication`) ve
     `SESSION_REVOKED`'ı yalnızca ömrü geçerli token'a döndürüyor
     (`AccountStatusMiddleware`, kimliksiz isteği olduğu gibi geçiriyor). Telefon ertesi
     gün açılırsa ilk istek GÖVDESİZ 401 alır ve iptal edilmiş yenileme token'ı sunulur.
     `RefreshSession` hoşgörü penceresini yalnızca `Rotated`'a tanıdığı için bunu
     `ReuseDetected` sayıp sıfırlamadan sonra açılan web oturumunu da düşürür. Mobil iki
     durumu AYIRT EDEMEZ: "yalnızca süresi doldu" ile "iptal edildi ve süresi de doldu"
     aynı gövdesiz 401. Hub fabrikası (`tazeTokenAl`) da aynı yoldan geçiyor. Kök düzeltme
     sunucuda (hırsızlık varsayımı yalnızca pencere dışı `Rotated` token'da); web de her
     401'de yenilediği için aynı açığı taşıyor. Sunucu düzelene kadar sınır açık.
  4. "Beni hatırla" kutusu YOK; `login` açıkça `rememberMe: true` gönderiyor. Web'in
     gerekçesi ortak bilgisayar, telefon ise kişisel cihaz. `false` giderse sunucu
     yenileme token'ı üretmez ve oturum sessizce 2 saate iner.
  5. SignalR token fabrikası async ve yenileme farkında (`tazeTokenAl`); web'inki senkron
     `getToken()`. Sunucu JWT ölünce hub'ı kapatıyor ve negotiate'in 401'i tekrar
     denenmiyor. Senkron fabrikayla, Mesajlar'da bekleyen kullanıcının canlı akışı bir
     REST isteği token'ı yenileyene kadar sessizce dururdu.

  Oturum SecureStore'da TEK anahtarda ve yazımlar sıraya sokuluyor (`saveSession`).
  Yenileme token'ını ayrı anahtara bölme; gerekçe `storage.js`'te.

  **Çıkış artık sunucuya da işliyor** (2026-09-21, web `03dc360`'ın portu). Öncesinde
  çıkış yalnızca istemci taraflıydı: SecureStore'daki oturum siliniyor ama yenileme
  token'ı sunucuda 60 gün geçerli kalıyordu — silinen değer yeniden ele geçirilirse
  (cihaz yedeği, disk artığı) o süre boyunca taze erişim token'ı üretebilirdi.

  `AuthContext.logout` sırası: token'ı OKU → yereli sil → `oturumuSonlandir()` ile
  sunucuda iptal et, **beklemeden**. Ağ yokken çıkış yine kesin sonuç verir.

  ⛔ `oturumuSonlandir` HAM AXIOS kullanır, `request()` değil: istemcinin 401 → yenile
  zinciri, tam da iptal edilmek istenen token'la oturumu tazelerdi.

  ⚠️ İki bilinen sınır (web'de de var): erişim token'ı ömrü dolana kadar (≤2 saat)
  yaşar (tek cihaz iptali damgayı ileri almıyor); ve çıkış anında bir yenileme
  uçuştaysa o turda üretilen yeni token istemcide atıldığı hâlde sunucuda canlı kalır.
  İkincisinin kapatılması sunucunun işi. `onAuthExpired` yolunda bu çağrı YAPILMAZ —
  orada token zaten ölü.
- **Arkadaşlar ekranının rotası `/eslesmeler` kaldı** (`app/eslesmeler.jsx`); web #31'de
  adres `/arkadaslar` oldu, yalnızca kullanıcıya görünen metinler taşındı. Dosyayı
  yeniden adlandırma: tur çıpası `eslesmeler`, `dersmate://eslesmeler` derin bağlantısı
  ve kök `Stack.Protected` listesi ona bağlı — listeye eklenmeyen yeni ad OTURUMSUZ da
  açılır. Algoritma anlamındaki "eşleşme" ise "öneri" oldu ("Şimdilik öneri yok"), metin
  eşleşmesi gibi teknik anlamlar olduğu gibi kaldı.
- **Başka ekranda değişen veri ODAKTA tazelenir**, yeniden kurulumla değil. Web rota
  değişiminde sayfayı söküp yeniden kuruyor ve sorgular kendiliğinden baştan koşuyor.
  Mobilde sekme ekranları ve üstüne yığın açılan ekranlar KURULU kalıyor, `useAsync` de
  odak dinlemiyor. Tazelenmeyen ekran geri dönülünce eski veriyi gösterir; bu hata iki
  yerde yaşandı (profilde engellenen kişi Keşfet'te kaldı, Arkadaşlar ekranında kabul
  edilen istek profildeki sayıya yansımadı).
  - `ArkadaslarBolumu` her odakta sessizce tazeleniyor: değişikliklerin bir kısmı cihazda
    olmuyor (karşı taraf kabul ediyor) ve kaybedilecek kaydırma yok.
  - Keşfet YALNIZCA engel sürümü değiştiyse tazeleniyor (`src/lib/engelSurumu.js`).
    `yenile()` listeyi 1. sayfadan kuruyor; her odakta çalışsaydı karta dokunup geri
    dönen kullanıcının biriktirdiği sayfaları silerdi. `blockUser`/`unblockUser` çağıran
    her yeni yer başarıdan sonra `engelDegisti()` çağırmalı. Sayaç api.js'e konamaz:
    önizleme api nesnesini `onizlemeApi` ile eziyor.
  - İlk odak `useFocusEffect`'te de çalışır (ekran odaktayken kurulursa); ilk çekimi
    zaten yapan ekranda o çağrı atlanmalı.
- Avatar önbellek sayacı **diskte** (`KEYS.avatarSurumleri`). Fresco'nun disk önbelleği
  uygulama yeniden başlatmalarını aşıyor; sayaç bellekte kalırsa açılışta temel URI'ye
  dönülür ve eski görsel ağa hiç çıkmadan sunulur.
- Giriş sonrası `navigate` ÇAĞRILMAZ: kök `Stack.Protected` guard'ları oturum durumuna
  göre kendisi geçiş yapar (`app/_layout.jsx`).
- Ders geçmişi sayfa boyutu **5** ve FlatList `onEndReached` ile yüklenir (mobil iş
  kuralı); web 20 kullanıyor.
- **"Yeni kod gönder" beklemesi damgadan hesaplanır**, web'deki gibi sayaçtan
  düşülmez (`src/lib/dogrulamaKodu.js`). Web'de doğrulama sayfasına yalnızca kayıt
  ekranından geliniyor, o yüzden "sayacı 60'tan başlat" doğru cevabı veriyor.
  Mobilde doğrulama **ayrı ekran değil**, `app/(auth)/kayit.jsx`'in ikinci adımı
  (2026-09-04; `dogrula.jsx` kaldırıldı). İki girişi var: kayıt akışının kendisi ve
  girişteki `EMAIL_NOT_VERIFIED` kısayolu (`?dogrula=1&email=`). **İkincisinde hiç kod
  gönderilmiyor** — `Login.cs` yalnızca hata fırlatıyor; nereden gelindiğine bakan bir
  sayaç, kodu çoktan ölmüş kullanıcıyı 60 saniye boşuna bekletiyordu.

  ⚠️ Aynı ayrım **metinde de** yapılmak zorunda: o yolda ekran "kod gönderildi" YAZAMAZ,
  yoksa kullanıcı hiç gönderilmemiş bir postayı bekler. Bu hata bir kez yapıldı — sayaç
  doğruydu, cümle yanlıştı.
  Kalan süre artık kodun gerçekten gönderildiği andan türüyor. Damga **diske
  yazılmaz**: yazılsaydı `IzinContext` kuralı gereği `ISLEVSEL_DEPOLAMA`ya girip
  `IZIN_SURUMU`nü artırmak ve izin bildirimini herkese yeniden göstermek gerekirdi.

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

Son senkron baseline'ı: **`6aafac7`** (2026-09-10, web #33'ün birleşmesi). Bir sonraki
senkronda buradaki değeri güncelle, yoksa aynı diff iki kez uygulanır.

### ⚠️ BASELINE 2026-09-21'DE İLERLETİLMEDİ — tek commit SEÇİLEREK taşındı

Normalde baseline taşınan son web commit'ine çekilir. Bu kez çekilmedi ve sebebi
kayda değer: taşınan commit (`3d96b36`, künye + sözleşme sürümü) sıradaki EN YENİ iş
değil, **ortadaki** bir iş. Ondan ÖNCE gelen iki commit hâlâ taşınmadı. Baseline
`3d96b36`'ya çekilseydi o ikisi diff'ten düşer ve bir daha hiç görünmezdi — bu
dosyanın aşağıda "ters yönü daha kötü" diye uyardığı durumun ta kendisi.

`6aafac7..HEAD` aralığında `frontend/src`'ye dokunan altı commit var, durumları:

| commit | iş | durum |
|---|---|---|
| `ac0a6bf` | analitik `page_path` GUID sızdırıyordu | ⬜ **incelenmedi** — mobilde GA yok ama `trackEvent` parametreleri kontrol edilmeli |
| `03dc360` | sunucu tarafı çıkış ucu (`/api/session/logout`) | ✅ **taşındı** (2026-09-21) — `oturumuSonlandir`, mobil yolu `/api/v1/session/logout` |
| `8f35fb6` | localStorage yenileme token'ı + kayıt numaralandırma | ✅ web'de de ERTELENDİ, taşınacak bir şey yok |
| `3d96b36` | künye + sözleşme sürümü 2026-09-19 | ✅ **taşındı** (2026-09-21) |
| `8dfad75` | rol token + EXIF + analitik (web PR #34) | ⬜ **incelenmedi** — EXIF temizliği mobil yüklemeleri de ilgilendirebilir |
| `284cccb` | main'in güvenlik dalına birleşmesi | — |

Kalan iki ⬜ kapanmadan baseline ilerletilmemeli. (`03dc360` 2026-09-21'de kapandı;
en eski açık iş artık `ac0a6bf`, yani baseline en fazla oraya kadar düşünülebilir —
ama o da incelenmeden değil.)

`b93422a..6aafac7` aralığında `frontend/src`'ye dokunan her PR ya taşındı ya da mobilde
karşılığı yok: #21 → mobil PR #6 (`fe8e875`); #26, #29, #30, #31, #33 →
`ozellik/web-esitleme-26-33` dalı; #24 ve #25 → aşağıdaki "bilerek taşınmayanlar".
#28 ve #32 yalnızca sunucu/araç, `frontend/src`'ye dokunmuyor.

⚠️ BASELINE'I GÜNCELLEMEYİ UNUTMAK SESSİZ BİR HATADIR ve bir kez yaşandı: değer
`7f140a9`'da (25 Ağustos) kalmışken mobil aslında iki tur daha ilerlemişti, bu yüzden
diff on günlük bitmiş işi de "yapılacak" diye gösteriyordu. Ters yönü daha kötü:
baseline ileri kalırsa gerçek bir fark hiç görünmez.

**Bilerek taşınmayan işler** — üçünün de mobilde karşılığı yok, port edilecek bir şey yok:

- `0015860`, Keşfet filtre sütununun ekrana yapışması: web'de yan sütun sayfa ile
  birlikte kayıyordu, `position: sticky` ile sabitlendi. Mobilde filtreler yan sütunda
  değil ALT SAYFA MODALINDE ve modal zaten ekranda sabit.
- Web #24 (`59fe4dd`), çerez şeridinin altındaki içeriği tıklanamaz yapması: web'in
  `fixed` şeridi altına yer ayırmıyordu (`CookieBanner.jsx`). Mobilde şerit yok; veri
  tercihleri alt sayfa modalında soruluyor.
- Web #25 (`af0e531`), dar ekran menü çekmecesinin kendi perdesinin altında kalması:
  web'in hamburger menüsü (`Layout.jsx`). Mobilde menü yok, gezinme sekme çubuğundan.

⚠️ `api.js` yüzeyini karşılaştırmak için metot adlarını çıkarıp kümeleri karşılaştır.
Bilinçli fark **4 web ↔ 6 mobil** (2026-09-11 ölçümü: web 78, mobil 80 metot):

| web | mobil |
|---|---|
| `proofContentUrl` | `proofImageSource` |
| `avatarObjectUrl` | `avatarImageSource` + `rememberLocalAvatar` (yalnızca mobil) |
| `adminProofContentUrl` | `adminProofImageSource` |
| `adminTeacherDocument` | `adminTeacherDocumentSource` |
| — | `teacherDocumentSource` (kendi belgesini geri okuma; web'de karşılığı yok) |

Gerekçe: web baytları blob olarak indirip object URL'e çeviriyor, RN'de
`URL.createObjectURL` yok. Mobil `*Source` metotları yalnızca `{ yol }` döndürüyor;
baytları `authedImageDataUri` axios ile indirip data URI yapıyor (`YetkiliGorsel`).
`<Image source={{uri, headers}}>` DEĞİL, yukarıdaki ⛔'ye bak. Listede olmayan bir fark
senkron hatasıdır.

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
