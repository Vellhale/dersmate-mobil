import * as Application from 'expo-application'
import * as Crypto from 'expo-crypto'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { KEYS, secure } from './storage'

/*
  CİHAZ PARMAK İZİ (HWID) — MOBİL SÜRÜM.

  Backend login'de HwidHash alanını OPSİYONEL kabul eder (LoginCommand: string? HwidHash)
  ama istemcilerin göndermesini bekler; ban kontrolü ve cihaz izleme bu değer üzerinden
  çalışır.

  ⚠️ WEB'DEKİ canvasSignal() BURAYA TAŞINMADI ve TAŞINAMAZ: RN'de canvas yok. Bu bilinçli
  bir ayrım — web'in hash'i ile mobilin hash'i AYNI KULLANICIDA BİLE FARKLIDIR ve backend
  için sorun değil: HWID cihazı tanımlar, kullanıcıyı değil. Aynı kullanıcı iki cihazdan
  girince zaten iki farklı hash üretir; telefon da "başka bir cihaz"dır.

  Web tarafındaki dokunulmazlık kuralı (hwid.js/canvasSignal sabitleri) web'de geçerli
  kalır; buradaki üretim ondan tamamen bağımsızdır.

  SİNYALLER:
  • Android: androidId (fabrika sıfırlamasına kadar sabit, uygulama yeniden kurulsa da
    aynı kalır) — tek başına güçlü bir cihaz kimliği.
  • iOS: identifierForVendor (aynı geliştiricinin uygulamaları silinip yeniden
    kurulursa DEĞİŞEBİLİR) — bu yüzden üretilen hash SecureStore'da saklanır:
    Keychain, uygulama silinse bile çoğu durumda yaşamaya devam eder ve hash sabit kalır.
  • Donanım modeli/OS bilgisi: kimliği tek başına taşımaz, çeşitlilik katar.

  Üretilen hash web'dekiyle aynı biçimde: SHA-256 hex (64 karakter).
*/
export async function getHwidHash() {
  const cached = await secure.get(KEYS.hwid)
  if (cached) return cached

  let vendorId = ''
  try {
    vendorId =
      Platform.OS === 'android'
        ? (Application.getAndroidId() ?? '')
        : ((await Application.getIosIdForVendorAsync()) ?? '')
  } catch {
    // Kimlik okunamazsa donanım sinyalleri + rastgele tuz yine benzersiz bir
    // cihaz kimliği verir; boş geçmek hash'i "hepsi aynı" yapmaz.
  }

  // Kalıcı kimlik hiç yoksa (nadiren: kısıtlı profiller) tek seferlik tuz üret —
  // SecureStore'a yazılan nihai hash zaten kalıcılığı sağlıyor.
  if (!vendorId) {
    vendorId = Crypto.randomUUID()
  }

  const signals = [
    Platform.OS,
    vendorId,
    Device.brand ?? '',
    Device.modelName ?? '',
    Device.osName ?? '',
    String(Device.totalMemory ?? ''),
  ].join('|')

  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, signals)
  await secure.set(KEYS.hwid, hash)
  return hash
}
