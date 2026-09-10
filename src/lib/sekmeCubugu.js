/*
  YÜZEN SEKME ÇUBUĞUNUN GEOMETRİSİ — tek kaynak.

  Çubuk artık ekranın altına YAPIŞMIYOR, hap biçiminde yüzüyor. Bunun görünmeyen bir
  bedeli var: kaydırılan içerik çubuğun ALTINDAN geçiyor ve son öğe görünmez kalıyor.
  Kenara yapışık çubukta bu sorun yoktu — React Navigation sahneyi çubuk kadar
  yukarıdan bitiriyordu.

  Bu yüzden ölçüler burada, tek yerde: sekme ekranları alt dolgularını buradan alıyor.
  Yükseklik ya da boşluk değişirse beş ekranın hepsi kendiliğinden uyum sağlıyor —
  aksi hâlde biri güncellenmeden kalır ve o ekranda son kart çubuğun altında kaybolur.
*/

/** Hapın yüksekliği. 64: 26px ikon + iki yanda 19px nefes; dokunma hedefi rahat 44px'in üstünde. */
export const CUBUK_YUKSEKLIGI = 64

/** Hapın ekran kenarlarına uzaklığı (sol, sağ ve alt). */
export const CUBUK_BOSLUGU = 16

/**
 * Sekme ekranlarının kaydırma kabına eklemesi gereken alt dolgu.
 *
 * Çubuğun yüksekliği + altındaki boşluk + cihazın güvenli alanı (gesture bar) +
 * içeriğin çubuğa yapışmaması için bir nefes payı.
 *
 * @param altGuvenliAlan `useSafeAreaInsets().bottom`
 */
export function sekmeAltDolgusu(altGuvenliAlan = 0) {
  return CUBUK_YUKSEKLIGI + CUBUK_BOSLUGU + altGuvenliAlan + 12
}
