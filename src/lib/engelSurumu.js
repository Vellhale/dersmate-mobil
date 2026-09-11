/*
  ENGEL SÜRÜMÜ — engelleme ya da engel kaldırma başarıyla bittiğinde artan, bellekteki
  bir sayaç.

  NEDEN VAR: web'de her sayfa geçişi bileşeni yeniden kuruyor ve sorgular baştan koşuyor.
  Mobilde başkasının profili kök yığında Keşfet'in ÜSTÜNE açılıyor ve Keşfet kurulu
  kalıyor. Profilde engellenen kişi Keşfet sonuçlarında duruyordu, Engellediklerim eski
  sayıyı gösteriyordu. Karttaki isteğe basan kullanıcı da kendi koyduğu engeli sunucunun
  nötr hata metninden öğreniyordu. Keşfet odak kazanınca bu sayaca bakıyor ve yalnızca
  DEĞİŞTİYSE tazeliyor; neden her odakta değil, orada yazıyor.

  Sayaç api.js'te DEĞİL, çağrı yerlerinde artıyor: önizleme modu api nesnesini
  onizlemeApi ile eziyor (Object.assign), yani api.js'teki bir sarmalayıcı orada hiç
  koşmazdı. Bu yüzden blockUser/unblockUser çağıran HER yer başarıdan sonra
  engelDegisti() çağırmalı: EngellemeModali, Keşfet'teki Engellediklerim ve profildeki
  "Engeli kaldır". Yeni bir çağrı yeri eklenirse buraya da bağlanmalı.
*/
let surum = 0

export function engelSurumu() {
  return surum
}

export function engelDegisti() {
  surum += 1
}
