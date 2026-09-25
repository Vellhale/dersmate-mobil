/*
  FIREBASE OTOMATİK BAŞLATMA KAPALI — Android manifest'ine iki meta-data yazan küçük
  yapılandırma eklentisi (config plugin). app.config.js'te expo-notifications'tan SONRA
  listelenir.

  NEDEN VAR: kullanıcı bildirim aydınlatma ekranını görmeden Firebase'e HİÇBİR veri
  gitmemeli (KVKK Aydınlatma Tebliği m.5/1(b): aydınlatma ilk veri akışından ÖNCE).
  Firebase Cloud Messaging varsayılan olarak uygulama açılır açılmaz kendini başlatıyor:
  kurulum kimliği (FID) üretip firebaseinstallations.googleapis.com'a, ardından token'ı
  fcmregistrations.googleapis.com'a yüklüyor. Firebase'in kendi belgesi bunu açıkça
  yazıyor ve otomatik başlatmanın ANALİTİKLE BİRLİKTE kapatılmasını istiyor
  (firebase.google.com/docs/cloud-messaging/android/client → "Prevent auto
  initialization"). Biri açık kalırsa kurulum kimliği yine üretilir.

  expo-notifications (sdk-57) bu anahtarları EKLEMİYOR — paketin kendi manifest'i
  yalnızca RECEIVE_BOOT_COMPLETED, POST_NOTIFICATIONS, mesaj servisi ve alıcıyı taşıyor
  (node_modules/expo-notifications/android/src/main/AndroidManifest.xml).

  Otomatik başlatma kapalıyken token YALNIZCA src/lib/bildirimler.js → tokenAlVeKaydet
  açıkça istediğinde üretilir; o da aydınlatma görüldükten sonra çağrılır.

  ⚠️ ÖLÇÜLECEK (cihazda, kullanıcı): otomatik başlatma kapalıyken açık getToken çağrısının
  (getExpoPushTokenAsync → FirebaseMessaging.getToken) token VERDİĞİ. Firebase belgesine
  göre veriyor: açık getToken otomatik başlatmayı beklemez. Vermezse çözüm, istemden hemen
  önce FirebaseMessaging.setAutoInitEnabled(true) çağıran küçük bir yerel modüldür; bu
  turda bilerek YAZILMADI (kullanıcı kararı). Belirtisi: izin verilir, aydınlatma geçilir
  ama sunucuda cihaz satırı hiç oluşmaz.

  Doğrulama: `npx expo config --type introspect --json` çıktısında manifest'in
  application düğümünde iki meta-data da "false" görünmeli.
*/
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins')

const { addMetaDataItemToMainApplication, getMainApplicationOrThrow } = AndroidConfig.Manifest

const ANAHTARLAR = [
  // FCM kendi kendine token üretmesin: token yalnızca açık istekle.
  'firebase_messaging_auto_init_enabled',
  // Firebase Analytics kütüphanesi pakette YOK; anahtar yine de yazılıyor çünkü Firebase
  // belgesi ikisinin birlikte kapatılmasını istiyor ve ileride bir bağımlılık analitiği
  // geçişli olarak getirirse sessizce toplamaya başlamasın.
  'firebase_analytics_collection_enabled',
]

module.exports = function firebaseOtomatikBaslatmaKapali(config) {
  return withAndroidManifest(config, (yapilandirma) => {
    const uygulama = getMainApplicationOrThrow(yapilandirma.modResults)
    for (const anahtar of ANAHTARLAR) {
      addMetaDataItemToMainApplication(uygulama, anahtar, 'false')
    }
    return yapilandirma
  })
}
