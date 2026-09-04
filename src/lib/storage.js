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
      // Yazılamıyorsa oturum yalnızca bellekte yaşar: uygulama yeniden açılınca
      // giriş istenir. Sessiz ama güvenli taraf.
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
