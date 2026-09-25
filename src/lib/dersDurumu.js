/*
  DERS DURUMU — "bu ders benden bir şey bekliyor mu?" sorusunun TEK tanımı.

  İki yer aynı soruyu soruyor: Derslerim'deki "Senden aksiyon bekleyenler" grubu ve
  çekmecedeki Derslerim sayacı (lib/bekleyenIsler.js; Akış başlığından oraya taşındı).
  Tanım iki yerde ayrı yazılsaydı biri değişip öteki kaldığında rozet "2" derken ekranda
  tek kart olurdu; kullanıcı bekleyen işi aramaya başlar ve bulamaz.

  Sunucu bayrakları (canApprove, canComplete) istek anındaki saate göre hesaplanıyor.
  Eğitmenin Booked dersi ise liste çekildikten SONRA da bitiş saatini geçebilir: o an
  "Dersi tamamladım" açılıyor (SessionKarti'nin iyimser completeReady'si), yani ders
  sayfa yenilenmeden aksiyon grubuna geçmeli. `simdi` bu yüzden parametre.

  Disputed DAHİL DEĞİL: itirazdaki derste karar yönetimde, kullanıcının basabileceği bir
  düğme yok. Sayaca girseydi "işlem bekliyor" diyen rozet kullanıcıyı yapamayacağı bir işe
  çağırır ve karar gelene kadar sönmezdi. Derslerim onları ayrı başlıkta gösteriyor.
*/
export function eylemBekliyor(s, simdi = Date.now()) {
  if (s.canApprove || s.canComplete) return true
  return s.iAmTutor && s.status === 'Booked' && new Date(s.scheduledEndUtc).getTime() <= simdi
}
