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

API'nin mobilden erişilebilir olması için backend LAN'dan dinlemeli
(`dotnet run --project src/PeerLearn.Api` varsayılan localhost'tur; fiziksel cihaz için
`--urls http://0.0.0.0:5000`). Geliştirmede `src/lib/api.js` bilgisayarın LAN IP'sini
Metro hostUri'sinden kendisi türetir; başka ortam için `.env` → `EXPO_PUBLIC_API_URL`.

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
- Blob/object-URL görselleri (avatar, kanıt) → `<Image source={{ uri, headers }}>`.
  RN'de `URL.createObjectURL` yok; `api.avatarImageSource` / `api.proofImageSource`.
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
