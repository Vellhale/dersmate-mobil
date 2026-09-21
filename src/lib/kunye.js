/**
 * İŞLETMECİ KÜNYESİ — tek doğruluk kaynağı. Web'deki frontend/src/lib/kunye.js'in
 * BİREBİR kopyası (saf JS, platform bağımsız). Web'de değişirse buraya da taşı.
 *
 * ─── NEDEN BU DOSYA VAR ──────────────────────────────────────────────────────
 * "dersmate'i kim işletiyor" sorusunun cevabı ürünün HİÇBİR YERİNDE yazmıyordu.
 * Kullanım koşulları "dersmate ... bir platformdur" diyor ama dersmate'in kim olduğunu
 * söylemiyordu; gizlilik metni verinin neden toplandığını anlatıyor ama KİMİN
 * topladığını söylemiyordu. Üç ayrı yerde somut bir boşluk:
 *
 *   • KVKK m.10 aydınlatma yükümlülüğü — metin veri sorumlusunun kimliğiyle başlar.
 *     MetinSayfasi'ndeki "Taslak metin" uyarısı bu eksiği zaten kendisi sayıyordu.
 *   • 6563 sayılı E-Ticaret Kanunu, tanıtıcı bilgi yükümlülüğü.
 *   • Mağaza kaydı bir yayıncı kimliği ve o kimliği doğrulayan bir gizlilik politikası
 *     adresi istiyor.
 *
 * ⚠️ MOBİLDE BU ARTIK FARAZİ DEĞİL. Web'de not "mobil yayına çıkarken bu duvara
 * çarpılır" diyordu; App Store kaydı açılırken çarpıldı. App Store Connect zorunlu alan
 * olarak gizlilik politikası ADRESİ istiyor ve o adresteki metnin işletmeciyi adıyla
 * söylemesi gerekiyor — uygulama içindeki metin o alanı karşılamıyor.
 *
 * ─── DEĞERLER NEDEN TEK YERDE ───────────────────────────────────────────────
 * Künye birden çok yüzeyde görünüyor (yasal metinlerin künye bloğu, Hakkımızda,
 * Profil altbilgisi). Elle yazılsaydı biri güncellenip diğerleri unutulurdu ve iki
 * farklı kimlik gösteren bir ürün, hiç kimlik göstermeyenden daha kötüdür: hangisinin
 * doğru olduğu belirsizleşir. Aynı gerekçe yasalMetinler.js'te de yazılı.
 *
 * ⚠️ REKLAM DEĞİL, KÜNYE. Buradaki hiçbir değer bir tanıtım yüzeyi beslemiyor.
 * Ürünün içine Corventech'in başka ürünlerini tanıtan bir alan AÇILMADI ve bu bilinçli
 * bir sınır — Gizlilik §1 "Verini reklam için kullanmıyoruz" diyor; aynı sayfada bir
 * tanıtım kutusu, o cümlenin ağırlığını düşürürdü. Künye güven artırır, reklam düşürür.
 */

/** Ürünün adı. Küçük harfle yazılır (logo da öyle) — büyük harfe çevirme. */
export const MARKA = 'dersmate'

/** dersmate'i işleten oluşum. */
export const ISLETMECI = 'Corventech'

/** Bağlantı hedefi. 2026-09-19'da doğrulandı: alan adı çözülüyor (46.45.136.3). */
export const ISLETMECI_ADRESI = 'https://corventech.tr'

/** Bağlantının GÖRÜNEN hâli — protokol yazılmıyor, kullanıcıya gürültü. */
export const ISLETMECI_ALAN_ADI = 'corventech.tr'

/**
 * Künyedeki iletişim adresi.
 *
 * ⚠️ 2026-09-21'de yasalMetinler.js'ten BURAYA TAŞINDI — web'de de öyle. Sebep: adres
 * artık yalnızca bir altbilgi satırı değil, KVKK m.11 başvuru adresi ve künyenin
 * parçası. Sözleşme SÜRÜMÜYLE aynı dosyada durması, birbirinden bağımsız iki şeyi
 * (hangi metni gösterdim / bana nereden ulaşılır) aynı yere bağlıyordu.
 */
export const ILETISIM_EPOSTA = 'iletisim@dersmate.com'

/**
 * Telif satırındaki yıl.
 *
 * ⚠️ ELLE YAZILIYOR, `new Date().getFullYear()` DEĞİL. Sebep: o değer KULLANICININ
 * saatinden geliyor ve saati bozuk bir cihazda telif satırı "© 2019" ya da "© 2031"
 * yazar. Telif beyanı ürünün ne zaman yayımlandığını söyler, ziyaretçinin saatini
 * değil. Bedeli, yılbaşında elle güncellenmesi.
 */
export const TELIF_YILI = 2026

/**
 * ─── TESCİL BİLGİLERİ — DOLDURULMADI, UYDURULMADI ───────────────────────────
 *
 * Üçü de `null` ve öyle kalmaları BİLİNÇLİ: bu değerler kodu okuyarak türetilemez,
 * yalnızca ticaret sicilinden gelir. Bir KVKK metnine gerçek olmayan bir unvan ya da
 * MERSIS numarası yazmak, hiç yazmamaktan DAHA kötüdür — ilki kasıtlı bir yanlış
 * beyandır, ikincisi yalnızca bir eksik.
 *
 * Bu yüzden künye bileşeni (components/Kunye.jsx) buradaki değerleri KOŞULLU basıyor:
 * dolu olan görünür, `null` olan hiç çizilmez. Yani üçü doldurulduğu anda yasal
 * metinlerin künye bloğu kendiliğinden tamamlanır, başka hiçbir yere dokunmak gerekmez.
 *
 * ÜÇÜ DE DOLDURULANA KADAR MetinSayfasi'ndeki "Taslak metin" uyarısı KALDIRILAMAZ:
 * o uyarının saydığı eksiklerden biri tam olarak "veri sorumlusu kimlik bilgileri".
 *
 * Doldururken: unvan ticaret sicilindeki tam hâliyle ("... Yazılım Ltd. Şti."),
 * adres tebligata elverişli açık adres, MERSIS 16 hane.
 *
 * ⚠️ Corventech TESCİLLİ BİR TÜZEL KİŞİ DEĞİLSE (yalnızca marka/alan adıysa) bunlar
 * doldurulmamalı: o durumda veri sorumlusu gerçek kişidir ve şirket adı yazmak kimliği
 * netleştirmek yerine bulandırır. Künyedeki "… tarafından işletilmektedir" ifadesi her
 * iki durumda da doğru olduğu için o satır koşulsuz basılıyor.
 *
 * ⚠️ APP STORE BAĞLANTISI: Apple Developer hesabı BİREYSEL alınırsa mağazada geliştirici
 * adı olarak bir GERÇEK KİŞİ görünür. O durumda burada bir ticari unvan yazması,
 * mağazadaki yayıncı kimliğiyle metindeki veri sorumlusunu çelişkiye düşürür. Hesap
 * tipi neyse künye de onu söylemeli.
 */
export const TICARI_UNVAN = null
export const ADRES = null
export const MERSIS = null

/** Künye bloğunun tescil satırlarını çizip çizmeyeceği. */
export const TESCIL_BILGISI_VAR = Boolean(TICARI_UNVAN || ADRES || MERSIS)
