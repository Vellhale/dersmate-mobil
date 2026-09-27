import { useCallback, useEffect, useRef } from 'react'

/**
 * Ürün turu — adımlar, ölçüm defteri ve tek kullanımlık sinyaller.
 *
 * Web karşılığı: frontend/src/lib/tour.js. MEKANİZMA taşınmadı: web'de adımlar bir CSS
 * seçicisiyle (`selector`) DOM'da öğe arıyordu. RN'de document yok — çıpayı öğenin
 * KENDİSİ bildirir (bkz. ölçüm defteri).
 *
 * ─── 9 → 14 ADIM: AYRINTI YENİ ADIMLARA (2026-09-27) ───────────────────────────────
 * Kullanıcı kararı: "uygulama biraz karışık, rehberi daha çok detaylandıralım".
 * Beş adım EKLENDİ — rules, requests, proof, history, safety — ve ayrıntının tamamı
 * onlara kondu. Kilitli altı adımın (free, discover, portfolio, matches, chat,
 * sessions) metnine DOKUNULMADI: web'le bayt pariteti böylece kendiliğinden korundu.
 * Değişen tek eski madde `menu`nun ikincisi (hamburger rozetinin ne saydığı) ve o adım
 * zaten mobile özgü.
 *
 * Beş adım da ÇIPASIZ + yer çipli. Anlattıkları şeyler koddan doğrulandı; ilk taslakta
 * dokuz iddia yanlış ya da eksikti (doğrulama kodunun kime göründüğü, engellemenin
 * arkadaşlığı kapatıp kapatmadığı, Rezerve geçmişi'nin kapsamı, Topluluk puan eşiğinin
 * tek katkıda değil TOPLAM net oyda olması…). Gerekçeler adımların kendi yorumlarında.
 *
 * SIRA: mobilde adımlar ARAYA eklendi (anlatım sırası bozulmasın diye), web'de SONA
 * eklenecek. Sebep `lastStep`: sunucuda tek sayı ve araya ekleme turu yarıda bırakan
 * kullanıcıyı kaydırıyor. Web CANLIDA, mobil henüz mağazada DEĞİL — bu serbestlik ilk
 * yayınla kapanır ve sonraki adımlar mobilde de sona eklenir.
 *
 * ⚠️ İLERLEME ŞERİDİ yeniden ölçülmeli: dokuz çubuk için ölçülmüştü, on dört için
 * hesap 320dp'de ~10dp çubuk veriyor (taşma yok, `max-w-[24px] flex-1` küçültüyor) ama
 * cihazda ve büyük yazıda (1.3) doğrulanmadı. ⛔ Çubuklara min genişlik VERİLMEZ.
 *
 * ─── 6 → 9 ADIM, WEB'DEN BİLİNÇLİ AYRIŞMA (2026-09-26) ──────────────────────────────
 * Rehber ürünün SON hâlini anlatıyor (kullanıcı kararı). Web 8 adım, mobil 9 ve SIRA
 * farklı; ortak adımların (free, discover, portfolio, matches, chat, sessions) metni iki
 * platformda BİREBİR aynı, ayrışan yalnızca yapı:
 *   • Topluluk BAŞTA: mobilde tur Topluluk'ta (ana ekran) açılıyor, anlatım kullanıcının
 *     baktığı ekrandan başlıyor. Web'de Topluluk 7. adım ve metni "Menüdeki “Topluluk”"
 *     diye başlıyor; maddeleri aynı.
 *   • Menü AYRI bir adım (2): sekme çubuğu yok, gezinmenin tek yolu çekmece. Web'de
 *     sol ray her zaman ekranda, böyle bir adıma gerek yok.
 *   • Ayarlar ve bildirimler SONDA (9): web'de push yok; web'in son adımı "Profilin ve
 *     ayarların" (dişli menü + Arkadaşlarım).
 *   • `lastStep`in platformlar arası anlamı KALMADI: ilerleme hesapta tek satır, aynı
 *     indeks iki platformda farklı adımı gösterir. Web yeni adımlarını sona ekleyerek
 *     kendi eski indekslerini korudu; mobil Topluluk'u başa koyduğu için koruyamazdı
 *     (mobil henüz mağazada değil, yarıda bırakan mobil kullanıcı yok). Kalan etki: webde
 *     yarıda bırakan biri mobilde birkaç adım erken ya da geç devam eder. Taşmayı
 *     UrunTuru'daki Math.min kesiyor (web'in 8'i mobilin 9'undan küçük, taşma yine de
 *     sınanıyor).
 *
 * ─── ÇIPASIZ ADIM + YER ÇİPİ (mobilde KURAL) ───────────────────────────────────────
 * Çekmecenin İÇİNE çıpa konamaz (RNModal ayrı pencere, kapalıyken satırlar takılı
 * değil) ve beş adımı aynı hamburgere bağlamak beş kez aynı 44px kutuyu göstermek
 * olurdu. Menü bu yüzden TEK adımda (menu) ışıklandırılıyor; 4–8. adımlar ortada kart ve
 * her birinde menüdeki satırın küçük bir kopyası duruyor (`yer`, UrunTuru → YerCipi).
 * Kullanıcı neyi arayacağını GÖRÜYOR; hiçbir çıpaya gerek yok.
 *
 * `yer` menüdeki bir yolsa çipin etiketi ve ikonu Cekmece.jsx → OGELER'den okunur:
 * menüde yazan ad ile rehberin gösterdiği ad ayrışamaz. 'ayarlar' OGELER'de yok;
 * UrunTuru'daki EK_YERLER eşlemesinde (Profilim'in sağ üstündeki dişli).
 *
 * ─── ADIM METİNLERİ: KISA CÜMLE + MADDELER (web, 2026-08-24) ─────────────────────
 * Her adım tek bir yoğun paragraftı; kart altı satır metinle doluyor ve kullanıcı
 * okumadan "Devam"a basıyordu. Sadeleşen BİÇİM, detaylanan KAPSAM:
 *   • `body` tek cümle — kullanıcı yalnızca bunu okusa bile adımı anlamış olmalı.
 *   • `points` 2–3 kısa madde — ayrıntı burada; göz taramayla ilerliyor.
 *
 * BAŞLIKLARDA EMOJİ YOK (web kararı, SubjectBadges ile aynı gerekçe): emoji her
 * platformda başka çiziliyor. Vurgu için BÜYÜK HARF de yok — ayrımı cümle taşır.
 *
 * SAYI YAZILMIYOR. Ne puan eşikleri ne blok başına basılan puan buraya yazıldı:
 * kural değişince rehberi güncellemeyi kimse hatırlamaz ve rehber sessizce yalan
 * söylemeye başlar. Anlatılan tek şey mekanizma. "10 basamaklı" istisna: o, ölçeğin
 * kendisi, eşiği değil.
 *
 * EKONOMİ: ders almak ücretsiz, bloke edilen bir şey yok, DERS puanı yalnızca ANLATANA
 * yazılır. Puanın tek kaynağı ders değil: Topluluk'ta yeterli net oy toplayan katkı da
 * puan getiriyor (Kullanım koşulları §3) — portfolio adımı bu yüzden "tek yol" değil
 * "asıl kaynak" diyor. Yanlış beklenti kuran bir rehber, hiç rehber olmamasından kötüdür.
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * ŞEMA: { id, title, body, points, cipa?, cipaEkrani?, yer? }
 *
 * `cipa`: adımın ışık tutacağı çıpanın ADI (web'deki `selector`ın karşılığı).
 * Çıpa kayıtlı değilse adım ORTADA kart olarak gösterilir (bkz. UrunTuru) — web'deki
 * yedek davranışın aynısı ve mobilde KURAL, istisna değil: tur ekran değiştirmez,
 * dolayısıyla o an ekranda olmayan her çıpa yoktur. Adım metinleri bu yüzden
 * ışıklandırmaya değil KENDİNE yeter; nereden gidileceğini cümle söyler.
 *
 * `cipaEkrani`: çıpanın OKUNACAĞI adres (tek adres ya da dizi). ⛔ EKRANA ÖZGÜ BİR
 * ÇIPADA ZORUNLU. Kök yığın kabuk ekranlarını MONTE tutuyor ve defter yalnızca ada
 * bakıyor: tur '/kesfet'te açıldığında ya da tur açıkken bildirime dokunulup başka
 * ekrana geçildiğinde, altta kalan Topluluk'un 'gonderi-yaz' ölçüsü öndeki ekrana
 * YANLIŞ BİR DELİK açardı. Adres tutmazsa adım ortada kart olur.
 * 'menu' de aynı kurala bağlı: hamburger yalnızca beş kabuk ekranında var; üstlerine
 * açılan bir yığın ekranında (Derslerim, sohbet…) sol üstte duran geri düğmesidir.
 *
 * `yer`: çipin göstereceği yer — menüdeki bir yol ya da 'ayarlar' (yukarıda).
 *
 * Çıpa adları başka dosyalardaki ekranlarla SÖZLEŞMEDİR; değişirlerse iki taraf
 * birden güncellenir (web'de `data-tour="rank"` adının, rozetin içeriği değişmesine
 * rağmen bilerek korunmasıyla aynı gerekçe: ad değişince kimse fark etmeden kırılır).
 * Adım metinleri de ekrandaki adlara bağlı (menü etiketleri, Derslerim sekmeleri,
 * dişlinin "Ayarlar" adı): biri yeniden adlandırılırsa bu dosya AYNI değişiklikte
 * güncellenir.
 */

/* Hamburger düğmesinin (çıpa 'menu') çizildiği kabuk ekranları. Yeni bir kabuk ekranı
   HamburgerDugmesi alırsa buraya da eklenir; eklenmezse o ekranda menü adımı yalnızca
   ortada kart olur (yanlış delik değil). */
const KABUK_EKRANLARI = ['/', '/kesfet', '/olustur', '/mesajlar', '/profil']

export const TUR_ADIMLARI = [
  {
    id: 'community',
    /* Tek EKRANA ÖZGÜ çıpa: app/index.jsx → GonderiKutusu (avatar + yazma kutusu). Kutu
       liste başlığında, yani liste kaydırılmışsa ekran dışında kalır; UrunTuru o zaman
       deliği düşürür ve kart ortada çıkar. */
    cipa: 'gonderi-yaz',
    cipaEkrani: '/',
    yer: '/',
    title: 'Topluluk — ana sayfan',
    body: 'Burası dersmate’in sosyal ağı: öğrenciler soru sorar, deneyimini paylaşır, birbirine yanıt verir.',
    points: [
      'Gönderini bir etiketle paylaş; yalnızca metin, dosya yükleme kapalı.',
      'Gönderileri oyla, altına yorum yaz.',
      'Kurallara aykırı bir içerik görürsen şikayet et.',
    ],
  },
  {
    /*
      Topluluk'un GERİ ALINAMAZLIĞI ve puan getirmesi hiçbir ekranda yazmıyordu:
      yazma kipindeki "Paylaşmadan önce" kutusu üç kural sayıyor ama kalıcılığı
      söylemiyor; sunucuda gönderi/yorum için DELETE ya da PUT ucu YOK, hesap
      silinse bile içerik kalıyor (ad "Silinmiş kullanıcı" oluyor). İlk kez
      paylaşan biri bunu ancak silmeyi arayıp bulamayınca öğreniyordu.

      Bağlantı eşiği maddesi "gönderilerde" diyor ve bu BİLİNÇLİ: kapı yalnızca
      CreateForumPostHandler'da (ForumCommands → BaglantiKapisi), yorumda karşılığı
      yok. Yorumların serbest olduğunu YAZMIYORUZ — o bir atlatma tarifi olurdu.
      Kapı yorumlara da konursa ya da Topluluk metni daraltılırsa bu madde de değişir.

      "Topluluk hakkında" diye BİR SAYFA ADI VERİLMEDİ: mobilde o bir alt sayfa,
      web'de Topluluk sayfasının yan sütunundaki iki kart. Tarafsız ifade sayesinde
      madde iki platformda BİREBİR aynı kalıyor.
    */
    id: 'rules',
    yer: '/',
    title: 'Toplulukta neler geçerli',
    body: 'Paylaştığın gönderi ve yorum geri alınamaz — silme ya da düzenleme yok.',
    points: [
      'Yazdıklarının topladığı net oy belli bir düzeye ulaştıkça puan yazılır; puanın ikinci kaynağı burası.',
      'Kendi gönderine oy veremezsin.',
      'Dışarıya bağlantı paylaşımı gönderilerde belli bir seviyeden sonra açılıyor; kurallar ve alınan önlemler ayrıca yazılı.',
    ],
  },
  {
    id: 'menu',
    // Menünün KENDİSİ; satırları ortadaki kartlarda yer çipiyle gösteriliyor (yukarıda).
    cipa: 'menu',
    cipaEkrani: KABUK_EKRANLARI,
    title: 'Menü — her şey sol üstte',
    body: 'Uygulamanın bütün bölümlerine sol üstteki menüden geçersin.',
    points: [
      'Keşfet, Ders Portföyü, Arkadaşlar, Sohbet, Derslerim ve Topluluk burada.',
      // Eski hâli yalnızca "bir satırın yanında sayı görürsen …" diyordu ve ÇEKMECE
      // SATIRLARINI anlatıyordu; hamburgerin ÜSTÜNDEKİ rozet hiç anılmıyordu. Oysa
      // kullanıcının ilk gördüğü sayı o ve üç şeyin TOPLAMI (Cekmece → parcalar:
      // okunmamış mesaj + gelenIstek + dersEylem). Mobil alışkanlığıyla "okunmamış
      // mesaj" sanılıp menüdeki Sohbet sayısıyla çelişkili görünüyordu. Web'de bu
      // madde YOK: orada hamburgerde sayı değil nokta var ve yalnızca mesaj sayıyor.
      'Menü düğmesindeki kırmızı sayı üçünün toplamı — okunmamış mesaj, sana gelen istek ve senden iş bekleyen ders; hangisi olduğu menüdeki satırlarda yazıyor.',
      'Menünün en üstündeki adına dokunursan profiline gidersin.',
    ],
  },
  {
    id: 'free',
    // Çıpasız: web'de bu adım üst bardaki seviye rozetine bağlı (data-tour="rank"),
    // mobilde her ekranda duran böyle bir rozet yok. Metin zaten bir yere işaret
    // etmiyor, ortada kart olarak doğru çalışıyor.
    title: 'Ders almak ücretsiz',
    body: 'Burada para yok, harcadığın bir kredi de yok. Puanı ders anlatarak kazanırsın.',
    points: [
      'Ders almak her zaman ücretsiz — bakiyenden bir şey düşmez.',
      'Puan, anlattığın dersin onaylandığı anda yazılır.',
      'Biriken puan seviyeni yükseltir; ölçek 10 basamaklı.',
    ],
  },
  {
    id: 'discover',
    yer: '/kesfet',
    title: 'Keşfet — ders bul',
    body: 'Almak istediğin konuyu anlatabilen öğrencileri menüdeki “Keşfet”te bulursun.',
    points: [
      'YKS sekmesi, almak istediğin konulara göre sana öneri getirir; yazarak katalogda da ararsın.',
      'Üniversite ve Arkadaş Ekle sekmeleriyle okulundan ya da tanıdığın birini bulursun.',
      '“Karşılıklı takas” etiketi, o kişinin de senden bir konu aradığını gösterir.',
    ],
  },
  {
    /*
      Başlık 2026-09-23'te web'e GERİ hizalandı. Mobilde portföye giriş bir süre tab
      çubuğunun ortasındaki ekleme sekmesiydi ve kullanıcının gördüğü ad "Oluştur"du;
      sekme çubuğu kalkınca o ad ekranda hiçbir yerde yazmıyor. Çekmecedeki satır
      web'le aynı: "Ders Portföyü". Rehberin işaret ettiği yerin adı, ekranda yazan
      adla aynı olmalı.
    */
    id: 'portfolio',
    yer: '/olustur',
    title: 'Ders Portföyü — ne anlatabilirsin',
    body: 'Anlatabildiğin konuları ekle; Keşfet’te başkalarına böyle görünürsün.',
    points: [
      'Almak istediğin konuları da buraya eklersin; öneriler onlardan üretilir.',
      'Portföyün boşken kimse senden ders isteyemez.',
      // "Tek yolu" DEĞİL (2026-09-26): Topluluk'ta oy toplayan katkılar da puan getiriyor
      // (Kullanım koşulları §3; sunucuda CommunityRewardRules).
      'Puanın asıl kaynağı ders anlatmak — başlangıcı burası.',
    ],
  },
  {
    id: 'matches',
    yer: '/eslesmeler',
    title: 'Arkadaşlar — istek gönder ve al',
    body: 'Gönderdiğin ve sana gelen ders istekleri menüdeki “Arkadaşlar”da toplanır.',
    points: [
      'Gelen bir isteği kabul ya da reddedersin.',
      'Kabul edilen istekte sohbet kendiliğinden açılır.',
      'Arkadaşlığı istediğin an sonlandırabilirsin.',
    ],
  },
  {
    /*
      GÖNDERENİN TARAFI hiçbir yerde anlatılmıyordu. Giden istek kartında yalnızca
      amber "Yanıt bekleniyor" rozeti var: ne tarih, ne geri sayım, ne sonuç.
      Üç son da gönderende AYNI görünüyor — kart yok olur:
        kabul   → MatchRequests: Accepted + Conversation açılır, BildirimKuyrugu.IstekKabul
        ret     → Declined, ⛔ BİLDİRİM YOK (bilinçli: bildirimin gelmemesi engeli ilan ederdi)
        düşme   → SweepSessions, MatchRules.RequestExpireDays sonunda Expired
      Kullanıcı bunu hata ya da ağ sorunu sanıyordu. Ret ile engeli AYIRT EDEMEMESİ de
      bilinçli (engelleme bekleyen isteği Declined yazıyor); rehber bu yüzden ret için
      ayrı bir vaat VERMİYOR.

      SAYI YAZILMIYOR (dosya kuralı): "bir süre sonra" deniyor, 14 gün değil.
      Yeniden gönderebilme, mükerrer kontrolünün yalnızca Pending'e bakmasından geliyor.
    */
    id: 'requests',
    yer: '/eslesmeler',
    title: 'İstek gönderdikten sonra',
    body: 'Gönderdiğin bir isteğin üç farklı sonu var ve ikisi sessiz.',
    points: [
      'Kabul edilirse sohbet açılır ve kişi “Arkadaşlar”da görünür.',
      'Reddedilirse sana bildirilmez; istek listeden sessizce kalkar.',
      'Yanıtsız kalan istek bir süre sonra kendiliğinden düşer — aynı kişiye yeniden gönderebilirsin.',
    ],
  },
  {
    id: 'chat',
    yer: '/mesajlar',
    title: 'Sohbet — saati ve linki kararlaştır',
    body: 'Ders saatini ve görüşme linkini karşı tarafla menüdeki “Sohbet”te konuşursun.',
    points: [
      'Zoom, Google Meet ya da Discord — dersi biz barındırmıyoruz.',
      'Linki sohbete yapıştırman yeterli.',
      // Rezervasyonu yapan ÖĞRENCİ olur (BookSession: çağıran, StudentUserId). Eski metin
      // "rezerve edersiniz" diyordu ve iki taraf da rezerve edebilir gibi okunuyordu.
      'Anlaştığınızda dersi alan taraf Derslerim’den rezerve eder.',
    ],
  },
  {
    id: 'sessions',
    yer: '/dersler',
    title: 'Derslerim — rezervasyon, kanıt ve onay',
    // Sekme adları app/dersler.jsx → SEKMELER ile aynı: rehberin söylediği ad ekranda
    // yazan adla aynı olmalı. Sekmeler yeniden adlandırılırsa bu adım aynı değişiklikte
    // değişir.
    body: 'Her dersin burada; planlanmış, geçmiş dersler, puan ve rezerve geçmişi ayrı sekmelerde.',
    points: [
      '“Senden aksiyon bekleyenler”, kanıt yüklemen ya da onaylaman gereken dersleri toplar.',
      'Anlatan taraf dersin ekran görüntüsünü yükler, alan taraf onaylar; puan o anda yazılır.',
      'Onay gelmezse ders kendiliğinden onaylanır; sorun varsa itiraz edersin, kararı yönetim verir.',
    ],
  },
  {
    /*
      PUAN KAYBINA GİDEN GERÇEK TUZAK. Anlatan, kanıtta doğrulama kodunun görünmesi
      gerektiğini ilk kez "Dersi tamamladım" kipini açınca okuyordu — o an ders bitmiş,
      görüşme kapanmış, ekran görüntüsü çoktan alınmış (ya da alınmamış) oluyor.

      ⚠️ KOD BİR SIR DEĞİL, DERSİN KİMLİĞİ. İlk taslak "kodu rezervasyonda alan taraf
      görür" diyordu; YANLIŞTI: GetMySessions kodu iki role de döndürüyor ve ders kartı
      rol ayrımı yapmadan çiziyor (dersler.jsx → showCode). Sunucu da görüntüyü OKUMUYOR
      (SessionRules yalnızca eğitmenin YAZDIĞI kodu karşılaştırıyor; kanıtta tek kontrol
      tür/boyut). Yani kanıtın gerçekliğini denetleyen tek merci ONA BAKAN öğrenci —
      kodu bir doğrulama sırrı gibi anlatmak asıl korumayı kaybettirirdi.

      Üçüncü madde otomatik onayın GÖRÜNMEYEN bedelini söylüyor: onay kendiliğinden
      gelince itiraz yolu da kapanıyor (SessionRules → DisputeViolation yalnızca
      AwaitingApproval ya da bitişi geçmiş Booked'da açık). Kilitli `sessions` adımı
      otomatik onayı zaten anıyor, burada EKLENEN şey o bedel.
    */
    id: 'proof',
    yer: '/dersler',
    title: 'Kanıt ve doğrulama kodu',
    body: 'Ders bitince anlatan taraf bir ekran görüntüsü yükler; o görüntüde dersin doğrulama kodu ve sistem saati görünmelidir.',
    points: [
      'Kod dersin kendisine ait ve Derslerim’de iki tarafta da yazılı; ders başlarken görüşme ekranına yazın.',
      'Tamamlama, dersin planlanan bitişinden önce açılmaz.',
      'Onay kendiliğinden geldiğinde itiraz yolu da kapanır — kanıta beklemeden bak.',
    ],
  },
  {
    /*
      "Geçmiş dersler" doğal olarak "olup bitmiş her ders" diye okunuyor; oysa yalnızca
      TAMAMLANANLARI gösteriyor (dersDurumu.js → dersSekmesi; sunucuda ?pastStatus=Completed).
      İptal edilen ve süresi geçip kapanan ders oraya HİÇ girmiyor. Dersini iptal eden
      kullanıcı "Geçmiş dersler"e bakıp hiçbir şey bulamıyor ve kaydın silindiğini sanıyordu.
      ⚠️ "Rezerve geçmişi" yalnızca onların yeri DEĞİL, BÜTÜN rezervasyonların defteri —
      ilk taslak bunu daraltıyordu.

      Üçüncü madde EN PAHALI BOŞLUĞU kapatıyor: değerlendirme ekranı YALNIZCA öğrencinin
      ELLE onayının hemen ardından açılıyor (ReviewModal) ve başka girişi yok; kaçıran bir
      daha yazamıyor, ders otomatik onaylandıysa ekran hiç açılmıyor. Üstelik yazılan
      değiştirilemiyor ve silinemiyor (sunucuda PUT/DELETE ucu yok), anlatanın profilinde
      herkese görünüyor. "Sonradan yazarsın" beklentisi kurmak şansı bilmeden harcatırdı.
    */
    id: 'history',
    yer: '/dersler',
    title: 'Hangi ders hangi sekmede',
    body: '“Geçmiş dersler” yalnızca tamamlananları gösterir; iptal edilen ve süresi geçip kapanan dersleri bütün rezervasyonların durduğu “Rezerve geçmişi”nde bulursun.',
    points: [
      '“Senden aksiyon bekleyenler” kanıt yüklemen ya da onaylaman gereken dersleri toplar; itirazdakiler ayrı başlıkta.',
      'Anlatan taraf hiç tamamlamazsa rezervasyon bir süre sonra düşer ve kimse puan almaz.',
      'Onayı verdiğin anda değerlendirme ekranı açılır — tek şansın o an: sonradan yazılamaz, yazdığın da değiştirilemez ve adınla anlatanın profilinde görünür.',
    ],
  },
  {
    /*
      ENGELLEMENİN EN ŞAŞIRTICI SONUCU hiçbir metinde yoktu: zaten arkadaş olduğun kişiyi
      engellersen arkadaşlık AÇIK kalıyor (UserBlocks → kabul edilmiş eşleşmeye
      dokunulmuyor) ve kişi Arkadaşlar ekranında, "Arkadaşlarım · N" sayısında duruyor.
      Kullanıcı "engelledim ama hâlâ listemde" deyip engellemenin çalışmadığını sanıyordu.

      ⚠️ İlk taslak "iletişimi bitirmek için ayrıca sonlandır" diyordu; YANLIŞTI: iletişim
      engellemeyle ZATEN bitiyor (SendMessage 403, BookSession 409). Sonlandırma yalnızca
      kaydı kaldırıyor — ve AÇIK DERS VARKEN ÇALIŞMIYOR (CloseMatch → AcikDersDurumlari,
      409). Kullanıcıyı çalışmayacak bir düğmeye göndermemek için sıra böyle kuruldu.

      Engeli kaldırmanın İKİ yolu var; ilk taslak yalnızca birini biliyordu.
    */
    id: 'safety',
    yer: '/kesfet',
    title: 'Engelleme ve şikayet',
    body: 'Engellediğin kişi seni aramada bulamaz, sana yazamaz ve yeni ders rezerve edemez.',
    points: [
      'Zaten arkadaşsanız engellemek kişiyi arkadaş listenden düşürmez; kaydı da kaldırmak istersen arkadaşlığı ayrıca sonlandır (açık ders varken sonlandırma çalışmaz).',
      'Engeli Keşfet’in “Arkadaş Ekle” sekmesindeki Engellediklerim listesinden ya da o kişinin profilinden kaldırırsın.',
      'Kurallara aykırı bir içeriği gördüğün yerden şikayet edersin; kararı yönetim verir.',
    ],
  },
  {
    /*
      Push İSTEĞE BAĞLI ve rehber izin İSTEMEZ: bu adımda "Bildirimleri aç" düğmesi
      BİLEREK yok. İzin sorusu aydınlatma akışından geçmek zorunda (BildirimSaglayici,
      oturum başına tek yüzey, geri çekilme sayacı); rehberden açılan bir kısa yol o
      akışı atlardı. Maddeler baskı kurmuyor: "açmasan da ... görünür" (App Review 4.5.4).
      Tur açıkken aydınlatma sorusu zaten kendiliğinden açılmıyor (UrunTuru → turAcik).
    */
    id: 'settings',
    yer: 'ayarlar',
    title: 'Ayarlar ve bildirimler',
    body: 'Profilindeki ayarlar simgesinden profilini düzenler, bildirimlerini yönetirsin.',
    points: [
      'Mesaj, arkadaş isteği ve dersler için bildirim alabilirsin; hangi türleri alacağını tek tek seçersin.',
      'Bildirimleri açmasan da bekleyen işlerin menüdeki sayılarda görünür.',
      'Bu rehberi de oradan istediğin zaman yeniden izleyebilirsin.',
    ],
  },
]

export const TUR_ADIM_SAYISI = TUR_ADIMLARI.length

/* ─── ÖLÇÜM DEFTERİ ────────────────────────────────────────────────────────────────

  Web'de tur, hedefi KENDİ arıyordu: querySelector + getBoundingClientRect. RN'de ikisi
  de yok; bir öğenin ekrandaki yerini yalnızca öğenin kendisi (measureInWindow ile)
  bilebilir. O yüzden yön tersine çevrildi: ÇIPALAR KENDİNİ KAYDEDER, tur yalnızca
  deftere bakar.

  Defter modül düzeyinde, context değil: yazan taraf (herhangi bir ekrandaki tek bir
  View) ile okuyan taraf (kökteki tek tur bileşeni) arasında ortak bir ata yok ve
  tek yönlü bir bildirim için provider zinciri kurmak fazla ağır olurdu.

  Ölçüm PENCERE koordinatındadır; tur örtüsü de tüm pencereyi kaplar, yani ikisi aynı
  düzlemde. Ölçü yoksa (ekran açık değil, öğe gizli) adım ortada kart olur.
*/

const olcumler = new Map() // ad -> { x, y, width, height }
const olcerler = new Map() // ad -> Set<yeniden ölçen fonksiyon>
const cipaDinleyicileri = new Set()

function ayniOlcum(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/**
 * Bir çıpanın ölçüsünü deftere yazar. `olcum` null ise kayıt silinir.
 * Doğrudan çağrılabilir, ama olağan kullanım `useTurCipasi` kancasıdır.
 */
export function turCipasiKaydet(ad, olcum) {
  if (!ad) return

  if (!olcum) {
    if (!olcumler.delete(ad)) return
  } else {
    const eski = olcumler.get(ad)
    // Aynı ölçüm yeniden yazılırsa kimse uyandırılmaz: onLayout klavye, yeniden
    // düzenleme ve tazeleme çağrılarıyla sık tetikleniyor; her seferinde turu
    // yeniden render etmek boşuna iş olurdu.
    if (eski && ayniOlcum(eski, olcum)) return
    olcumler.set(ad, { x: olcum.x, y: olcum.y, width: olcum.width, height: olcum.height })
  }

  for (const dinleyici of cipaDinleyicileri) dinleyici()
}

/**
 * Çıpayı defterden düşürür (ekran söküldüğünde).
 *
 * ⚠️ AYNI ADI BİRDEN ÇOK SAHİP KAYDEDEBİLİR ve bu olağan hâl: hamburger düğmesi
 * (`menu` çıpası) kabuk ekranlarının HEPSİNDE ayrı bir örnek. Sekme çubuğu kök
 * yığına düzleştirildiğinde alttaki ekranlar MONTE kalıyor, yani beş örnek aynı
 * anda kayıtlı oluyor. Kayıt koşulsuz silinseydi, sahiplerden HERHANGİ BİRİ
 * sökülünce çıpa tamamen ölür ve hâlâ ekranda duran düğme rehbere görünmez olurdu.
 * Bu yüzden ölçüm ancak SON sahip de çıkınca düşüyor.
 *
 * `olc` verilmezse (doğrudan çağrı) çıpanın tüm sahipleri birden düşürülür.
 */
export function turCipasiSil(ad, olc) {
  const kume = olcerler.get(ad)
  if (kume) {
    if (olc) kume.delete(olc)
    else kume.clear()
    if (kume.size > 0) return // hâlâ monte sahip var: ölçüm DURSUN
    olcerler.delete(ad)
  }
  turCipasiKaydet(ad, null)
}

export function turCipasiOku(ad) {
  return olcumler.get(ad) ?? null
}

/** Defter değiştiğinde haber verir; abonelikten çıkma fonksiyonu döner. */
export function turCipalariniDinle(dinleyici) {
  cipaDinleyicileri.add(dinleyici)
  return () => cipaDinleyicileri.delete(dinleyici)
}

/**
 * Kayıtlı tüm çıpaları yeniden ölçtürür.
 *
 * Ölçüm onLayout'ta alınır ve düzen değişmedikçe doğru kalır — ama kaydırılan bir
 * kabın içindeki çıpa, kaydırmayla birlikte sessizce yer değiştirir (onLayout
 * kaydırmada tetiklenmez). Tur açılırken ve her adımda bir kez tazeleme, web'in
 * scroll dinleyicisinin yerini tutan ucuz sigortadır: sürekli dinlemek yerine
 * ölçünün gerçekten kullanılacağı anda bir kez ölçüyoruz.
 */
export function turCipalariniTazele() {
  for (const kume of olcerler.values()) for (const olc of kume) olc()
}

/**
 * Çıpa kancası. Dönen prop'lar bir View'a yayılır:
 *
 *     <View {...useTurCipasi('dersler')}>…</View>
 *
 * `collapsable: false` ŞART: Android'de çocuğu olmayan/düz bir View, yerel görünüm
 * ağacından kaldırılabiliyor — kaldırılmış bir View'ın measureInWindow'u hiç
 * dönmüyor ve çıpa sessizce kaybolurdu.
 */
export function useTurCipasi(ad) {
  const ref = useRef(null)

  const olc = useCallback(() => {
    const node = ref.current
    if (!node?.measureInWindow) return
    node.measureInWindow((x, y, width, height) => {
      // Ölçüm bir sonraki karede döner; o arada bileşen sökülmüş olabilir.
      if (!ref.current) return
      // 0x0 ölçü, gizli ya da henüz yerleşmemiş öğedir — sıfır boyutlu bir "delik"
      // ekranın ortasında anlamsız bir nokta bırakırdı.
      if (!width || !height) return
      turCipasiKaydet(ad, { x, y, width, height })
    })
  }, [ad])

  useEffect(() => {
    let kume = olcerler.get(ad)
    if (!kume) {
      kume = new Set()
      olcerler.set(ad, kume)
    }
    kume.add(olc)
    // Yalnızca BU sahip düşer; aynı adı taşıyan diğerleri kayıtta kalır.
    return () => turCipasiSil(ad, olc)
  }, [ad, olc])

  return { ref, onLayout: olc, collapsable: false }
}

/* ─── SİNYALLER ───────────────────────────────────────────────────────────────────

  Web'de "rehberi tekrar izle" bağlantısı ile tur bileşeni kardeşti ve aralarında tek
  yönlü, tek kullanımlık bir tetik için CustomEvent kullanılıyordu. RN'de window
  olayları yok; aynı gerekçeyle (context fazla ağır) yerine modül düzeyinde bir
  dinleyici kümesi konuyor.
*/

const yenidenBaslatDinleyicileri = new Set()

export function turuYenidenBaslat() {
  for (const dinleyici of yenidenBaslatDinleyicileri) dinleyici()
}

export function turYenidenBaslatmayiDinle(dinleyici) {
  yenidenBaslatDinleyicileri.add(dinleyici)
  return () => yenidenBaslatDinleyicileri.delete(dinleyici)
}

/*
  "Rehberi geç" susturması.

  Web'de sessionStorage'daydı: sekme kapanınca silinen, oturum ömrüne denk bir işaret.
  Mobilde sessionStorage yok ve AsyncStorage'a yazmak yanlış olurdu — orası KALICI
  tercihlerin yeri, bu ise "şimdi değil" demek. Uygulama süreci boyunca yaşayan bir
  modül değişkeni, web'deki ömrün tam karşılığı: uygulama kapanıp açılınca sıfırlanır.

  Sunucudaki kayıt "tamamlanmadı" olarak kalır — yani tur ileride yeniden önerilebilir.
  "Şimdi değil" ile "bir daha gösterme" farklı niyetlerdir; ikincisi sunucuya yazılır
  (bkz. UrunTuru → suppressed).
*/
let oturumdaGecildi = false

export function turGecildiMi() {
  return oturumdaGecildi
}

export function turGecildiIsaretle(deger = true) {
  oturumdaGecildi = deger
}
