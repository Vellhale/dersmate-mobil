/*
  ─── DOĞRULAMA KODU: "en son ne zaman gönderildi" ───────────────────────────────

  Sunucu aynı adrese dakikada bir doğrulama postası gönderiyor
  (EmailVerificationRules.ResendCooldownSeconds = 60) ve bu sınırı SESSİZCE uyguluyor:
  hata döndürmüyor, çünkü "biraz bekle" demek o adresin kayıtlı olduğunu söylerdi —
  resend-verification ucunun bütün tasarımı varlık sızdırmamak üzerine kurulu.

  Sessizliğin bedeli arayüzde ödeniyor: sunucuya sorulamadığı için "yeni kod gönder"
  düğmesinin ne zaman işe yarayacağını yalnızca istemci bilebilir. Bilmezse iki
  yanlıştan birini yapar:

    • Sayaç hiç yoksa   → kullanıcı düğmeye basar, ekran "gönderdik" der,
                          HİÇBİR ŞEY GÖNDERİLMEZ. Hiç gelmeyecek postayı bekler.
    • Sayaç her zaman   → kodu bir saat önce ölmüş kullanıcı, sunucuda bekleme
      dolu başlarsa       çoktan bittiği hâlde 60 saniye boşuna bekletilir.

  İkisi de bu ekranda gerçekten yaşandı. Çare, tahmin etmek yerine ÖLÇMEK: kodun
  gerçekten gönderildiği an burada damgalanıyor, kalan süre ondan hesaplanıyor.

  ⛔ DİSKE YAZILMIYOR, bilerek. AsyncStorage'a yazmak bunu "cihaz tercihi" yapar ve
  IzinContext'teki kural devreye girer (ISLEVSEL_DEPOLAMA'ya ekle + kategori yaz +
  IZIN_SURUMU'nü artır). Sürüm artışı her kullanıcıya izin bildirimini yeniden
  gösterir — 60 saniyelik bir sayaç için ödenecek bedel değil.

  Bellekte tutmanın tek açığı: uygulama kayıttan sonraki 60 saniye içinde tamamen
  kapanıp yeniden açılırsa damga kaybolur ve sayaç sıfırdan başlar. O dar aralıkta
  kullanıcı bir kez boşuna "gönderdik" görebilir. Kabul edildi: diske yazmanın
  bedeli (herkese yeniden izin sorusu) bundan büyük.

  TEK ADRES saklanıyor, harita değil: kullanıcı tek seferde tek hesap doğruluyor.
  Başka bir adrese kod istendiğinde eskisinin kalan süresi zaten anlamsız.
*/

/** Sunucudaki EmailVerificationRules.ResendCooldownSeconds ile aynı olmalı. */
export const YENIDEN_BEKLEME_SN = 60

let sonGonderim = null // { adres, ms }

/*
  E-posta karşılaştırması küçük harfe indirgeniyor: kullanıcı kayıt ekranında
  "Ali@..." yazıp doğrulama ekranında "ali@..." yazabilir, damga yine tutmalı.

  ⚠️ toLocaleLowerCase DEĞİL, toLowerCase. Türkçe yerelde 'I' → 'ı' olur ve
  "ALI@..." ile "ali@..." ARTIK EŞLEŞMEZ. E-posta adresi ASCII kurallarına tabidir,
  Türkçe harf katlaması burada yanlış cevap verir. (Bu proje aynı tuzağı
  veritabanı locale'inde bir kez yaşadı — orada ICU gerekiyordu, burada gerekmiyor.)
*/
const normalize = (adres) => String(adres ?? '').trim().toLowerCase()

/** Sunucunun bu adrese kod gönderdiği anı damgalar. Gönderim BAŞARILIYSA çağrılır. */
export function kodGonderildiIsaretle(adres) {
  const a = normalize(adres)
  if (!a) return
  sonGonderim = { adres: a, ms: Date.now() }
}

/**
 * Bu adrese yeni kod istemek için kalan saniye. Damga yoksa ya da başka bir adrese
 * aitse 0 — yani "bekleme yok".
 *
 * 0 dönmesi "sunucu kesinlikle gönderir" GARANTİSİ DEĞİLDİR (damga yalnızca bu
 * süreçte yaşar); yalnızca "bildiğimiz kadarıyla engel yok" demek.
 */
export function kalanBeklemeSn(adres) {
  const a = normalize(adres)
  if (!a || !sonGonderim || sonGonderim.adres !== a) return 0

  const gecen = (Date.now() - sonGonderim.ms) / 1000
  const kalan = Math.ceil(YENIDEN_BEKLEME_SN - gecen)
  return kalan > 0 ? Math.min(kalan, YENIDEN_BEKLEME_SN) : 0
}
