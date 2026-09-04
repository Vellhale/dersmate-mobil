/*
  DİNAMİK YAPILANDIRMA — app.json'ı okur, üzerine yalnızca derleme anında bilinebilen
  tek şeyi ekler: şifresiz HTTP'ye izin verilip verilmeyeceği.

  NEDEN VAR: Android 9'dan (API 28) beri şifresiz `http://` trafiği varsayılan olarak
  ENGELLİ. Expo bu izni yalnızca DEBUG manifest'ine koyuyor; release APK'da yok. Sonuç,
  telefonda ölçüldü: uygulama `http://<lan-ip>:5099`'a istek atıyor, paket cihazdan hiç
  çıkmıyor (sunucu günlüğünde tek satır yok) ve ekranda "Sunucuya ulaşılamadı" beliriyor.
  Demo modunda hiç ağ isteği yapılmadığı için bu bugüne kadar görünmedi.

  NEDEN KOŞULLU: izni app.json'a sabit yazmak, mağazaya çıkacak sürümde de şifresiz
  trafiği açık bırakırdı — uygulamanın yükleyebileceği HER http:// adresi araya girmeye
  açık hâle gelirdi. Burada izin, API adresinin ŞEMASINA bağlı: adres `http://` ise
  (yerel geliştirme) açılır, `https://` olunca KENDİLİĞİNDEN kapanır. Yani sunucu
  gerçek bir alan adına taşındığında bu dosyada değişiklik gerekmez.

  ⚠️ Değişiklik yalnızca `npx expo prebuild` android/ klasörünü yeniden ürettiğinde
  manifest'e yansır; Gradle tek başına manifest'i güncellemez.
*/
const adres = process.env.EXPO_PUBLIC_API_URL ?? ''
const sifresizGerekli = adres.startsWith('http://')

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: sifresizGerekli,
        },
      },
    ],
  ],
})
