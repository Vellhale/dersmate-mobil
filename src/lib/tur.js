import { useCallback, useEffect, useRef } from 'react'

/**
 * Ürün turu — adımlar, ölçüm defteri ve tek kullanımlık sinyaller.
 *
 * Web karşılığı: frontend/src/lib/tour.js. MEKANİZMA taşınmadı: web'de adımlar bir CSS
 * seçicisiyle (`selector`) DOM'da öğe arıyordu. RN'de document yok — çıpayı öğenin
 * KENDİSİ bildirir (bkz. ölçüm defteri).
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
 * EKONOMİ: ders almak ücretsiz, bloke edilen bir şey yok, puan yalnızca ANLATANA
 * yazılır. Yanlış beklenti kuran bir rehber, hiç rehber olmamasından kötüdür.
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
    id: 'menu',
    // Menünün KENDİSİ; satırları ortadaki kartlarda yer çipiyle gösteriliyor (yukarıda).
    cipa: 'menu',
    cipaEkrani: KABUK_EKRANLARI,
    title: 'Menü — her şey sol üstte',
    body: 'Uygulamanın bütün bölümlerine sol üstteki menüden geçersin.',
    points: [
      'Keşfet, Ders Portföyü, Arkadaşlar, Sohbet, Derslerim ve Topluluk burada.',
      'Bir satırın yanında sayı görürsen orada seni bekleyen bir iş var.',
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
