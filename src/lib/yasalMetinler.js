/*
  YASAL METİNLERİN SÜRÜMÜ — tek kaynak. Web'deki frontend/src/lib/yasalMetinler.js'in
  BİREBİR kopyası (saf JS, platform bağımsız).

  Kayıt formu bu sürümü sunucuya bildiriyor; sunucu kendi sabitiyle (Domain/Identity/
  LegalDocuments.cs) KARŞILAŞTIRIP kendi değerini kaydediyor. Yani buradaki değer bir
  veri değil, bir DOĞRULAMA ANAHTARI: kullanıcının elindeki arayüzün hangi metni
  gösterdiğini söylüyor.

  ⚠️ ÜÇ TARAF BİRLİKTE ARTMALI: sunucu, web arayüzü ve BU DOSYA. Ayrışırsa o istemciden
  hiç kimse kayıt olamaz — gürültülü bir hata ve bilinçli: sessizce yanlış sürümü
  kaydetmektense kaydı durdurmak yeğdir.

  MOBİLDE RİSK DAHA BÜYÜK: web'de "sayfayı yenile" eski arayüzü kurtarır; mağazadan
  kurulmuş bir uygulama kendini yenileyemez. Metin güncellendiğinde eski uygulama
  sürümündeki herkes kayıt olamaz hâle gelir (giriş etkilenmez — kontrol yalnızca
  RegisterHandler'da). Sürüm artırırken mobil sürüm yayını da planlanmalı.

  GÖSTERİLEN TARİH DE BURADAN OKUNUYOR (app/kosullar.jsx, app/gizlilik.jsx). Her sayfa
  kendi tarihini elle yazsaydı, metin güncellenip tarihlerden biri unutulduğunda
  kullanıcıya gösterilen tarih ile kaydedilen sürüm birbirini tutmazdı — ve o fark
  yalnızca bir denetimde, en kötü anda fark edilirdi.
*/

/** Sunucudaki LegalDocuments.CurrentVersion ile BİREBİR aynı olmalı. */
export const SOZLESME_SURUMU = '2026-08-27'

/** Kullanıcıya gösterilen biçim. Sürümle aynı günü anlatır. */
export const SOZLESME_TARIHI = '27 Ağustos 2026'

/** İletişim adresi — hem yasal metinlerin altbilgisinde hem KVKK talep satırında. */
export const ILETISIM_EPOSTA = 'iletisim@dersmate.com'
