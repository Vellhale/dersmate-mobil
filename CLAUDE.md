# dersmate Mobil — çalışma kuralları

dersmate (PeerLearn) akran öğrenme platformunun **React Native (Expo) mobil uygulaması**.
Web sürümü ve backend `C:\projeler\dersmate` içinde; backend .NET 8 + PostgreSQL + SignalR
ve **değişmez** — mobil yalnızca istemcidir. **İletişim dili Türkçe** — kod yorumları,
commit mesajları ve kullanıcıya görünen her metin Türkçe.

⚠️ **Tek bilinçli istisna: push bildirimleri (2026-09-25, kullanıcı onayıyla).** Push
sunucusuz yapılamazdı; sunucu + web + mobil aynı iş olarak, aynı adlı dalda
(`ozellik/push-bildirimleri`) değişti. Sunucuya eklenenler: `comms` şemasında
`PushDevices`, `Notifications` (defter + outbox), `PushTickets`,
`NotificationPreferences`, `MessagePushThrottles`; `/api/v1/push/*` uçları; olay
noktalarında deftere yazım; çıkış/ban/hesap silmede cihaz silme; gönderim işleri. Ayrıntı
"Push bildirimleri" bölümünde. Bu istisna kuralı gevşetmiyor — sıradaki mobil iş yine
yalnızca istemci.

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

**expo-notifications (2026-09-25) manifesti DEĞİŞTİRMEDİ — bilinçli.** Pod'un kendi
`PrivacyInfo.xcprivacy`'si yalnızca UserDefaults / `CA92.1` beyan ediyor; uygulama
manifestinde zaten var. Push token'ı `NSPrivacyCollectedDataTypeDeviceID` altında sayılıyor
(o da zaten beyanlı), yeni kod `Application.getInstallationTimeAsync` (unutma işaretinin
yeniden kurulum kontrolü) `C617.1` kapsamında. iOS paketinde Firebase YOK (APNs doğrudan),
yani üçüncü taraf toplama SDK'sı da gelmedi. ⬜ İlk push'lu `.ipa`'da aşağıdaki kontrolle
doğrulanacak.

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
yerleşirse ilk SDK eklendiği gün sessizce eksik beyan verilir. (Push bunu değiştirmedi:
expo-notifications veri toplamıyor, token Expo'ya hizmet sağlayıcı olarak gidiyor ve
DeviceID türünde zaten beyanlı. Android'in Play Data safety formu ise AYRI iş: "Device or
other IDs" — FID ve push token — Firebase ağ ölçümünden SONRA işaretlenir.)

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

⚠️ **İLK KURULUMDA GELİŞTİRİCİ MODU** (ölçüldü 2026-09-23). iOS 16'dan beri ad-hoc /
geliştirme imzalı uygulamalar, cihazda **Geliştirici Modu** açık olmadan AÇILMIYOR.
Uygulama kuruluyor, ikon ana ekranda beliriyor, dokununca "geliştirici modu olmadan
açılamaz" uyarısı çıkıyor — kurulum hatası sanılıyor, değil.

Yol: **Ayarlar → Gizlilik ve Güvenlik → Geliştirici Modu** → aç → cihaz yeniden başlar →
kilidi açınca onayla. Tek seferlik; cihaz başına bir kez.

Menü satırı ancak cihaza geliştirme imzalı bir uygulama kurulduktan SONRA beliriyor,
yani kurulumdan önce aramaya çalışma. TestFlight'tan gelen paketlerde bu gerekmiyor —
yalnızca ad-hoc dağıtımda.


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
| 4.5.4 push bildirimleri | ✅ (2026-09-25) zorunlu değil — izin vermeyen kullanıcıda uygulama aynı çalışır, bekleyen iş çekmece sayaçlarından görünür; reklam/pazarlama için kullanılmıyor; türler Profil › Bildirim ayarları'ndan tek tek kapatılır |
| İzin öncesi ekran (HIG, 5.1.1) | ✅ iOS'ta izin hiç sorulmamışken aydınlatma modalında TEK düğme "Devam" ve modal kapatılamıyor; karar sistem isteminde verilir (`BildirimIzniSorusu.jsx`). Android'de "Şimdi değil" duruyor |
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

#### 2026-09-25: push ile `2026-09-19` → `2026-09-25`, üç yer AYNI dalda

Push yeni bir veri türü, yeni alıcılar (Expo, Google FCM, Apple APNs) ve yeni bir yurt
dışı aktarım getirdiği için artış ZORUNLUYDU. Sunucu (`LegalDocuments.cs`), web ve mobil
(`src/lib/yasalMetinler.js`) `ozellik/push-bildirimleri` dalında birlikte çekildi; mağazada
hâlâ uygulama olmadığı için "önce mobil yayın" sırası bu kez de gerekmedi. Sayı yine
METİNLE birlikte taşındı: `app/gizlilik.jsx` §2/§3/§4/§5/§6/§7 ve `IzinContext` zorunlu
kategori metni. ⚠️ Mağazaya ilk çıkış bu değerle olacak — ilk yayından SONRAKİ ilk artış,
yukarıdaki ters sırayı ilk kez gerçekten uygulayacak iş.

`IZIN_SURUMU` (veri izni sayfası) bu turda ARTMADI: push'un iki cihaz saklaması (bildirim
bileşeninin kurulum numarası/adresi ve çevrimdışı çıkıştaki unutma işareti) izne tabi
değil, "zorunlu" kategoride. Kural `IzinContext.jsx`'te: sürüm izne TABİ kapsam değişince
artar.

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

⚠️ Push (2026-09-25) bu açığı BÜYÜTTÜ ve kapatmadı: web `/gizlilik`'e push aynı dalda
"mobil uygulamada" kapsamıyla ekleniyor ama sayfa yine web metni (çerez, GA, tarayıcı
parmak izi).
`/gizlilik-uygulama` bilerek bu turda yapılmadı — ayrı PR. Google Play de herkese açık
gizlilik adresi istiyor; iki mağaza aynı adrese bağlanmalı.

---

## Push bildirimleri (2026-09-25)

Expo Push; uygulama kapalıyken de gelir. **Gönderen sunucu** (Expo → Android'de FCM,
iOS'ta APNs); mobilin işi kayıt, izin, aydınlatma, dokunuş yönlendirmesi, ön plan
tazelemeleri ve ayarlar. Sunucu tarafının tuzakları sunucu deposunun CLAUDE.md'sinde.
Kimlik bilgileri ve profil başına durum `docs/eas-profilleri.md` → "Push bildirimleri".

### Dosyalar

| dosya | iş |
|---|---|
| `src/lib/bildirimler.js` | expo-notifications'ı içe aktaran TEK modül: kanallar, izin, token kaydı (tek uçuş), dinleyiciler, rota beyaz listesi, sunulan bildirimleri kapatma, unutma işareti |
| `src/state/BildirimSaglayici.jsx` | oturumlu yarı: tercihler, aydınlatma bayrağı, kayıt, dokunuş yönlendirmesi, ön plan tazelemeleri, aktif sohbet, rozet, aydınlatma sorusunun kuralları → `useBildirim()` |
| `src/components/BildirimIzniSorusu.jsx` | `BildirimIzniModali` (kökte tek örnek), `BildirimIzniKarti` (satır içi), `TASIYICI_METNI` |
| `app/bildirimler.jsx` | Bildirim ayarları — tek girişi Profil › "Bildirim ayarları" (çekmecede YOK: ayar bir gezinme hedefi değil) |
| `src/lib/bekleyenIsler.js` | çekmece sayaçlarının deposu (bkz. "Gezinme → Rozetler") |
| `src/lib/iliskiSurumu.js`, `src/lib/dersSurumu.js` | sürüm sayaçları: `engelSurumu` deseni + abone listesi |
| `plugins/firebase-otomatik-baslatma.js`, `assets/bildirim-ikonu.png`, `app.config.js` | yerel yapılandırma; `googleServicesFile` yalnızca kökte `google-services.json` VARSA |

Sağlayıcı ağacı (`app/_layout.jsx`, oturumlu dal): `WalletProvider > InboxProvider >
BildirimSaglayici > (CekmeceSaglayici, UrunTuru, BildirimIzniModali)`. Gelen kutusunun
İÇİNDE, çünkü ön planda gelen mesaj bildirimi sohbet listesini tazeliyor ve ikon rozeti
okunmamış toplamından yazılıyor.

### ⛔ Kırılmaz kurallar

- **expo-notifications `bildirimler.js` DIŞINDA içe aktarılmaz.** Paket
  `requireNativeModule` kullanıyor ve modülü taşımayan kabukta (push'tan önce derlenmiş
  dev client / APK / `.ipa`) import anında fırlatıyor; köke konan bir import uygulamayı
  açılışta düşürürdü. Modül tembel, korumalı `require` ile yükleniyor; yüklenemezse (ve
  önizlemede, web'de, Expo Go'da) her dışa açılan fonksiyon no-op döner.
- **`app/_layout.jsx`'teki yan etkili `import '../src/lib/bildirimler'` silinmez.**
  `setNotificationHandler` modül yüklenirken kuruluyor; işleyici yoksa ön planda gelen
  bildirim HİÇ gösterilmez.
- **Kanal kimlikleri sunucudaki `BildirimKanallari` ile BİREBİR:** `mesajlar`,
  `istekler`, `ders-onayi`, `ders-plani`. Sunucu cihazın tanımadığı bir kanala gönderirse
  Android bildirimi SESSİZCE düşürür. Önem (importance) kanal ilk oluşturulurken sabitlenir
  ve sonradan DEĞİŞMEZ: değişecekse yeni kimlik + eski kanalı silme, iki depoda aynı gün.
  Dördü de kilit ekranında PRIVATE. Tercih kategorisi kimliği (`PUT
  /push/preferences/{kategori}`) kanal kimliğinin aynısı; GET yanıtındaki alan adı
  camelCase (`dersOnayi`) — eşleme `KANALLAR[].tercih`.
- **Aydınlatma kapısı:** token YALNIZCA işletim sistemi izni VE sunucudaki
  `aydinlatmaAtUtc` birlikteyken alınır (`setAydinlatmaTamam`). Android 7-12'de izin
  kurulumla açık gelir; izne bakmak kullanıcıyı hiçbir şey görmeden kaydetmek olurdu (KVKK
  Aydınlatma Tebliği m.5/1(b)). Sunucu da damgasız kaydı `kayitli: false` ile almıyor.
- **Sohbet ekranı `setAktifSohbet` ÇAĞIRMAZ.** Aktif sohbet sağlayıcıda `usePathname`'den
  yazılıyor (odaktaki rota; üstüne profil itilince kendiliğinden düşer); ikinci bir yazan
  iki doğruluk kaynağı olurdu. Sohbetin kendi işi: açılışta, odağa dönüşte ve odaktayken
  öne gelişte `sunulanlariKapat({ grup: 'mesaj', kayitId })` + `markRead`.
- **Yönlendirme `router.navigate`, push DEĞİL** ve hedefler `guvenliRota` beyaz
  listesinden geçer: `/sohbet/<id>`, `/eslesmeler?sekme=incoming|active`,
  `/dersler?ders=<id>`, `/bildirimler`. Hepsi `dangerouslySingular` (sohbet kimlik
  başına; gerekçe "Korunan iş kuralları" 3).

### ⚠️ Tuzaklar ve açık ölçümler

- **Firebase otomatik başlatma KAPALI** (`plugins/firebase-otomatik-baslatma.js`):
  aydınlatmadan önce Firebase'e istek çıkmasın diye. ⬜ Kapalıyken `getExpoPushTokenAsync`
  token veriyor mu, cihazda ÖLÇÜLMEDİ. Vermezse token isteminden hemen önce
  `FirebaseMessaging.setAutoInitEnabled(true)` çağıran küçük bir yerel modül gerekir —
  bilerek yazılmadı, risk kabul edildi. Aynı ölçüm release APK'nın taze kurulumunda,
  aydınlatma onaylanmadan `firebaseinstallations.googleapis.com` /
  `fcmregistrations.googleapis.com`'a istek ÇIKMADIĞINI da göstermeli; gizlilik §4/§6
  ve Play Data safety bu ölçüme bağlı.
- **Android'de `collapseId` YOK** (sunucu, `BildirimYuku.cs`): Expo onu FCM
  `collapse_key`'e yazıyor ve FCM çevrimdışı cihaz için yalnızca dört anahtar saklıyor;
  beşinci sohbetin mesajı hiç ulaşmayabilirdi. Ekrandakini değiştiren alan `tag`. iOS'ta
  `collapseId` + `threadId` var. Mobilde sonucu: sunulan bildirimleri kapatma
  (`sunulanlariKapat`) etikete değil, `data.url`'deki kayıt kimliğine ve türe bakıyor.
- **`data` yalnızca `{ tur, url, alici }`.** `alici` hesabın HMAC etiketi, GUID değil:
  telefonda başka hesap açıksa ön plan işleyicisi bildirimi bastırır, dokunuş gezinmez
  (etiket henüz gelmediyse en fazla 3 sn beklenir).
- **Dokunuş:** soğuk açılış ve sıcak dokunuş TEK `isle()`'den geçer ve İKİ yol da son
  yanıtı temizler (yalnızca soğuk yolda temizlense çıkış-giriş sonrası eski dokunuşa
  yeniden gidilirdi). 24 saatten eski ya da varsayılan olmayan eylem yok sayılır.
  Oturumsuzken yanıt yerel modülde bekler ve girişte işlenir; başka hesapta etiket tutmaz.
  `?sekme=` ve `?ders=` efektle işlenip adresten siliniyor (`?rezerve=` kalıbı). `?ders=`
  kararı dersin GÜNCEL durumundan verilir (adres türü taşımıyor): onay bekliyorsa
  `ApproveModal`, değilse duruma göre bilgi kutusu. Kökte `IzinSayfasi` ya da bildirim
  sorusu açıkken `ApproveModal` kendiliğinden AÇILMAZ (iOS'ta iki RN Modal üst üste).
- **Çıkış ve unutma işareti:** `logout` → `oturumKapandi()` → `oturumuSonlandir(rt)`;
  `false` dönerse `unutmaIsaretle()` (SecureStore, `KEYS.pushUnutulacak`, değeri yalnızca
  zaman). Cihaz kaydını çıkışta SUNUCU siliyor; mobil ayrı silme isteği atmaz. Açılışta
  (oturumlu ya da değil) bir kez `unutmaCalistir()` → `POST /push/devices/forget`. iOS
  Keychain işareti uygulama silinse de taşıdığı için kurulum zamanı işaretten sonraysa
  işaret ATILIR — yoksa yeni kurulumda aydınlatmasız APNs/Expo çağrısı olurdu.
  `onAuthExpired`'da işaret yazılmaz (orada oturum zaten ölü). Bilinen sınır: çevrimdışı
  çıkıştan sonra uygulama bir daha hiç açılmazsa, o cihazın en yeni oturumu dolana kadar
  (60 gün) bildirim gidebilir — gizlilik §5'te yazılı.
- **`useBildirim()` sağlayıcı dışında FIRLATMAZ**, no-op nesne döner (`useAuth` /
  `useInbox` kalıbından bilinçli ayrılış: push isteğe bağlı katman, istek gönderen
  bileşeni düşürmemeli).
- **Yeni bir kullanıcı işlemi** ilişki ya da ders durumunu değiştiriyorsa başarıdan sonra
  `iliskiDegisti()` / `dersDegisti()` çağırmalı (bkz. "ODAKTA tazelenir"). Engelleme hem
  `engelDegisti()` hem `iliskiDegisti()` çağırıyor: engel bekleyen istekleri kapatıyor.

### Aydınlatma sorusu kuralları

- İhtiyaç: (izin yok ve sorulabilir) ya da (izin var ama aydınlatma yok).
- Tetikler: istek gönderildi / kabul edildi → modal, kaynak alt sayfa kapandıktan
  `IZIN_KAPANMA_SURESI` (350 ms) sonra (kaynak sayfa yoksa `{ gecikme: 0 }`); sohbette ilk
  mesajdan sonra, Derslerim'de yaklaşan ders varken, Arkadaşlar'ın Gelen sekmesinde istek
  varken → satır içi kart; ayarlar ekranı → elle.
- **Oturum başına TEK yüzey** (modal ya da ilk kart; modal `onShow` anında, kart ilk
  görünüşünde işaretlenir — `ui.jsx` Modal'a `onShow` bu yüzden eklendi). Sonucu:
  Arkadaşlar'da "gelen-istek" kartı yüzeyi kabulden ÖNCE sahiplendiği için "istek-kabul"
  modalı orada pratikte açılmıyor. Kod tasarıma uygun; öncelik değişecekse ürün kararı.
- Geri çekilme sunucu sayacından: 0 serbest, 1 → 14 gün, 2 → 60 gün, 3+ → yalnızca
  ayarlar ekranından elle.
- Kendiliğinden açılmış sorunun HER kapanışı (✕, karartma, geri tuşu, "Şimdi değil",
  "Gizle") `Ertelendi` sayılır; elle açılan sayılmaz. **Sistem isteminde ret de
  `Ertelendi`**: Android 13+'ta ilk retten sonra `canAskAgain` true kaldığı için geri
  çekilmesiz soru her oturumda dönerdi.
- İzin sayfası ya da ürün turu açıkken sorulmaz (`UrunTuru.jsx` → `urunTuruAcikMi`,
  `urunTuruDinle`).
- iOS'ta izin hiç sorulmamışken TEK düğme "Devam" ve modal kapatılamaz (HIG); Android'de
  ve kartta "Şimdi değil" / "Gizle" var.
- Metnin tek kaynakları: `KANALLAR[].aciklama` (modal listesi + ayarlar satırları) ve
  `TASIYICI_METNI` (modal, kart, ayarlar ekranı). Gizlilik §2–§7 aynı olguları uzun
  anlatıyor; biri değişirse diğerleri de.

### Sunucu kuralları (mobil metinleri bunları anlatıyor)

Sessiz saat 22:00–09:00 TR (UTC+3 sabit); mesaj ve yaklaşan ders hatırlatması
etkilenmez. Günlük istek özeti 10:00 TR. Ders başına hatırlatmalar: yaklaşan ders 60 ve
10 dk, otomatik onay 24 ve 2 sa. **İsteğin reddi BİLDİRİLMEZ** (engeli sızdırırdı).
**Mesaj içeriği push'a HİÇ girmez**; kişi adı yalnızca mesaj ve kabul bildiriminde
(alıcının kendi arkadaşı), istek ve ders bildiriminde ad yok, konu olabilir. Bunlardan
biri değişirse aydınlatma metni, ayarlar ekranı ve gizlilik metni birlikte değişir — ve
yeni bir ifşaysa `SOZLESME_SURUMU` da.

### Önizleme

`?izin=verildi|verildi-aydinlatmasiz|reddedildi|belirsiz|desteklenmiyor` (varsayılan
`desteklenmiyor`; açılışta bir kez okunur). `onizleme.js`'teki altı sahte metot sunucu
kurallarını taklit ediyor: aydınlatmasız kayıt `kayitli: false`, bilinmeyen kategori
404 (sunucu `BildirimTercihleri.cs` 404 veriyor; taklit 2026-09-25'e kadar 400 diyordu),
geçersiz karar 400, 10 dakikada 4. deneme 429 — hata kodu üçünde de sunucununki
(`VALIDATION_FAILED`). Web'de expo-notifications YOK: soğuk açılış, sıcak dokunuş,
ön plan işleyicisi, rozet, `sunulanlariKapat` ve unutma işareti yalnızca cihazda sınanır.

### Kullanıcı adımları (cihaz doğrulamasından önce, elle)

1. Firebase projesi → Android uygulaması `com.dersmate.app` → `google-services.json`
   kökte (depoya girer). Yoksa derleme kırılmaz ama Android token alamaz.
2. FCM V1 hizmet hesabı anahtarı (GİZLİ) → `eas credentials` ile EAS'e; sonra
   bilgisayardan kaldırılır.
3. API anahtarı kısıtlanacaksa SHA-1, upload anahtarının DEĞİL Play App Signing
   anahtarınınki; yanlışı token alınamaması demek.
4. iOS: ilk `eas build -p ios` sırasında "Setup Push Notifications" → evet (Apple hesap
   başına en fazla iki APNs anahtarı; önce mevcutlara bak).
5. expo.dev'de iki robot (geliştirme, üretim) + erişim token'ı; gereken en düşük rol
   sunucunun `--test-push` komutuyla ölçülür. Üretim token'ı sunucuda `.env.production`
   → `PUSH_ACCESS_TOKEN`. ⚠️ Yerel sunucunun varsayılanı `Push:Provider=Log`: bildirim
   Expo'ya HİÇ gitmez, yalnızca maskeli günlüğe yazılır. Cihazda push görmek için API
   `Push__Provider=Expo` ve `Push__AccessToken=<geliştirme robotu>` ile başlatılır;
   üretimde `Log` kalırsa sunucu durmaz, açılışta uyarı yazar (dağıtım Expo anahtarına
   bağlı kılınmadı).
6. Sunucu Bearer'la göndermeye BAŞLADIKTAN SONRA Expo'da "Enhanced Security for Push
   Notifications" açılır. Ters sırada her bildirim `UNAUTHORIZED` ile düşer.
7. YENİDEN DERLEME şart: geliştirme istemcileri, ad-hoc `.ipa`'lar, APK. Eski paketler
   push almaz; iOS'ta yetki eklendiği için tedarik profilleri de yenilenir. Yerel APK
   kısa yoldan (`C:\dm`), prebuild sonrası `local.properties` yeniden. Expo Go'da push
   yok; Google Play hizmetli Android emülatörü geçerli.
8. Üretim sunucusu `exp.host:443`'e çıkabilmeli.
9. Hukuk: güncellenen gizlilik metni ve yurt dışı aktarım dayanağı (KVKK m.9, standart
   sözleşme, 5 iş günü içinde bildirim) hukukçuya okutulur.
10. Mağaza formları Firebase ölçümünden SONRA: Play Data safety → "Device or other IDs"
    collected, App functionality; App Store formu manifestle tutarlı.

### ⬜ Cihaz senaryoları (M9)

Soğuk açılış dokunuşu · oturumsuzken dokunup giriş (aynı hesapta gidilir, başka hesapta
gidilmez) · sohbet → profil → aynı sohbetin bildirimine dokun → geri → canlı mesaj geliyor
mu · aynı sohbet açıkken ön plan bildirimi bastırılıyor mu · sohbet açıkken kilitle, mesaj
gelsin, ikondan dön → bildirim kalkıyor ve karşı tarafta okundu · çevrimdışı çıkış →
işaret → sonraki açılışta forget · Android 7-12'de aydınlatmasız kayıt OLUŞMUYOR · iOS'ta
tek düğme ve kapatılamazlık · onay bildirimi → `ApproveModal` (soğuk ve sıcak) ·
otomatik onaylanmış dersin eski bildirimi → "tamamlandı ve onaylandı" · iptal bildirimi →
"Bu ders iptal edildi." · kabul/ret sonrası son istek de gidince istek bildirimleri
kalkıyor · Android'de kanal kapatınca ayarlar ekranında amber satır ve "Aç" kanal
ayarına gidiyor · `__DEV__` yerel deneme düğmeleriyle dört türün yönlendirmesi ·
Firebase ağ ölçümü (yukarıda) · ilk push'lu `.ipa`'da privacy manifest kontrolü.

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

## Gezinme — çekmece, sekme çubuğu YOK (2026-09-23)

Uygulamada **alt sekme çubuğu yok**; gezinmenin tek yolu sol üstteki hamburgerden açılan
çekmece (`src/components/Cekmece.jsx`). Web'in sol rayının (`Layout.jsx` → NAV) birebir
karşılığı: Keşfet · Ders Portföyü · Arkadaşlar · Sohbet · Derslerim · Topluluk
(+ yöneticide Yönetim). **Listeden düşen hedef uygulamada ULAŞILAMAZ olur.**

Ana ekran (`/`) **Topluluk** — burada web'den bilinçli olarak ayrılıyoruz (web `/kesfet`
açıyor). Ürün kararı.

### Düzleştirme: `(tabs)` grubu YOK

Beş kabuk ekranı kök yığında: `app/index.jsx` (Topluluk), `kesfet`, `olustur`,
`mesajlar`, `profil/index`. Grup klasörü URL üretmediği için **adresler değişmedi**.

⛔ **`dangerouslySingular` ŞART** (`app/_layout.jsx`). expo-router'ın StackRouter'ı
`navigate`de mevcut rotayı yalnızca hedef O ANKİ rotayla aynıysa yeniden kullanıyor;
çekmeceden gezinme aksi hâlde her seferinde yeni ekran İTER (Topluluk→Keşfet→Mesajlar→
Topluluk = dört ekran). Bayrak, StackRouter'ı "mevcut rotayı bul ve EN ÜSTE TAŞI"ya
çeviriyor: yığın sınırlı kalıyor ve ekran SÖKÜLMÜYOR, yani Keşfet'in biriken sayfaları
yaşıyor. Yeni bir kabuk/çekmece hedefi eklenirse ona da verilmeli.

⚠️ Kökte **`anchor` YOK** ve bu ölçülmüş: kök layout'un rota adı boş olduğu için
expo-router varsayılan anchor kurmuyor, React Navigation `routeNames[0]`e düşüyor ve
guard'lar doğru ekranı bırakıyor. `anchor: 'index'` eklemek her derin bağlantının altına
1900 satırlık Topluluk'u iterdi.

`app/+not-found.jsx` web'in `path="*"` davranışını veriyor (bilinmeyen adres → Keşfet;
oturumsuzsa → giriş). Sabit hedef veremez: korunan ekranlar guard kapalıyken rota
ağacında hiç yok, koşulsuz `/kesfet` sonsuz döngü olurdu.

### Tur çıpaları

`rutbe`, `kesfet`, `portfoy`, `sohbet` çıpalarının TEK kaydı sekme düğmeleriydi; çubuk
gidince dördü de düştü ve o adımlar **çıpasız** bırakıldı — `tur.js` bunu zaten KURAL
sayıyor (çıpasız adım ortada kart). `menu`ya yığmak beş adımı aynı 44px kutuya
işaret ettirirdi. Adım metinleri "sekmesinde" demekten "sol üstteki menüde"ye çevrildi.

⛔ **Çekmecenin İÇİNE çıpa konulamaz:** RNModal ayrı pencere, kapalıyken satırlar takılı
değil ve tur örtüsü açıkken kullanıcı çekmeceyi açamıyor.

⚠️ `menu` çıpası **her kabuk ekranında** kayıtlı (hamburger her birinde ayrı örnek) ve
kök yığın alttakini monte tutuyor. `tur.js`'in ölçüm defteri bu yüzden **sayaçlı**:
sahiplerden biri sökülünce çıpa ölmüyor, son sahip çıkınca düşüyor.

### Rozetler: hamburger ve çekmece satırları

Sekme çubuğundaki `tabBarBadge` gitti; okunmamış mesaj rozeti **hamburger düğmesinde**.
Çekmeceye taşınsa yalnızca menü açılınca görünürdü — kullanıcı yeni mesajı fark edemezdi.

Çekmece SATIRLARINDA üç sayaç var (2026-09-25, push işiyle geri geldi): Arkadaşlar →
gelen istek, Derslerim → işlem bekleyen ders, Sohbet → okunmamış. Hepsi aynı rose-600
hap (renk rolleri: sayaç = rose), sıfırken çizilmiyor; erişilebilir ad satıra göre ("Arkadaşlar, 1
gelen istek", "Derslerim, 2 ders işlem bekliyor", "Sohbet, 2 okunmamış").

Veri `src/lib/bekleyenIsler.js` → `useBekleyenIsler()`: kanca DEĞİL, modül düzeyinde depo
ve tek uçuş. Hamburger her kabuk ekranında ayrı örnek; kanca olsaydı her örnek aynı iki
isteği ayrı atardı. Son abone ayrılınca sıfırlanıyor, hesap değişimi de sınanıyor.

⬜ Hamburger rozeti hâlâ YALNIZCA okunmamış mesajı gösteriyor; gelen istek ve bekleyen
dersi de toplayıp toplamayacağı açık ürün sorusu.

## Web'den bilinçli sapmalar

- **Mobilde yeşil YOK** (kullanıcı kararı, A düzeni: yeşil marka paletinin dışındaydı). `Button`'da
  `success` varyantı kalktı; "Kabul et / Onayla / Doğrula" gibi olumlu eylemler `primary`
  (brand-600). Olumlu durum rozeti brand-100 + brand-800, başarı bildirimi (`Notice success`)
  brand-50 + brand-200 kenar + brand-800 metin. Web hâlâ emerald kullanıyor — bilinçli fark;
  web sayfası port edilirken emerald sınıfı taşınmaz, "Dokunma ve yüzey dili"ndeki rol tablosuna
  çevrilir. `theme.js`'te `emerald` export'u da yok.
- **Büyük harf `uppercase` sınıfıyla YAZILMAZ**: RN metni dil bilgisiz büyüttüğü için "SANA ANLATABILIR"
  çıkıyordu. Yerine `UstEtiket` (ui.jsx) ya da `buyukHarf` (`src/lib/metin.js`, yalnızca mobil;
  `format.js` web kopyası olduğu için ona eklenmedi). Web'de `lang="tr"` doğru çevirdiği için
  `uppercase` kalıyor — port ederken sınıfı taşıma.
- **Rezervasyon bağlamı adresten** (`/dersler?rezerve=<matchId>`) ve öğrencinin konusu TEK tanımdan
  (`src/lib/iliski.js` → `ogrenciKonusu`): Arkadaşlar kartındaki "Ders rezerve et" yalnızca öğrenci
  tarafta, konulu eşleşmede çıkar; anlatan tarafta bilgi satırı var. Web'de `Matches.jsx` düğme koşulu
  ve `Sessions.jsx` ön seçimsiz — aynı çıkmaz orada duruyor.
- **Köşe yarıçapı ve kart gölgesi** (2026-09-14): mobil `tailwind.config.js` yarıçapı px ve bir
  basamak yumuşak (lg 12 · xl 16 · 2xl 20), web Tailwind varsayılanında (lg 8 · xl 12 · 2xl 16)
  ve kartta `shadow-sm`. Sınıf adları aynı: port ederken `rounded-*` değiştirilmez, değer farkı
  config'ten gelir (tek istisna küçük kareler, bkz. "Dokunma ve yüzey dili"). Paletteki "iki
  dosya birden güncellenir" kuralı bu ayar için GEÇERLİ DEĞİL.

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

  `AuthContext.logout` sırası: token'ı OKU → yereli sil → `oturumKapandi()` (push'un
  bellek durumu, sunulan bildirimler, rozet) → `oturumuSonlandir()` ile sunucuda iptal et,
  **beklemeden**. Ağ yokken çıkış yine kesin sonuç verir.

  `oturumuSonlandir` 2026-09-25'ten beri `Promise<boolean>` döndürüyor (sunucu 2xx verdi
  mi) ve yine hiç reddetmiyor. `false` ise push "unutma işareti" yazılır: sunucu çıkışı
  öğrenemediği için cihaz kaydını da silemedi (bkz. "Push bildirimleri").

  ⛔ `oturumuSonlandir` HAM AXIOS kullanır, `request()` değil: istemcinin 401 → yenile
  zinciri, tam da iptal edilmek istenen token'la oturumu tazelerdi.

  ⚠️ İki bilinen sınır (web'de de var): erişim token'ı ömrü dolana kadar (≤2 saat)
  yaşar (tek cihaz iptali damgayı ileri almıyor); ve çıkış anında bir yenileme
  uçuştaysa o turda üretilen yeni token istemcide atıldığı hâlde sunucuda canlı kalır.
  İkincisinin kapatılması sunucunun işi. `onAuthExpired` yolunda bu çağrı YAPILMAZ —
  orada token zaten ölü.
- **Arkadaşlar ekranının rotası `/eslesmeler` kaldı** (`app/eslesmeler.jsx`); web #31'de
  adres `/arkadaslar` oldu, yalnızca kullanıcıya görünen metinler taşındı. Dosyayı
  yeniden adlandırma: çekmecedeki satır (`src/components/Cekmece.jsx` → OGELER),
  `dersmate://eslesmeler` derin bağlantısı ve kök `Stack.Protected` listesi ona bağlı —
  listeye eklenmeyen yeni ad OTURUMSUZ da açılır. (Tur çıpası artık `eslesmeler` DEĞİL:
  2026-09-23'te `menu`ya taşındı, bkz. "Gezinme".) Algoritma anlamındaki "eşleşme" ise "öneri" oldu ("Şimdilik öneri yok"), metin
  eşleşmesi gibi teknik anlamlar olduğu gibi kaldı.
- **Başka ekranda değişen veri ODAKTA tazelenir**, yeniden kurulumla değil. Web rota
  değişiminde sayfayı söküp yeniden kuruyor ve sorgular kendiliğinden baştan koşuyor.
  Mobilde kök yığındaki ekranlar (ve üstlerine açılanlar) KURULU kalıyor, `useAsync` de
  odak dinlemiyor. Tazelenmeyen ekran geri dönülünce eski veriyi gösterir; bu hata iki
  yerde yaşandı (profilde engellenen kişi Keşfet'te kaldı, Arkadaşlar ekranında kabul
  edilen istek profildeki sayıya yansımadı).
  - `ArkadaslarBolumu` her odakta sessizce tazeleniyor: değişikliklerin bir kısmı cihazda
    olmuyor (karşı taraf kabul ediyor) ve kaybedilecek kaydırma yok. İlişki sürümü
    artınca da (`src/lib/iliskiSurumu.js`, yalnızca odaktayken) tazeleniyor.
  - Arkadaşlar (`app/eslesmeler.jsx`) ve Derslerim (`app/dersler.jsx`) odakta, ön plana
    dönüşte (`useOnePlanaGelince`) ve ilişki / ders sürümü artınca (yalnızca odaktayken,
    ekranın KENDİ değişikliği hariç) sessizce tazeleniyor (2026-09-25, push). Sürümü
    artıranlar: push (ön planda gelen, öne gelişte bildirim merkezinde bulunan yeni
    bildirim, dokunuş) ve kullanıcı işlemleri — kabul, ret, sonlandırma, engelleme, istek
    gönderme → `iliskiDegisti()`; rezervasyon, tamamlama, onay, itiraz, iptal →
    `dersDegisti()`. Yeni bir işlem eklenirse o da çağırmalı; yoksa çekmece sayacı ve açık
    duran ekran eski kalır.

    Derslerim'in biriken geçmiş sayfaları yalnızca geçmiş TOPLAMI (`past.totalCount`)
    değişince sıfırlanıyor, `sessions.data` her değiştiğinde değil: geçmişe yalnızca ekleme
    olduğu için toplam aynıysa ofsetler geçerli. Eskisi olsaydı her odak tazelemesi
    kullanıcının kaydırarak yüklediği sayfaları silerdi.
  - Keşfet YALNIZCA engel sürümü değiştiyse tazeleniyor (`src/lib/engelSurumu.js`).
    `yenile()` listeyi 1. sayfadan kuruyor; her odakta çalışsaydı karta dokunup geri
    dönen kullanıcının biriktirdiği sayfaları silerdi. `blockUser`/`unblockUser` çağıran
    her yeni yer başarıdan sonra `engelDegisti()` çağırmalı. Sayaç api.js'e konamaz:
    önizleme api nesnesini `onizlemeApi` ile eziyor.
  - Topluluk (ana ekran) YALNIZCA forum sürümü değiştiyse tazeleniyor
    (`src/lib/forumSurumu.js`) — aynı desen, farklı olay. Verisini değiştiren tek dış
    ekran Yönetim: `moderateForumContent` bir gönderiyi kaldırıyor ve Yönetim çekmeceden
    iki dokunuş uzakta. Bu ekranda da liste `onEndReached` ile birikiyor, o yüzden
    koşulsuz tazeleme yapılamaz.

    ⚠️ Bu madde 2026-09-23'te EKLENDİ ve öncesinde kodda "bu ekranın verisini değiştiren
    BAŞKA ekran yok" diye YANLIŞ bir gerekçe yazılıydı. Yanlıştı: Yönetim değiştiriyor.
  - İlk odak `useFocusEffect`'te de çalışır (ekran odaktayken kurulursa); ilk çekimi
    zaten yapan ekranda o çağrı atlanmalı. ⚠️ Kurulum efektinde indirilen `kuruluyor`
    bayrağı bunu YAPAMIYOR: expo-router'ın `useFocusEffect`'i ilk çağrıyı bir render
    geciktiriyor (`useOptionalNavigation`) ve bayrağı inmiş buluyor. Yeni ekranlar
    `src/state/useOnePlanaGelince.js`'i kullanmalı (kurulum anındaki `isFocused()`'a
    bakıyor). `ArkadaslarBolumu` hâlâ eski kalıpta; önizlemede açılışta `userFriends` iki
    kez çağrılıyor (2026-09-14 ölçümü). `eslesmeler.jsx` 2026-09-25'te
    `useOnePlanaGelince`'ye geçti (çift `myMatches` çağrısı kalktı, öne dönüşte de
    tazeleniyor).
- **Çekmecede bekleyen iş sayaçları mobilde var, web'de yok.** Web `Layout.jsx`
  yalnızca okunmamış mesaj rozeti taşıyor. Mobilde çekmecenin Arkadaşlar satırı gelen
  istek sayısını (`myMatches().incoming`), Derslerim satırı kullanıcının kapatabileceği
  ders sayısını (`mySessions(1, 1)` → `eylemBekliyor`) gösteriyor (bkz. "Gezinme →
  Rozetler"). ⚠️ Bu madde 2026-09-25'e kadar "Akış başlığında" ve "push olmadığı için"
  diyordu; ikisi de bayattı. Akış başlığı 2026-09-23'te gitti ve sayaçlar `3c0f61c`
  birleştirmesinde kayboldu; push işiyle çekmeceye geri geldiler. Push artık var ama
  İSTEĞE BAĞLI: bildirimi reddeden kullanıcıya 14 günde düşen isteği ve 48 saatte otomatik
  onaylanan dersi haber veren tek şey hâlâ bu sayaçlar — push varken de kaldırılmaz.
  "İşlem bekliyor" tanımı TEK yerde (`src/lib/dersDurumu.js` → `eylemBekliyor`) ve
  Derslerim'in aksiyon grubu da onu kullanıyor. Aynı turda Derslerim'de itirazdaki
  (`Disputed`) dersler aksiyon grubundan "İtirazda, karar yönetimde" başlığına çıktı; web
  onları hâlâ aksiyonda gösteriyor. Sayaçlar ön plana dönüşte, çekmece açılırken
  (`bekleyenIsleriTazele`) ve ilişki / ders sürümü artınca tazeleniyor
  (`src/lib/bekleyenIsler.js`); çekmece navigatörün dışında olduğu için odak olayı orada
  YOK ve `useOnePlanaGelince` kullanılamıyor.
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
3. **SignalR tek bağlantı** — `InboxProvider` kök kabukta kurulur, sohbet ekranı kendi
   hub'ını AÇMAZ (iki bağlantı = bölünen gruplar, kaybolan mesajlar). Aynı sebeple
   `sohbet/[conversationId]` KİMLİK BAŞINA tekil (`dangerouslySingular`, 2026-09-25): aynı
   sohbetin ikinci ekranı açılabilseydi, sökülen kopya `LeaveConversation` ile ORTAK
   bağlantıyı gruptan çıkarır ve kalan ekran "Canlı bağlantı" yazarken mesaj almazdı.
   Bildirime dokunmak bu ikinci ekranı açmanın en kolay yoluydu.

## Dokunma ve yüzey dili

- Basılabilir her öğe **min 44px**; girdi puntosu **16px** (`text-base`). Web'de bu
  kurallar `lg` kırılımına bağlıydı; mobilde koşulsuz.

  ⚠️ 44 px ile yazılır: `h-[44px]` / `min-h-[44px]`. Boşluk ve boy sınıfları rem ve NativeWind
  cihazda rem'i **14** sayıyor (`inlineRem`): `h-11` telefonda 38.5dp, `h-9` 31.5, `p-1` 3.5.
  Web önizlemesi rem 16 ile 44 gösterdiği için bu fark ancak cihazda görünür.
- Yüzey dili `src/components/ui.jsx`'te tek yerde: kart = beyaz + `border-slate-100` +
  hafif gölge + `rounded-2xl`; sayfa zemini `bg-slate-50`. Sayfalar kendi yüzey dilini
  icat etmez: kart yüzeyi elle kurulmaz, bölünmüş dolgulu kart `<Card dolgu="p-0"
  className="overflow-hidden">` ile yazılır. Card olamayan kart (basılabilir yüzey) gölgeyi
  `KART_GOLGESI`'nden alır.
- **Köşe yarıçapı px ve Tailwind'den BİR BASAMAK yumuşak** (kullanıcı kararı, 2026-09-14;
  `tailwind.config.js` → `borderRadius`): sm 4 · DEFAULT 6 · md 8 · lg 12 (düğme, girdi,
  uyarı) · xl 16 (iç kutu) · 2xl 20 (kart, alt sayfa) · 3xl 28 (AuthKabuk paneli) · full
  değişmedi. px, çünkü rem cihazda 14'le çarpılıyordu (rounded-lg telefonda 7, önizlemede 8).
  İç içe öğede iç yarıçap ≈ dış − dolgu (segment rayı lg + p-1 → sekme md). Boy hâlâ rem
  olduğu için küçük karelerde yarıçap bir basamak düşürülür: 28dp ve altındaki kutuda lg ve
  üstü daireye döner (`Avatar` tablosu web'den bir basamak aşağıda).
- **Kart gölgesi `boxShadow: 0px 4px 16px rgba(15,23,42,0.06)`** — yayvan ve hafif, tek tanım
  `KART_GOLGESI` (ui.jsx). Android 9 (API 28) altında RN dış `boxShadow` çizmiyor (minSdk 24),
  orada eski `elevation: 1`'e düşülüyor; ikisi birlikte verilmez (API 28+'da çift gölge).
  `overflow-hidden` gölgeyi kırpmıyor.
- **Yığın ekranı başlığı**: geri düğmesi `GeriDugmesi` (ui.jsx; slate-100 daire içinde
  `GeriIkonu` chevron-left). Elle Pressable ve "←" metin glifi YAZILMAZ. Şerit `flex-row
  items-center gap-3 border-b border-slate-200 bg-white px-4 py-2`: px-4, sekme başlığı
  (`EkranBasligi`) ve içeriğin `p-4` kenarıyla aynı hizada. Sohbet başlığı gap-2 (şeritte
  dört-beş öğe var). Dönüş hedefi `onPress` ile verilir; nereye döndüğü önemliyse
  `accessibilityLabel` ("Sohbet listesine dön").
- Renk DEĞERİ gereken yerler (tab bar, SVG, StatusBar) `src/lib/theme.js`'ten okur —
  hex'i elle yazma, palet tek kaynaktan gelsin.
- **Renk rolleri (A düzeni)** — renk anlam taşır, süs değildir:
  - Birincil ve olumlu EYLEM: `bg-brand-600 active:bg-brand-700` + beyaz.
  - Olumlu DURUM (Arkadaşın, Tamamlandı, Yayında, canlı bağlantı): rozet `bg-brand-100
    text-brand-800`, düz metin `text-brand-700`, şerit/nokta `bg-brand-500`.
  - BEKLEYEN / DİKKAT: YALNIZCA amber (rozet `bg-amber-100 text-amber-800`, kutu
    `border-amber-200 bg-amber-50 text-amber-900`). Amber başka anlam için kullanılmaz.
  - TEHLİKE (hata, itiraz, iptal, engel, yıkıcı eylem ve onun geri alınamaz sonucunu anlatan
    uyarı: `Notice tone="danger"`) ve sayaç (`SayacRozeti`, okunmamış mesaj dahil): rose.
  - Anlamsız etiket / kategori (yön, forum kategorisi): `bg-brand-50 text-brand-800` ile
    `bg-slate-100 text-slate-700` sırayla.
  - Yeşil, mor (violet) ve gök mavisi (sky) YOK — kategori ya da avatar rengi olarak da.
  - İstisna, malzeme rengi: değerlendirme yıldızları ve madalya/rozet altın-bronzu amber kalır.

## Adım planı

- **ADIM 1 (tamam):** iskelet, auth stack + tabs, tema, api/state katmanı.
- **ADIM 2 (tamam):** AuthKabuk (bölünmüş tek ekran) + giriş/kayıt/doğrulama; öneri
  kartları (`api.suggestions`) + eşleşme isteği alt sayfası. (Öneriler bir süre ayrı bir
  "Akış" sekmesindeydi; 2026-09-23'te web'deki yerine — Keşfet'in varsayılan kipine —
  döndü, bkz. "Gezinme".)
- **ADIM 3 (tamam):** Kompakt profil (ProfilGorunumu + SubjectBadges + değerlendirmeler),
  profil düzenleme + avatar (ImagePicker), `profil/[userId]`; SignalR sohbet
  (`mesajlar` listesi + `sohbet/[conversationId]` ters FlatList). Sağlayıcılar kökte
  (`app/_layout.jsx`) — yalnızca oturumlu dalda kurulur.
- **ADIM 4 (tamam):** Keşfet (arama + TYT/AYT filtre modalı + üniversite ağı, biriken
  sonsuz kaydırma); İlan oluştur (Portfolio portu — KonuSecici: Sınav→TYT/AYT→Ders→Konu,
  son basamak aranabilir); Derslerim (`app/dersler.jsx`: 5'erli infinite scroll geçmiş,
  rezervasyon + DateTimePicker, ImagePicker kanıt yükleme, onay→değerlendirme zinciri,
  şikayet/iptal, puan geçmişi); Eşleşmeler (`app/eslesmeler.jsx` — kabul/ret/sonlandır).
  Derslerim ve Eşleşmeler kabuk ekranı DEĞİL: çekmeceden ve Profil kısayollarından
  açılan, kendi geri şeridini taşıyan yığın ekranları.
- **ADIM 5 (tamam):** web'in `7f140a9` sonrası tüm işi mobile taşındı — Topluluk forumu
  (`app/topluluk.jsx`), yönetim kuyrukları (`app/yonetim.jsx`), yasal metinler
  (hakkimizda/gizlilik/kosullar + `yasalMetinler.js`), parola sıfırlama, kayıt onayı,
  sohbette taciz bildirimi, üç rozet şeridi, ürün turu, analitik + veri izni.
  `api.js` yüzeyi web ile eşit (71 metot).
- **ADIM 6 (tamam):** hesap silme, itiraz akışı, belge görüntüleyici, `/api/v1` öneki.
- **ADIM 7 (tamam):** e-posta doğrulama 6 haneli koda geçti, yönetim rozeti profile
  bağlandı, gövdesiz 403/404/5xx'e anlamlı metin, topluluk katkı sayaçları.
- **ADIM 8 (push bildirimleri — kod tamam, cihaz doğrulaması bekliyor):** M1–M8,
  `ozellik/push-bildirimleri` dalında (main'e birleşmedi). Sunucu + web aynı adlı dalda.
  ⬜ M9: kullanıcı adımları ve cihaz senaryoları (bkz. "Push bildirimleri"). Sunucu PR'ı
  mobil PR'dan önce birleşir.

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

⚠️ `ozellik/push-bildirimleri` main'e birleşince aynı diff'te üç commit daha görünecek.
Üçü de **ters yönde** (web ← mobil), yani mobile taşınacak bir şey yok:

| commit | iş | durum |
|---|---|---|
| `9cdccbc` | W1 — web api'sine altı push sarmalayıcısı | ✅ mobilden geldi (sözleşme pariteti, bkz. aşağıdaki api tablosu) |
| `f140b6d` | web yasal metinleri: toplanmayan telefon numarası, bayat "Profil sekmesi" | ✅ mobil 2026-09-22 / 2026-09-23'te zaten düzeltmişti |
| `8ec0cea` | W2 — web gizlilik metnine push, silme listeleri, `SOZLESME_SURUMU` 2026-09-25 | ✅ mobil karşılığı `app/gizlilik.jsx` + `yasalMetinler.js` (aynı değer) |

Baseline'a bu üçü yüzünden dokunulmaz: ileri çekmek yukarıdaki iki ⬜'yi diff'ten
düşürürdü.

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
  web'in hamburger menüsü (`Layout.jsx`). Mobilde çekmece RNModal — ayrı bir yerel
  pencere, perde ve panel aynı ağaçta kardeş, yani o hata buraya taşınamaz.
  ⚠️ Bu madde 2026-09-23'ten önce "Mobilde menü yok, gezinme sekme çubuğundan" diyordu;
  artık tam tersi (bkz. "Gezinme").

⚠️ `api.js` yüzeyini karşılaştırmak için metot adlarını çıkarıp kümeleri karşılaştır
(`export const api = {` nesnesinin birinci düzey anahtarları). Son ölçüm **2026-09-25,
iki depo da `ozellik/push-bildirimleri` dalında: web 85, mobil 86 metot**; fark **5 web ↔
6 mobil**:

| web | mobil |
|---|---|
| `proofContentUrl` | `proofImageSource` |
| `avatarObjectUrl` | `avatarImageSource` + `rememberLocalAvatar` (yalnızca mobil) |
| `adminProofContentUrl` | `adminProofImageSource` |
| `adminTeacherDocument` | `adminTeacherDocumentSource` |
| — | `teacherDocumentSource` (kendi belgesini geri okuma; web'de karşılığı yok) |
| `logout(refreshToken, tumCihazlar)` | api nesnesinde YOK — modül fonksiyonu `oturumuSonlandir(refreshToken)`: ham axios (401 → yenile zinciri iptal edilecek token'ı tazelemesin), `Promise<boolean>`, "her yerden çıkış" argümanı yok |

Altı push metodu (`registerPushDevice`, `forgetPushDevice`, `pushPreferences`,
`setPushPreference`, `pushPromptDecision`, `sendTestPush`) iki tarafta da var ve fark
DEĞİL: web onları `9cdccbc`'de (W1) AYNI adla ve AYNI imzayla aldı — `registerPushDevice`
TEK nesne parametresi, `forgetPushDevice` iki tarafta da ham istek, başlıksız ve fırlatan.
Web bu metotları ÇAĞIRMIYOR (web'de push yok); sözleşme iki istemcide aynı kalsın diye
duruyorlar. Bu dal main'e birleşmeden web'in main'i ölçülürse 79 metot görünür ve altısı
"yalnız mobil" çıkar — o fark dalın birleşmesiyle kapanır, senkron hatası değildir.

(Önceki ölçümler: 2026-09-11 web 78, mobil 80. 2026-09-25 W1'den önce web 79, mobil 86.
`logout` web'e 2026-09-19'da `03dc360`'la geldi; 2026-09-21 portu onu api nesnesinin
DIŞINDA taşıdı ve tablo güncellenmedi — 2026-09-25 ölçümüne kadar kayıtsız kalan bir
fark.)

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
