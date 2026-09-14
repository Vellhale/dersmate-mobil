/*
  TÜRKÇE BÜYÜK HARF — "i"yi "İ", "ı"yı "I" yapan, platformdan bağımsız dönüşüm.

  NEDEN VAR: küçük üst etiketler ("SANA ANLATABİLİR", "GEÇMİŞ DERSLER") Tailwind'in
  büyük harf sınıfıyla, yani `textTransform` ile büyütülüyordu. O dönüşümü metin motoru
  yapıyor ve yerel ayarı hiçbir yerde güvenilir biçimde Türkçe değil:
    • iOS: RCTAttributedTextUtils.mm yerel ayarsız NSString dönüşümü → her zaman "I".
    • Android: Locale.getDefault → cihaz dili tr değilse "I".
    • Web önizlemesi: sayfada lang yok → "I".
  Sonuç: Akış'ın her kartında "SANA ANLATABILIR", Derslerim'de "GEÇMIŞ DERSLER",
  takvim yaprağında Nisan "NIS", Ekim "EKI". Tek güvenilir yol metni EKRANA VERMEDEN
  önce dönüştürmek. `toLocaleUpperCase('tr-TR')` da seçilmedi: sonucu motorun Intl
  desteğine bağlar; açık eşleme her motorda aynı çıktıyı verir.

  Kullanım yeri çoğunlukla `UstEtiket` (components/ui.jsx): erişim adı özgün küçük harfli
  metin kalsın diye dönüşümü o yapıyor.

  format.js'e EKLENMEDİ: o dosya web'den birebir kopya (CLAUDE.md). Bu dosya yalnızca
  mobilde; web'de aynı sınıf var ama lang="tr" dönüşümü doğru yapıyor, taşımak gerekmez.
*/
export function buyukHarf(metin) {
  return String(metin).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase()
}
