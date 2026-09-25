/*
  DERS SÜRÜMÜ — derslerin durumu değiştiğinde artan, bellekteki bir sayaç. iliskiSurumu.js
  ile BİREBİR aynı desen (abone listeli); ayrı dosyada çünkü olaylar ve tüketiciler farklı.

  NEDEN VAR: Derslerim kök yığında KURULU kalıyor ve bugüne kadar ne odakta ne ön plana
  dönüşte tazeleniyordu. Ders durumunu çoğu zaman karşı taraf değiştiriyor (eğitmen kanıt
  yükledi → onay bekliyor, iptal etti, yeni ders planladı) ve haberi push getiriyor.
  Kullanıcı Derslerim'deyken gelen "Dersin onay bekliyor" bildirimi, ekranda karşılığı
  olmayan bir iş bırakırdı.

  ⚠️ Tüketen ekran YALNIZCA aktif grubu yeniden çekmeli. Geçmiş listesi onEndReached ile
  birikiyor; her sürüm artışında 1. sayfadan kurulsaydı kaydırılan sayfalar silinirdi
  (CLAUDE.md → "Başka ekranda değişen veri ODAKTA tazelenir").

  Kim ARTIRIR:
  • Bildirim sağlayıcısı — ön planda ders türünde (onay, otoOnay, dersPlan, dersIptal,
    dersYaklasiyor) bir bildirim alınınca ve uygulama öne gelince sunulmuş ders
    bildirimleri görülünce.
  • Cihazda dersi değiştiren ekranlar (rezervasyon, tamamlama, onay, itiraz, iptal)
    başarıdan SONRA.

  Sayaç api.js'te DEĞİL, çağrı yerlerinde artıyor — gerekçe iliskiSurumu.js'te.
*/
let surum = 0
const aboneler = new Set()

export function dersSurumu() {
  return surum
}

export function dersDegisti() {
  surum += 1
  for (const abone of [...aboneler]) {
    try {
      abone(surum)
    } catch {
      /* bir abonenin hatası diğerlerini düşürmesin */
    }
  }
}

/** @returns vazgeç fonksiyonu — efektin temizliğinde çağrılmalı. */
export function dersSurumuAbone(abone) {
  aboneler.add(abone)
  return () => aboneler.delete(abone)
}
