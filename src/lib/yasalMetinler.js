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

/*
  ⛔ BU DEĞER PAKETE GÖMÜLÜ — DAĞITIMLA GÜNCELLENMEZ.

  Web'de sürüm, arayüz yeniden derlendiği için sunucu dağıtımıyla birlikte hizalanır.
  Burada öyle değil: kullanıcının telefonundaki APK bu sabiti taşır ve sunucu EŞİTLİK
  aradığı için, sunucu artırılıp kullanıcı güncellemeyi almadıysa o kullanıcı KAYIT
  OLAMAZ (Register.cs → ValidationFailed).

  Yani sürüm artışı mobilde bir ayar değişikliği değil, bir YAYIN işi. Sıra:
    1. burayı ve web'deki karşılığını artır
    2. yeni APK'yı yayınla
    3. sonra sunucuyu dağıt
  Ters sırada, güncellemeyi almamış herkes kayıt ekranında takılır.
*/

/*
  ─── 2026-09-21: 2026-09-05 → 2026-09-19 (WEB VE SUNUCUYA YETİŞTİRİLDİ) ───────

  Bu artış mobilde yeni bir ifşa DEĞİL; kapanmamış bir borcun kapanması. Sunucu
  (LegalDocuments.cs) ve web 2026-09-19'da artırıldı, mobil kopya geride kaldı ve
  ölçüldüğünde aradaki fark iki haftaydı:

      sunucu 2026-09-19 · web 2026-09-19 · MOBİL 2026-09-05

  Register.cs EŞİTLİK arıyor (`request.TermsVersion != LegalDocuments.CurrentVersion`
  → ValidationFailed). Yani bu fark kapatılmadan yayınlanacak bir paketten HİÇ KİMSE
  KAYIT OLAMAZDI. Web tarafındaki artış "mobil mağazada henüz uygulama yokken" yapıldığı
  için o gün kimseyi kilitlemedi — ilk mağaza yayını bu borcu ödenmiş bulmalı.

  ⚠️ SAYIYI TEK BAŞINA ARTIRMAK YANLIŞ OLURDU. Bu sabit bir veri değil, "kullanıcıya
  HANGİ METNİ gösterdim" beyanı. Metni taşımadan sayıyı yükseltmek, gösterilmemiş bir
  metnin kabul edildiğini sunucuya bildirmek olurdu. Bu yüzden artışla AYNI turda
  taşındı: Gizlilik §1 ve Koşullar §1'e veri sorumlusu kimliği, MetinSayfasi'na künye
  bloğu, Hakkımızda'ya imza satırı (bkz. src/lib/kunye.js).

  Artışın web'deki gerekçesi İKİ değişikliği birleştiriyor:
    1. Veri sorumlusu kimliği — metinler "biz" diyordu, kim olduğunu söylemiyordu.
    2. Arkadaş sayısı + ortak arkadaşlar — Gizlilik §6'ya 2026-09-10'da eklenen ama
       sürümü artırılamayan ifşa.
  İkisi tek artışta birleştirildi çünkü ayrı ayrı artırmak mobilde İKİ AYRI MAĞAZA
  YAYINI demekti ve her yayın mağaza incelemesi kadar gün yiyor.
*/

/*
  ─── 2026-09-25: 2026-09-19 → 2026-09-25 (PUSH BİLDİRİMLERİ, ÜÇ YER BİRLİKTE) ──────

  Bu artış YENİ BİR İFŞA ve artması ZORUNLUYDU. Push bildirimleri üç şeyi birden
  getiriyor: yeni bir veri türü (telefonun bildirim adresi, bildirim tercihleri, bildirim
  kayıtları), yeni alıcılar (Expo, Google FCM, Apple APNs) ve bunlarla birlikte yeni bir
  yurt dışı aktarım. Gizlilik §2/§3/§4/§5/§6/§7 AYNI turda yazıldı (app/gizlilik.jsx):
  sayı metinsiz yükselmedi.

  Sunucu (LegalDocuments.CurrentVersion) ve web (frontend/src/lib/yasalMetinler.js) aynı
  değere AYNI dalda (ozellik/push-bildirimleri) çekiliyor. Yukarıdaki "önce mobil yayın,
  sonra sunucu" sırası bu kez GEREKMİYOR: mağazada henüz uygulama yok, yani eski sabiti
  gönderecek kurulu bir paket de yok. Mağazaya ilk çıkış bu değerle olacak; ondan sonraki
  her artışta sıra yeniden "önce mobil yayın".

  ⚠️ Eski kullanıcılar YENİDEN ONAYLATILMIYOR: sürüm yalnızca yeni kayıtları kapsıyor
  (Register.cs). Mevcut kullanıcının push'a ilişkin aydınlatması uygulama içinde, veri
  akışından ÖNCE yapılıyor (BildirimIzniSorusu → "Aç/Devam" → sunucuda
  DisclosureShownAtUtc) ve sunucu o damga olmadan cihaz kaydını kabul etmiyor.
*/

/*
  ─── 2026-09-25 İÇİNDE, YAYINDAN ÖNCE: KOŞULLAR §3 PUAN DÜZELTMESİ (2026-09-26) ──────

  Kullanım koşulları §3 sunucuyla çelişiyordu: "puan yalnızca ders anlatana yazılır"
  (Topluluk oyları da puan basıyor) ve "kazanılan puan 30 günde yanar" (ders ve topluluk
  kazancı vadesiz). Metin gerçeğe çekildi (app/kosullar.jsx, web pages/Kosullar.jsx aynı
  gün, aynı cümleler).

  SÜRÜM ARTMADI ve bu bir istisna değil, kuralın kendisi: sürüm "kullanıcıya hangi metni
  gösterdim" beyanı. 2026-09-25 bugün HİÇBİR yerde yayında değil (sunucu, web ve mobil
  main'e birleşmemiş dallarda); bu sürümü kabul etmiş tek bir kullanıcı yok. Yayından
  önce aynı sürümün metnini düzeltmek, kimseye gösterilmemiş bir metni değiştirmek.
  2026-09-25 yayına çıktıktan SONRA §3'e dokunan her değişiklik sürümü artırır.

  ─── 2026-09-25 İÇİNDE, YAYINDAN ÖNCE: GİZLİLİK §4/§7 YOL METİNLERİ (2026-09-26) ────

  Ayarlar Profil ekranından ayrı bir Ayarlar ekranına taşındı (app/ayarlar.jsx). Gizlilik
  §4 ("Veri tercihleri"nin yeri) ve §7 (Düzeltme, Silme, Bildirimleri kapatma) artık
  "Profil › Ayarlar › …" diyor; izin sayfasındaki zorunlu kategori metni (IzinContext) ve
  bildirim aydınlatması da. Yeni bir ifşa yok, yalnızca yol tarifi; aynı gerekçeyle sürüm
  ARTMADI. IZIN_SURUMU da artmadı: izne tabi kapsam değişmedi (IzinContext kuralı).

  ─── 2026-09-25 İÇİNDE, YAYINDAN ÖNCE: HOŞ GELDİN PUANI VE TOPLULUK İÇERİĞİ (2026-09-27) ─

  • Koşullar §3'e ayrı madde: hoş geldin puanı 14 gün sonra silinir, seviyeye sayılmaz
    (sunucu: WelcomeCreditValidityDays, ExpireCredits). 2026-09-26 düzeltmesi eski "puan
    yanar" cümlesini kaldırınca bu yanmayı anlatan tek söz de gitmişti.
  • Gizlilik §2 (İçerik), §6 (görünürlük) ve §7 (Silme) Topluluk'u sayıyor: gönderi, yorum,
    oy ve şikayet işleniyor; gönderi ve yorum adla giriş yapmış herkese açık; hesap
    silinince Topluluk içeriği "Silinmiş kullanıcı" adıyla kalıyor (DeleteAccount forum
    tablolarına dokunmuyor). Ayarlar → HesabiSilModali "Kalacaklar" aynı gün.
  İkisi de gerçeğe çekme, sunucu davranışı değişmedi; yukarıdaki gerekçeyle sürüm ARTMADI.
  Web (pages/Kosullar.jsx, Gizlilik.jsx, HesapSilme.jsx §3, Profile.jsx Kalacaklar) aynı
  olguları aynı gün yazmalı.

  ─── ⛔ BİRLEŞME SIRASI: PUSH PR'LARI TASARIM DALINDAN ÖNCE TEK BAŞINA ALINMAZ ─────────

  Yukarıdaki üç "sürüm içi" düzeltme YALNIZCA tasarim/profil-dersler-topluluk dalında.
  ozellik/push-bildirimleri dalı (mobil PR #20, sunucu + web PR #38; ikisi de main'e
  hedefli ve açık) AYNI sürümü ('2026-09-25') ESKİ metinle taşıyor: Koşullar §3 "Puan
  yalnızca ders anlatana yazılır" ve "kazanılan puanın geçerlilik süresi 30 gündür;
  süresi dolan puan yanar", Gizlilik'te Topluluk yok, yol metinleri "Profil ekranının en
  altı". O dal tek başına birleşip dağıtılırsa (sunucu ya da web yayına çıkarsa) o arada
  kayıt olan kullanıcının TermsVersion'ı '2026-09-25' olur (Register.cs), tasarim dalı
  gelince aynı dizge BAŞKA bir metne karşılık gelir ve onayın kanıt değeri kaybolur.

  Kural: #20 ve #38 TEK BAŞINA main'e alınmaz, dağıtılmaz. Bu dal push dalının üstünde
  (push dalı atası), yani bu dalın PR'ı push işini de taşıyor: iki iş aynı birleştirmede
  ve aynı dağıtımda çıkar. Push dalı ayrı birleşip YAYINA çıkarsa (ör. bu dal gecikir),
  tasarim dalı birleşmeden önce SOZLESME_SURUMU'nu ARTIRIR (üç yer birlikte: sunucu
  LegalDocuments.CurrentVersion, web ve mobil yasalMetinler.js) — 2026-09-25 o zaman
  "yayında" sayılır ve yukarıdaki sürüm içi gerekçe geçersizleşir. Aynı kural web
  lib/yasalMetinler.js'te, sunucu LegalDocuments.cs notunda ve iki CLAUDE.md'de yazılı;
  PR açıklamalarına da eklenmeli.
*/

/** Sunucudaki LegalDocuments.CurrentVersion ile BİREBİR aynı olmalı. */
export const SOZLESME_SURUMU = '2026-09-25'

/** Kullanıcıya gösterilen biçim. Sürümle aynı günü anlatır. */
export const SOZLESME_TARIHI = '25 Eylül 2026'

/*
  ⚠️ ILETISIM_EPOSTA BURADAN KALDIRILDI (2026-09-21) → src/lib/kunye.js.
  Web'de de aynı taşıma yapıldı. Sebep: adres artık bir altbilgi satırı değil, KVKK
  m.11 başvuru adresi ve künyenin parçası; sözleşme sürümüyle aynı dosyada durması
  birbirinden bağımsız iki şeyi ("hangi metni gösterdim" / "bana nereden ulaşılır")
  aynı yere bağlıyordu. İçe aktarımı kunye.js'ten yap.
*/
