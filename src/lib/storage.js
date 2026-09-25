import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

/*
  DEPOLAMA KATMANI — web'deki localStorage kullanımının mobil karşılığı.

  İki ayrı kasa var ve ayrım bilinçli:

  • SecureStore  → OTURUM (JWT) ve HWID. Cihazın anahtar zincirinde (iOS Keychain /
    Android Keystore) şifreli durur. Web'de localStorage'a yazılıyordu çünkü tarayıcıda
    daha iyisi yoktu; mobilde var ve token gibi bir sırrı düz dosyaya yazmak için
    neden kalmadı.

  • AsyncStorage → TERCİHLER (tur durumu, arayüz tercihleri gibi hassas olmayan
    değerler). SecureStore'un boyut sınırı (2 KB/anahtar) ve maliyeti var; her şeyi
    oraya koymak hem gereksiz hem yavaş.

    Oturum TEK anahtarda ve öyle KALMALI. Boyut sorun değil (2026-09-11 ölçümü): tipik
    ~565 B, en kötü (100 karakterlik Türkçe ad + 320 karakterlik e-posta + admin)
    ~1,94 KB; yenileme token'ı 43 karakter. expo-secure-store 55.0.0'dan beri iOS'taki
    bayt uyarısı da yok. Asıl sebep ATOMİKLİK: token'ı ayrı anahtara bölmek, iki yazma
    arasında ölen uygulamada diske yeni erişim + İPTAL EDİLMİŞ eski yenileme token'ı
    bırakır. Sunucu o token sunulunca hırsızlık sayar ve her cihazdan çıkış yaptırır.

  İKİSİ DE ASYNC: web'deki senkron localStorage.getItem alışkanlığı buraya taşınamaz.
  Oturum açılışta BİR KEZ okunur ve bellekte tutulur (bkz. api.js) — her istekte
  await'li depolama okuması yapılmaz.

  Anahtar adları web ile aynı önekte (peerlearn.*): kullanıcıya görünmez, altyapı
  kimliğidir (web tarafındaki F4 kararı).
*/

export const KEYS = {
  session: 'peerlearn.session',
  hwid: 'peerlearn.hwid',
  /* Avatar önbellek sayaçları. KALICI olmak ZORUNDA: RN Image (Android'de Fresco)
     disk önbelleğini uygulama yeniden başlatmalarını AŞARAK saklıyor ve HTTP yeniden
     doğrulaması yapmıyor. Sayaç yalnızca bellekte tutulduğunda açılışta sıfırlanıyor,
     adres temel URI'ye dönüyor ve Fresco o anahtarın altındaki ESKİ görseli ağa hiç
     çıkmadan sunuyor — yüklenen yeni fotoğraf kalıcı olarak görünmez oluyordu. */
  avatarSurumleri: 'peerlearn.avatarSurumleri',
  /* "Bu cihazın push kaydı sunucudan unutturulacak" işareti — SecureStore'da, değeri
     işaretin yazıldığı an (ms). YALNIZCA çıkışın sunucu çağrısı ulaşmadığında yazılır:
     çevrimdışı çıkışta sunucudaki cihaz satırı silinemedi ve telefona önceki hesabın
     bildirimleri gelmeye devam ederdi. Sonraki açılışta bildirimler.js → unutmaCalistir
     POST /push/devices/forget çağırır ve işareti siler. Token'ın kendisi diske YAZILMAZ;
     unutma anında yeniden okunur.

     Neden ayrı anahtar, oturum kaydının içinde değil: işaret tam da oturum kaydı
     silinirken (çıkış) doğuyor. Neden SecureStore: oturumla aynı kasada, "zorunlu"
     kategoride (hizmetin gereği; IzinContext → zorunlu kategori metni ve gizlilik §4'te
     beyan edilir, IZIN_SURUMU ARTMAZ — kullanıcı kararı 2026-09-25). */
  pushUnutulacak: 'peerlearn.pushUnutulacak',
  /* "Bu kurulum push'a kaydoldu" bayrağı — SecureStore'da, değeri ilk başarılı kaydın
     anı (ms). Yalnızca unutma işaretinin yazılıp yazılmayacağını söylüyor: işaret eskiden
     "bu süreçte token alındı mı"ya bağlıydı ve uygulama çevrimdışı açılıp çevrimdışı
     çıkış yapılınca hiç yazılmıyordu (bildirimler.js → buKurulumdaKayitliMi). Kayıt
     sunucudan silinince (ulaşan çıkış, başarılı forget) silinir. Aynı kasa ve kategori,
     aynı gerekçeyle ayrı anahtar: çıkışta oturum kaydıyla birlikte silinmemeli. */
  pushKayitli: 'peerlearn.pushKayitli',
}

/* SecureStore anahtarlarında nokta geçersiz ([A-Za-z0-9._-] izinli aslında; nokta
   GEÇERLİ) — yine de tireli sürüm kullanılıyor: Android Keystore alias'larında nokta
   bazı OEM'lerde sorun çıkardı. */
const guvenliAnahtar = (key) => key.replace(/\./g, '-')

export const secure = {
  get: async (key) => {
    try {
      return await SecureStore.getItemAsync(guvenliAnahtar(key))
    } catch {
      // Keystore bozulması (cihaz geri yükleme sonrası) okumada patlayabilir;
      // oturum düşer, kullanıcı yeniden giriş yapar — uygulama açılmaya devam eder.
      return null
    }
  },
  set: async (key, value) => {
    try {
      if (value === null || value === undefined) {
        await SecureStore.deleteItemAsync(guvenliAnahtar(key))
      } else {
        await SecureStore.setItemAsync(guvenliAnahtar(key), value)
      }
    } catch {
      /*
        YAZILAMADI → ESKİ KAYIT SİLİNİYOR. Başarısız bir yazım diskteki eski değeri YERİNDE
        bırakıyor: iOS'ta SecItemUpdate hata verince öğeye dokunulmuyor, Android'de
        şifreleme prefs'e yazmadan önce patlıyor. Oturumda bu eski değer, sunucunun az önce
        dönüştürdüğü (Rotated) bir yenileme token'ı demek. Soğuk açılış onu sunar, 30 sn'lik
        pencere geçmişse sunucu bunu hırsızlık sayıp web dahil her yerden çıkış yaptırır.

        Silmek o yolu kapatıyor: oturum bu açılışta bellekte yaşar, uygulama yeniden
        açılınca giriş istenir. Güvenli taraf bu. Silme de başarısız olursa yapılacak bir
        şey kalmıyor. Silme şifreli veriye dokunmuyor (Android'de yalnızca prefs'ten
        kaldırıyor), yani yazımı kıran Keystore hatası onu kırmaz.

        HWID'de bu dal fiilen boşta: getHwidHash yalnızca kayıt YOKKEN yazıyor.
      */
      if (value !== null && value !== undefined) {
        try {
          await SecureStore.deleteItemAsync(guvenliAnahtar(key))
        } catch {
          /* ikisi de olmadı; en azından akış kırılmaz */
        }
      }
    }
  },
}

export const prefs = {
  get: async (key) => {
    try {
      return await AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: async (key, value) => {
    try {
      if (value === null || value === undefined) await AsyncStorage.removeItem(key)
      else await AsyncStorage.setItem(key, value)
    } catch {
      /* tercih kaybı akışı kırmaz */
    }
  },
}
