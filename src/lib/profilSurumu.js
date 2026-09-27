/*
  PROFİL SÜRÜMÜ — kullanıcı kendi profil bilgisini (ad, hakkında, okul, bölüm) başka bir
  ekrandan değiştirdiğinde artan, bellekteki bir sayaç. forumSurumu.js / engelSurumu.js
  ile BİREBİR aynı desen: farklı olay, farklı tüketici.

  NEDEN VAR: "Profili düzenle" 2026-09-26'da Profilim'den Ayarlar ekranına (app/ayarlar.jsx)
  taşındı. Profilim kök yığında KURULU kalıyor ve Ayarlar onun üstüne itiliyor; düzenleyip
  geri dönen kullanıcı, kendiliğinden tazelenmeyen ekranda eski adı ve eski "hakkında"
  yazısını görürdü (CLAUDE.md → "Başka ekranda değişen veri ODAKTA tazelenir").

  NEDEN HER ODAKTA DEĞİL: Profilim'in tazelenmesi görünümü yeniden kuruyor (profil,
  değerlendirmeler, rozetler ve arkadaşlar: beş-altı istek) ve kullanıcının açtığı
  akordeonları kapatıyor. Profilim'in üstüne açılan her ekrandan (Ayarlar'a girip hiçbir
  şey değiştirmeden çıkmak dahil) dönüşte bunu yapmak boşa istek olurdu. Sayaç, "gerçekten
  değişti mi" sorusunun ucuz cevabı.

  Kim ARTIRIR: api.updateProfile'ı çağıran her yer, başarıdan SONRA. Bugün tek çağrı yeri
  var (app/ayarlar.jsx → ProfilDuzenleModali). Fotoğraf değiştirme Profilim'in kendisinde
  ve görünümü zaten kendisi yeniden kuruyor; sayaca ihtiyacı yok.

  Sayaç api.js'te DEĞİL, çağrı yerinde artıyor: önizleme modu api nesnesini onizlemeApi
  ile eziyor (Object.assign), yani api.js'teki bir sarmalayıcı orada hiç koşmazdı.

  Oturumdan bağımsız: çıkış-giriş sayacı sıfırlamaz. Değeri bir anlam taşımaz; yalnızca
  "değişti mi" sorusunu cevaplar.
*/
let surum = 0

export function profilSurumu() {
  return surum
}

export function profilDegisti() {
  surum += 1
}
