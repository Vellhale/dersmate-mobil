/*
  FORUM SÜRÜMÜ — moderatör bir gönderiyi/yorumu kaldırdığında ya da geri getirdiğinde
  artan, bellekteki bir sayaç. `engelSurumu.js` ile BİREBİR aynı desen; gerekçesi de
  aynı aileden, o yüzden ikisi ayrı dosyada: farklı olaylar, farklı tüketiciler.

  NEDEN VAR: Topluluk artık ANA EKRAN ve kök yığında kurulu kalıyor. Yönetim ekranı ise
  çekmeceden İKİ DOKUNUŞ uzakta ve tam da bu ekranın verisini değiştiriyor
  (api.moderateForumContent → gönderi/yorum kaldırılır ya da geri gelir). Moderatör
  akışta spam bir gönderi görüp Yönetim'den kaldırdıktan sonra geri döndüğünde, kaldırdığı
  gönderi hâlâ ekranda duruyordu — CLAUDE.md'deki "başka ekranda değişen veri ODAKTA
  tazelenir" kuralının ihlali.

  ⚠️ BU EKRANDA "HER ODAKTA TAZELE" YAPILAMAZ: Topluluk listesi onEndReached ile
  BİRİKİYOR ve tazeleme 1. sayfadan kuruyor. Her odakta koşsaydı, bir gönderiye dokunup
  geri dönen kullanıcının biriktirdiği sayfalar ve kaydırma yeri silinirdi — en sık yol
  tam olarak bu. Sayaç, "gerçekten değişti mi" sorusunun ucuz cevabı.

  Sayaç api.js'te DEĞİL, çağrı yerinde artıyor: önizleme modu api nesnesini onizlemeApi
  ile eziyor (Object.assign), yani api.js'teki bir sarmalayıcı orada hiç koşmazdı.
  Bu yüzden `moderateForumContent` çağıran HER yer başarıdan sonra `forumDegisti()`
  çağırmalı. Bugün tek çağrı yeri var (app/yonetim.jsx); yenisi eklenirse buraya da
  bağlanmalı.
*/
let surum = 0

export function forumSurumu() {
  return surum
}

export function forumDegisti() {
  surum += 1
}
