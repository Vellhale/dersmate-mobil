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

  Sunucuda çıkış ucu yok: çıkış yalnızca yerel oturumu siliyor, yenileme token'ı
  sunucuda 60 gün geçerli kalıyor (web'de de öyle).
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
    zaten yapan ekranda o çağrı atlanmalı. ⚠️ Kurulum efektinde indirilen `kuruluyor`
    bayrağı bunu YAPAMIYOR: expo-router'ın `useFocusEffect`'i ilk çağrıyı bir render
    geciktiriyor (`useOptionalNavigation`) ve bayrağı inmiş buluyor. Yeni ekranlar
    `src/state/useOnePlanaGelince.js`'i kullanmalı (kurulum anındaki `isFocused()`'a
    bakıyor). `eslesmeler.jsx` ve `ArkadaslarBolumu` hâlâ eski kalıpta; önizlemede
    açılışta `myMatches` / `userFriends` ikişer kez çağrılıyor (2026-09-14 ölçümü).
- **Akış başlığında bekleyen iş sayaçları mobilde var, web'de yok.** Web `Layout.jsx`
  yalnızca okunmamış mesaj rozeti taşıyor. Mobilde Arkadaşlar ikonu gelen istek sayısını
  (`myMatches`), Derslerim ikonu kullanıcının kapatabileceği ders sayısını
  (`mySessions(1, 1)`) gösteriyor; push olmadığı için 14 günde düşen isteği ve 48 saatte
  otomatik onaylanan dersi kullanıcıya haber veren tek şey bunlar. "İşlem bekliyor"
  tanımı TEK yerde (`src/lib/dersDurumu.js` → `eylemBekliyor`) ve Derslerim'in aksiyon
  grubu da onu kullanıyor. Aynı turda Derslerim'de itirazdaki (`Disputed`) dersler aksiyon
  grubundan "İtirazda, karar yönetimde" başlığına çıktı; web onları hâlâ aksiyonda
  gösteriyor. Sayaçlar odakta VE ön plana dönüşte tazeleniyor
  (`src/state/useOnePlanaGelince.js`): odak olayı uygulama arka plandan dönünce gelmiyor.
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
