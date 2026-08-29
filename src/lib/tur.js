import { useCallback, useEffect, useRef } from 'react'

/**
 * Ürün turu — adımlar, ölçüm defteri ve tek kullanımlık sinyaller.
 *
 * Web karşılığı: frontend/src/lib/tour.js. METİNLER birebir taşındı, MEKANİZMA
 * taşınmadı: web'de adımlar bir CSS seçicisiyle (`selector`) DOM'da öğe arıyordu.
 * RN'de document yok — çıpayı öğenin KENDİSİ bildirir (bkz. ölçüm defteri).
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
 * `cipa`: adımın ışık tutacağı çıpanın ADI (web'deki `selector`ın karşılığı).
 * Çıpa kayıtlı değilse adım ORTADA kart olarak gösterilir (bkz. UrunTuru) — web'deki
 * yedek davranışın aynısı ve mobilde KURAL, istisna değil: tur sekme değiştirmez,
 * dolayısıyla o an ekranda olmayan her çıpa yoktur. Adım metinleri bu yüzden
 * ışıklandırmaya değil KENDİNE yeter; hangi sekmeden gidileceğini cümle söyler.
 *
 * Çıpa adları başka dosyalardaki ekranlarla SÖZLEŞMEDİR; değişirlerse iki taraf
 * birden güncellenir (web'de `data-tour="rank"` adının, rozetin içeriği değişmesine
 * rağmen bilerek korunmasıyla aynı gerekçe: ad değişince kimse fark etmeden kırılır).
 */
export const TUR_ADIMLARI = [
  {
    id: 'free',
    cipa: 'rutbe',
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
    cipa: 'kesfet',
    title: 'Keşfet — ders bul',
    body: 'Almak istediğin konuyu anlatabilen öğrencileri Keşfet sekmesinde bulursun.',
    points: [
      'Konu, ders ya da eğitmen adıyla ara.',
      'Filtreyle sınavı, dersi ve eğitmen puanını daralt.',
      '“Karşılıklı takas” etiketi, o kişinin de senden bir konu aradığını gösterir.',
    ],
  },
  {
    /*
      Web'de bu adımın adı "Ders Portföyü" ve çıpası sol raydaki menü öğesiydi.
      Mobilde portföye giriş, tab çubuğunun ortasındaki ekleme sekmesi — kullanıcının
      göreceği ad "Oluştur" olduğu için başlık da o adı kullanıyor. Rehberin işaret
      ettiği yerin adı, ekranda yazan adla aynı olmalı.
    */
    id: 'portfolio',
    cipa: 'portfoy',
    title: 'Oluştur — ne anlatabilirsin',
    body: 'Anlatabildiğin konuları ekle; Keşfet’te başkalarına böyle görünürsün.',
    points: [
      'Portföyün boşken kimse senden ders isteyemez.',
      'Her konu için kendi seviyeni işaretlersin.',
      'Puan kazanmanın tek yolu ders anlatmak — başlangıcı burası.',
    ],
  },
  {
    id: 'matches',
    cipa: 'eslesmeler',
    title: 'Eşleşmeler — istek gönder ve al',
    body: 'Gönderdiğin ve sana gelen ders istekleri, Akış başlığındaki kişiler simgesinde toplanır.',
    points: [
      'Gelen bir isteği kabul ya da reddedersin.',
      'Kabul edilen istekte sohbet kendiliğinden açılır.',
      'Eşleşmeyi istediğin an sonlandırabilirsin.',
    ],
  },
  {
    id: 'chat',
    cipa: 'sohbet',
    title: 'Mesajlar — saati ve linki kararlaştır',
    body: 'Ders saatini ve görüşme linkini karşı tarafla Mesajlar sekmesinde konuşursun.',
    points: [
      'Zoom, Google Meet ya da Discord — dersi biz barındırmıyoruz.',
      'Linki sohbete yapıştırman yeterli.',
      'Anlaştıktan sonra dersi Derslerim’den rezerve edersiniz.',
    ],
  },
  {
    id: 'sessions',
    cipa: 'dersler',
    title: 'Derslerim — kanıt ve onay',
    body: 'Ders bittikten sonra puanın yazılması için tek bir adım kalır: onay.',
    points: [
      'Anlatan taraf dersin ekran görüntüsünü yükler.',
      'Alan taraf onaylar; puan tam o anda yazılır.',
      'Bir sorun varsa itiraz edersin, kararı hakem verir.',
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
const olcerler = new Map() // ad -> yeniden ölçen fonksiyon
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

/** Çıpayı defterden düşürür (ekran söküldüğünde). */
export function turCipasiSil(ad) {
  olcerler.delete(ad)
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
  for (const olc of olcerler.values()) olc()
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
    olcerler.set(ad, olc)
    return () => turCipasiSil(ad)
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
