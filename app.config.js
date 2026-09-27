/*
  DİNAMİK YAPILANDIRMA — app.json'ı okur, üzerine yalnızca derleme anında bilinebilen
  şeyleri ekler: şifresiz HTTP'ye izin verilip verilmeyeceği ve push bildirimlerinin
  yerel yapılandırması (en altta, "PUSH BİLDİRİMLERİ" notu).

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

  ── iOS KARŞILIĞI (ATS) — AYNI KOŞUL, TERS VARSAYILAN ────────────────────────────
  AYNI DUVAR iOS'ta da var, adı farklı: App Transport Security. Ama Expo'nun
  VARSAYILANI ANDROID'İN TAM TERSİ ve tehlikeli olan yön bu:

    Android → Expo şifresiz izni yalnızca DEBUG manifest'ine koyar. Fazladan bir şey
              yapmazsan release paketi KAPALI gelir; hata "çalışmıyor" diye görünür.
    iOS     → Expo şablonu Info.plist'e `NSAllowsArbitraryLoads: true` koyar ve bunu
              HER paket için yapar. Fazladan bir şey yapmazsan mağaza paketi
              TAMAMEN AÇIK gider; hata HİÇ görünmez.

  Ölçüldü (2026-09-21, `npx expo config --type introspect`): .env `https://` iken,
  yani bu dosyanın "izin kendiliğinden kapanır" dediği durumda, üretilen Info.plist
  şunu taşıyordu:

      NSAppTransportSecurity = { NSAllowsArbitraryLoads: true,
                                 NSExceptionDomains: { localhost: {...} } }

  Yani Android için kurulan güvence iOS'ta TUTMUYORDU: koşul doğru çalışıp hiçbir şey
  eklemiyor, Expo'nun varsayılanı zaten açık bırakıyordu. Bu yüzden anahtar aşağıda
  KOŞULUN İKİ DALINDA DA açıkça yazılıyor — "eklemeyerek kapatmak" iOS'ta işe yaramaz.

  Neden önemli: gerekçesiz `NSAllowsArbitraryLoads` taşıyan paket App Review'da
  açıklama istenerek geri çevrilebiliyor; kabul edilse bile uygulamanın yükleyebileceği
  HER http:// adresi araya girmeye açık kalır.

  Geliştirme dalında iki anahtar birlikte veriliyor çünkü tek başına
  `NSAllowsLocalNetworking` yetmiyor: o istisna `.local` ve bağ-yerel adresleri
  kapsıyor, bizim `192.168.x.x` LAN adresimiz ise yönlendirilebilir özel bir adres ve
  kapsam dışında kalıyor.

  ⚠️ iOS 14'ten beri yerel ağdaki bir cihaza bağlanmak AYRICA kullanıcı onayı istiyor
  (Yerel Ağ izni). Reddedilirse belirti yine aynı sessiz hatadır; bu yüzden
  NSLocalNetworkUsageDescription de veriliyor — metinsiz istem iOS'ta hiç çıkmaz.

  ⚠️ Android'deki gibi burada da değişiklik ancak prebuild Info.plist'i yeniden
  ürettiğinde yansır. EAS her bulut derlemesinde prebuild çalıştırdığı için orada
  kendiliğinden olur; elde tutulan bir ios/ klasörü YOK (.gitignore).
*/
const fs = require('fs')
const path = require('path')

const adres = process.env.EXPO_PUBLIC_API_URL ?? ''
const sifresizGerekli = adres.startsWith('http://')

/*
  ── PUSH BİLDİRİMLERİ ───────────────────────────────────────────────────────────
  Neden app.json'da değil de burada: iki değer derleme anında HESAPLANIYOR.

  1. RENK brand-600, tailwind.config.js'ten OKUNUYOR (theme.js'in yaptığı gibi). Hex elle
     yazılsaydı palet değişince bildirim ikonunun rengi eskide kalırdı. 600, çünkü
     birincil eylem zemini o (CLAUDE.md → renk rolleri); 500 beyaz metinle AA'yı geçmiyor.

  2. google-services.json KOŞULLU. Dosyayı kullanıcı Firebase konsolundan indirip köke
     koyuyor (gizli DEĞİL, depoya işlenebilir: Expo'nun FCM belgesi de öyle diyor;
     içindeki API anahtarı paket adı + SHA-1 ile kısıtlanır. Gizli olan FCM V1 hizmet
     hesabı anahtarı: o `eas credentials` ile EAS'e yüklenir, .gitignore'da ayrı kalıbı
     var). Dosya YOKKEN yol verilseydi prebuild "dosya
     bulunamadı" diye DÜŞERDİ ve push'tan bağımsız her Android derlemesi kırılırdı.
     Dosyasız derleme çalışır, yalnızca token alınamaz: bildirimler.js hatayı yutar,
     uygulama bildirimsiz ama sorunsuz açılır.

  Kanal kimliği `mesajlar`, src/lib/bildirimler.js → KANALLAR ve sunucudaki
  BildirimKanallari ile BİREBİR aynı. defaultChannel yalnızca kanalı belirtilmemiş bir
  FCM iletisi için yedek; sunucu her iletiye kanal yazıyor.

  enableBackgroundRemoteNotifications BİLEREK verilmiyor (varsayılan false): arka planda
  kod çalıştıran bildirim yok, UIBackgroundModes eklemek App Review'da gerekçe sorusu
  doğurur. iOS `mode` da verilmiyor: aps-environment derlemede 'development' yazılır,
  mağaza/ad-hoc dışa aktarımında imza profili onu 'production'a çevirir (Expo belgesi).
*/
const bildirimRengi = require('./tailwind.config.js').theme.extend.colors.brand[600]
const googleServicesVar = fs.existsSync(path.join(__dirname, 'google-services.json'))

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(googleServicesVar ? { googleServicesFile: './google-services.json' } : {}),
  },
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      // İKİ DAL DA AÇIKÇA YAZILIYOR — gerekçe yukarıdaki "ters varsayılan" notunda.
      // `false` dalını silip anahtarı hiç vermemek, Expo'nun açık varsayılanına
      // dönmek demektir; mağaza paketi sessizce ATS'siz çıkar.
      NSAppTransportSecurity: sifresizGerekli
        ? { NSAllowsArbitraryLoads: true, NSAllowsLocalNetworking: true }
        : { NSAllowsArbitraryLoads: false },
      ...(sifresizGerekli
        ? {
            NSLocalNetworkUsageDescription:
              'Geliştirme sırasında yerel ağdaki test sunucusuna bağlanmak için kullanılır.',
          }
        : {}),
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: sifresizGerekli,
          // TLS sertifika sabitleme (certificate pinning) burada BİLEREK yapılandırılmadı.
          // Gerekçe ve doğru yol src/lib/api.js'teki axios istemcisi yorumunda. Özet:
          // Let's Encrypt ~90 günde yenilendiği için YAPRAK-pinning uygulamayı her
          // yenilemede kırar; SPKI + yedek-pin ise ayrı bir yayın disiplini ister.
          // Değerlendirildi, ERTELENDİ — "eksik" sanıp körü körüne ekleme.
        },
      },
    ],
    [
      'expo-notifications',
      {
        // 96×96, tamamen beyaz ve saydam: Android durum çubuğu ikonun YALNIZCA alfa
        // kanalını kullanır, renkli ikon gri bir kareye döner. Marka işaretinin
        // (Logo.jsx: iki daire + bağ yayı) silueti.
        icon: './assets/bildirim-ikonu.png',
        color: bildirimRengi,
        defaultChannel: 'mesajlar',
      },
    ],
    // expo-notifications'tan SONRA: aynı manifest'e yazıyorlar, gerekçe dosyanın başında.
    './plugins/firebase-otomatik-baslatma',
  ],
})
