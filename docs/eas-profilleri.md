# EAS profilleri — `eas.json` neden yorumsuz ve her profil ne işe yarıyor

## ⛔ ÖNCE BUNU OKU: `eas.json`'a YORUM YAZILAMAZ

Bu dosya var çünkü `eas.json` bir süre `"//"` anahtarlarıyla belgelenmişti ve o anahtarlar
**eas-cli tarafından reddediliyor**. 2026-09-23'te ilk EAS komutu çalıştırıldığında ortaya
çıktı — depoda daha önce hiç EAS derlemesi yapılmadığı için (ne `owner` ne
`extra.eas.projectId` vardı) yıllarca denenmemişti:

```
eas.json is not valid.
- "build.//" must be of type object
- "build.onizleme.//" is not allowed
- "build.preview.//" is not allowed
- "build.development.//" is not allowed
- "build.production.//" is not allowed
- "build.production-apk.//" is not allowed
- "submit.production.ios.//" is not allowed
- "submit.production.//" is not allowed
    Error: config command failed.
```

Tek bir komut değil, **her** EAS komutu düşüyordu: `eas config`, `eas device:list`,
`eas build`. Yani ilk iOS derlemesini bu engelliyordu.

Sebebi şema: `@expo/eas-json` doğrulamayı `allowUnknown: false` ile yapıyor
(`build/accessor.js:55`, `build/utils.js:78`, `build/build/resolver.js:63`,
`build/submit/resolver.js:66`). Bilinmeyen hiçbir anahtar kabul edilmiyor ve
desteklenen bir açıklama alanı **yok** — JSON5/JSONC de değil, düz JSON.

⚠️ **`eas.json`'a yorum geri eklenmesin.** İçerik buraya taşındı. Yeni bir profil ya da
karar eklenince açıklaması bu dosyaya yazılır, `eas.json` veri olarak kalır.

---

## Ortak: profiller platformlar arasında PAYLAŞILIR

Her profil `--platform ios` ile de çalışır; ayrı bir iOS profili ya da ayrı bir depo
**yok**. Native klasörler (`/ios`, `/android`) `.gitignore`'da: EAS her derlemede
prebuild ile üretiyor, yani iOS için depoya eklenecek hiçbir dosya yok.

**APK profilleri** — `preview`, `onizleme` ve `development` `internal` dağıtım, yani
doğrudan kurulabilen `.apk` üretir. Play Store'un istediği `.aab` yalnızca `production`
profilinde; internal profillerde `android.buildType: "apk"` olmadan EAS varsayılan
olarak `.aab` üretir ve telefona kurulamaz.

⛔ **Bu makinede yerel iOS derlemesi yapılamaz.** Xcode yalnızca macOS'ta çalışır;
`npm run ios` (`expo run:ios`) Windows'ta hata verir, simülatör de yoktur. iOS'un tek
yolu bulut derlemesi: `eas build --platform ios`. Windows'ta çalışan tek yerel sağlama
`npx expo export --platform ios` — JS paketini derler, native'e dokunmaz.

⛔ **Hiçbir iOS profili Apple Developer üyeliği olmadan derlenmez.** Android'de EAS imza
anahtarını kendisi üretebiliyor; iOS'ta sertifika ve tedarik profili Apple'dan gelir.
(Üyelik 2026-09-23'te açıldı.)

---

## `onizleme`

**Backend'siz çalışan demo APK'sı.** `EXPO_PUBLIC_ONIZLEME` derleme anında gömülür;
uygulama sunucuya hiç gitmez, veriler `src/lib/onizleme.js`'ten gelir (bkz. o dosyanın
başlığı). Tasarımı ve akışları gerçek cihazda gezmek için — sunucu, ağ, giriş gerekmez.

iOS'ta bu profil `.ipa` üretir ve `preview`'ın env'ini **miras alır** — yani şifresiz
`EXPO_PUBLIC_API_URL` de gelir ve `app.config.js` ATS istisnasını açar. Demo hiç ağa
çıkmadığı için zararsız, ama en çok elden ele dolaşan paket budur: mağazaya giden sürüm
bu değil, `production`'dır ve orada istisna kapalıdır.

---

## `preview`

**Gerçek APK — backend'e bağlanır.** `EXPO_PUBLIC_API_URL` şart: bağımsız derlemede
`Constants.expoConfig.hostUri` null gelir (Metro yok) ve `api.js` emülatör adresine
(`10.0.2.2`) düşer; gerçek telefonda o adres anlamsızdır.

Değer backend'in LAN adresidir — **ağ değişirse burası da güncellenmeli**. Port 5099:
telefon `dotnet`'e doğrudan ulaşamıyor (güvenlik duvarı kuralları programa bağlı),
`araclar/lan-koprusu.js` üzerinden geçiyor. Ayrıntı: CLAUDE.md → "Yerel arka uç".

⚠️ **iOS'ta `internal` dağıtım Android'deki gibi serbest değil.** Üretilen `.ipa` ad-hoc
imzalıdır ve yalnızca UDID'si Apple hesabına önceden kayıtlı cihazlara kurulur
(`eas device:create`, yılda 100 cihaz sınırı). Kayıtsız bir iPhone'a bağlantıyı açmak
yetmez, kurulum reddedilir.

Test dağıtımı için daha az sürtünmeli yol **TestFlight**: `production` profiliyle
derleyip `eas submit` ile yüklemek UDID kaydı gerektirmez, e-posta davetiyle dağıtılır.
⚠️ Bu profil yerel arka uca bağlandığı için **TestFlight'a uygun değil** — LAN adresi ne
Apple'ın incelemesinde ne de başkasının telefonunda çalışır.

---

## `development`

**Geliştirme istemcisi:** içinde Metro'ya bağlanan bir kabuk taşır (Expo Go'nun projeye
özel hâli). Expo Go'nun SDK uyuşmazlığı sorununu kalıcı olarak çözer — bir kez kurulur,
sonra `npx expo start` ile canlı geliştirme yapılır.

iOS'ta da aynı işi görür ve **Windows'tan geliştirmenin çalışan yoludur**: kabuk bulutta
derlenir, iPhone'a bir kez kurulur, sonrası Metro üzerinden canlıdır — Mac gerekmez.


Ama bu da ad-hoc imzalıdır, yani cihazın UDID'si önce `eas device:create` ile
kaydedilmeli. **Pratikte iOS tarafında atılacak ilk derleme budur**; mağaza paketi ondan
sonra gelir.

### ⚠️ `.env` EAS SUNUCUSUNA GİTMEZ — ATS kararını bu belirler

`.env` `.gitignore`'da, yani EAS derleme sunucusuna **yüklenmiyor**. `app.config.js`
ATS kararını `process.env.EXPO_PUBLIC_API_URL` ile veriyor ve o değişken sunucuda BOŞ.
Sonuç (ölçüldü 2026-09-23): geliştirme istemcisi `NSAllowsArbitraryLoads: false` ile
derleniyor — yani **şifresiz `http://` bağlantılar kapalı**.

Bu bugün DOĞRU olan davranış: `.env` `https://api.dersmate.com` gösteriyor ve Metro
üzerinden gelen JS o adresi kullanıyor. Yerel `.env` dev client'ta GEÇERLİ, çünkü JS'i
bulut değil kendi makinendeki Metro paketliyor.

⛔ **AMA yerel arka uca (`http://192.168.1.111:5099`) geliştirme yapmak istersen bu
istemci ÇALIŞMAZ** ve belirti Android'dekiyle aynı sessiz hatadır: istek cihazdan
çıkmaz, sunucu günlüğü boş kalır. Sebebi ATS ve düzeltmesi JS tarafında değil — native
kabuk yeniden derlenmeli, `development` profiline açık `env` verilerek:

```json
"development": {
  "developmentClient": true,
  "distribution": "internal",
  "env": { "EXPO_PUBLIC_API_URL": "http://192.168.1.111:5099" }
}
```

ⓘ `NSLocalNetworkUsageDescription` dev client derlemelerinde ZATEN var ama bizim
koşulumuzdan gelmiyor: `expo-dev-launcher` Metro'ya LAN üzerinden ulaşmak için kendisi
ekliyor ve release derlemelerinde bir betikle siliyor (`withDevLauncher.js:62-64`).

---

## `production`

**Mağaza paketi.** Android'de `.aab` (Play yalnızca onu kabul ediyor), iOS'ta `.ipa`
(App Store) — ayrı bir iOS profili gerekmez.

Android'de doğrudan kurulabilen `.apk` için `production-apk` kullanılır; **ikisi de aynı
anahtarla imzalanmalı**, aksi hâlde Android bunları farklı uygulama sayar ve kullanıcı
geçişte veri kaybeder.

⛔ **`EXPO_PUBLIC_API_URL` gerçek alan adı olmak zorunda.** 2026-09-04'te yer tutucu
gerçek adresle değiştirildi: `api.dersmate.com` (canlı, ölçüldü). Yanlış bir adres
bırakılırsa uygulama yine derlenir, mağazaya yüklenir ve kullanıcıda sessizce "sunucuya
ulaşılamadı" verir — derleme anında hiçbir uyarı çıkmaz, çünkü adres yalnızca çalışma
anında denenir.

`https://` olması ayrıca gerekli: `app.config.js` şifresiz trafik iznini adresin
şemasına bağlıyor. `http://` bırakılırsa Android'de izin açık kalır ve mağaza sürümü
gereksiz yere zayıflar. iOS'ta aynı koşul ATS istisnasını kapatıyor; gerekçesiz
`NSAllowsArbitraryLoads` taşıyan paket App Review'da açıklama istenerek geri
çevrilebiliyor.

`autoIncrement`, Android'de `versionCode`'u artırdığı gibi iOS'ta `buildNumber`'ı
artırır (`cli.appVersionSource: "remote"` — sayaç EAS'te tutulur, depoda değil).
**App Store Connect aynı `buildNumber`'ı iki kez kabul etmez**; elle artırma.

ⓘ `app.json` → `ios.infoPlist.ITSAppUsesNonExemptEncryption = false`: uygulama yalnızca
standart HTTPS kullanıyor, bu da Apple'ın ihracat kısıtlaması muafiyetine giriyor.
Anahtar olmasa her TestFlight yüklemesinde aynı soru elle yanıtlanır ve yanıtlanana
kadar paket testçilere **dağıtılmaz**.

---

## `production-apk`

**Siteden doğrudan indirilen APK.** `production` ile aynı ortamı miras alır; yalnızca
paket biçimi farklıdır. `distribution` `internal` değil: bu bir üretim paketi ve mağaza
sürümüyle aynı imza anahtarını kullanmalı.

⛔ **Bu profil Android'e özgü — `--platform ios` ile çağırma.** iOS'ta "siteden indirilen
paket" diye bir şey yok: Apple imzalı dağıtımın dışında kurulum yolu bırakmıyor.
İstemeden çağrılırsa `production` ile aynı mağaza paketini üretir ve iki ayrı derleme
aynı `buildNumber`'ı tüketir.

---

## `submit.production`

### Android — Play

`serviceAccountKeyPath`, Play Console'dan indirilen JSON anahtarın yoludur ve **depoya
işlenmez** — depo dışında tutulup yolu yazılır. `track: "internal"` ile başla: yalnızca
test listesindeki hesaplara gider, mağaza incelemesi beklemeden kurulabilir.
`"production"` ise herkese açık yayındır.

### iOS — App Store Connect

Apple tarafında Play'in servis hesabı anahtarına denk bir **dosya yok**; kimlik üç
alandan kuruluyor ve ikisi `eas.json`'a yazılabiliyor.

⛔ **`appleId` (Apple hesabının e-postası) bilerek dosyada DEĞİL.** Bu depo GitHub'da
herkese açık; buraya yazılan adres kalıcı olarak dışarı sızar ve Apple hesabı kimlik
avının birinci hedefidir. Gönderim anında ortamdan verilir:

```bash
EXPO_APPLE_ID=<eposta> npx eas submit --platform ios --profile production
```

Parola **yazılmaz**; Apple iki adımlı doğrulama istiyor, EAS uygulamaya-özel parolayı
sorar ve kendi kasasında saklar.

**Dosyadaki iki değer** (2026-09-23'te dolduruldu — üyelik açıldı, App Store Connect'te
uygulama kaydı oluşturuldu, bundle `com.dersmate.app`):

| Alan | Değer | Nereden |
|---|---|---|
| `ascAppId` | `6815211357` | ASC › uygulama › App Information › "Apple ID". Uygulamanın ASC adresinde de görünür: `appstoreconnect.apple.com/apps/6815211357/…` |
| `appleTeamId` | `666M4C2SLA` | `developer.apple.com` sağ üst köşe ve Membership |

⚠️ **İkisi de gizli değil.** `ascAppId` uygulamanın App Store adresinde zaten açık, Team
ID de her imzalı pakette taşınıyor. Depoda durmaları sorun değil — sızması sorun olan
tek alan `appleId` ve o yukarıdaki gerekçeyle dosyada yok.

---

## Push bildirimleri — profil başına durum (2026-09-25)

`expo-notifications` **yerel (native) bir modül**. Bu tarihten önce derlenmiş her paket
(geliştirme istemcisi, ad-hoc `.ipa`, APK) push ALMAZ: modül pakette yok. Uygulama yine
açılır — `src/lib/bildirimler.js` modülü tembel yüklüyor ve yüklenemezse "bu sürümde
bildirimler desteklenmiyor" durumuna düşüyor — ama token alınamaz. **Push'u denemek için
yeniden derleme şart**; Metro üzerinden gelen yeni JS eski kabuğa native modül ekleyemez.

| Profil | Push | Not |
|---|---|---|
| `onizleme` | ❌ yok, bilerek | Demo modu (`EXPO_PUBLIC_ONIZLEME`) push API'lerine hiç dokunmuyor ve hiçbir kayıt isteği ağa çıkmıyor. Web önizlemesinde ayarlar ekranının hâlleri `?izin=verildi\|verildi-aydinlatmasiz\|reddedildi\|belirsiz\|desteklenmiyor` ile seçiliyor (bkz. `onizleme.js`). |
| `preview` | ✅ | Sunucu LAN'da olsa da çalışır: bildirimi **sunucu** Expo'ya gönderir, telefonun LAN'a ulaşması gerekmez. Sunucunun `exp.host:443`'e çıkabilmesi ve `Push:Provider=Expo` + erişim token'ı yeter. |
| `development` | ✅ | Geliştirme istemcisi push için **yeniden derlenmeli**. Expo Go'da push YOK (SDK 53'ten beri Android'de kaldırıldı); Google Play hizmetli Android emülatörü ise geçerli bir test ortamı. |
| `production` / `production-apk` | ✅ | FCM V1 anahtarı ve APNs anahtarı EAS'te tanımlı olmalı (aşağıda). |

### Kimlik bilgileri — hangisi depoya girer, hangisi girmez

- **`google-services.json`** (Firebase konsolu → Android uygulaması, paket
  `com.dersmate.app`): gizli DEĞİL, kökte durur ve **depoya işlenir** — EAS derlemesine
  gitmesi gerekiyor. `app.config.js` onu yalnızca dosya VARSA `googleServicesFile` olarak
  veriyor; dosyasız derleme kırılmaz, yalnızca token alınamaz.
- **FCM V1 hizmet hesabı anahtarı** (`<proje>-firebase-adminsdk-<kimlik>.json`): GİZLİ.
  `eas credentials` → Android → production → Google Service Account → "Manage your Google
  Service Account Key for Push Notifications (FCM V1)" ile EAS'e yüklenir, sonra
  bilgisayardan kaldırılır. `.gitignore`'da ayrı kalıbı var: varsayılan adı
  `*-service-account.json` kalıbına uymuyor.
- **APNs anahtarı** (`.p8`): ilk iOS derlemesinde EAS "Setup Push Notifications?" diye
  soruyor, evet denir; anahtar EAS'te kalır. Apple hesap başına en fazla iki APNs anahtarı
  veriyor — önce mevcutlara bakılır. `*.p8` zaten `.gitignore`'da.

### iOS: `aps-environment`

Eklenti yetkiyi derlemede `development` yazıyor (introspect ile ölçüldü, 2026-09-25).
Mağaza ve ad-hoc dışa aktarımında imza profili onu `production`'a çeviriyor; ayrı bir
profil ya da `mode` ayarı gerekmiyor. Expo token'ının hangi APNs ortamına gideceğine
çalışma anında `getIosPushNotificationServiceEnvironmentAsync` karar veriyor.

⚠️ Yetki eklendiği için EAS ilk derlemede App ID yeteneklerini eşitleyip tedarik
profillerini YENİLER: eski ad-hoc `.ipa`'lar ve geliştirme istemcisi yeniden derlenip
test iPhone'larına yeniden kurulmalı.

`UIBackgroundModes` eklenmiyor (`enableBackgroundRemoteNotifications` kapalı): arka planda
kod çalıştıran bildirim yok.

### Android: Firebase otomatik başlatma KAPALI

`plugins/firebase-otomatik-baslatma.js` manifest'e `firebase_messaging_auto_init_enabled`
ve `firebase_analytics_collection_enabled` = `false` yazıyor: kullanıcı bildirim
aydınlatmasını görmeden Firebase'e hiçbir istek çıkmasın diye (gerekçe dosyanın başında).
Doğrulama derlemeden önce: `npx expo config --type introspect --json` → manifest'in
`application` düğümünde iki meta-data. Derlemeden sonra: release APK taze kurulumda,
aydınlatma onaylanmadan `firebaseinstallations.googleapis.com` ya da
`fcmregistrations.googleapis.com`'a istek ÇIKMAMALI (proxy ya da logcat ile ölçülür).

⚠️ `npx expo prebuild --platform android` yerel `android/` klasörünü sıfırlar — sonrasında
`android/local.properties` yeniden yazılır (`sdk.dir=C:/Android/Sdk`, eğik bölüyle).
