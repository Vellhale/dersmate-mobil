/*
  İLİŞKİ SÜRÜMÜ — arkadaşlık istekleri ve ilişkiler değiştiğinde artan, bellekteki bir
  sayaç. engelSurumu.js / forumSurumu.js deseninin aynısı, TEK farkla: abone listesi.

  NEDEN ABONE LİSTESİ: engel ve forum sürümüne ekran odak kazanınca bakıyor; değişikliği
  hep BAŞKA bir ekran yapıyor ve kullanıcı geri dönünce görmesi yetiyor. İstekler ise
  çoğu zaman cihazın DIŞINDA değişiyor (karşı taraf istek gönderdi, kabul etti) ve haberi
  bir push bildirimi getiriyor. Kullanıcı o an Arkadaşlar ekranına BAKIYORSA odak olayı
  hiç gelmez; yalnızca sayaca bakan ekran yeni isteği görmezdi. Abone, odaktaki ekranın
  ve çekmece sayaçlarının (bekleyenIsler.js) anında haberdar olmasını sağlıyor.

  Kim ARTIRIR:
  • Bildirim sağlayıcısı — ön planda istek türünde (istek, istekKabul, istekDusecek) bir
    bildirim alınınca ve uygulama öne gelince sunulmuş istek bildirimleri görülünce.
  • Cihazda ilişkiyi değiştiren ekranlar (kabul, ret, sonlandırma, istek gönderme)
    başarıdan SONRA. Yeni bir çağrı yeri eklenirse buraya da bağlanmalı.

  Sayaç api.js'te DEĞİL, çağrı yerlerinde artıyor: önizleme modu api nesnesini onizlemeApi
  ile eziyor (Object.assign), yani api.js'teki bir sarmalayıcı orada hiç koşmazdı.

  Oturumdan bağımsız: çıkış-giriş sayacı sıfırlamaz. Sayaç yalnızca "değişti mi" sorusunu
  cevaplar, değeri bir anlam taşımaz.
*/
let surum = 0
const aboneler = new Set()

export function iliskiSurumu() {
  return surum
}

export function iliskiDegisti() {
  surum += 1
  for (const abone of [...aboneler]) {
    // Bir abonenin hatası diğerlerini ve çağıranı (çoğu zaman bir bildirim dinleyicisi)
    // düşürmesin.
    try {
      abone(surum)
    } catch {
      /* yut */
    }
  }
}

/** @returns vazgeç fonksiyonu — efektin temizliğinde çağrılmalı. */
export function iliskiSurumuAbone(abone) {
  aboneler.add(abone)
  return () => aboneler.delete(abone)
}
