/*
  ══════════════════════════════════════════════════════════════════════════════
  FORUM SÖZLÜĞÜ VE YARDIMCILARI — Topluluk ekranı (app/index.jsx) ile akış kartı
  (src/components/GonderiKarti.jsx) arasında ORTAK olanlar.

  Önceden hepsi index.jsx'in içindeydi. Kart ayrı dosyaya çıkınca iki dosya aynı etiket
  sözlüğüne ve aynı zaman biçimine muhtaç oldu; kopyalamak, bir etiketin adı ya da
  rengi bir yerde değişip ötekinde değişmeden kalması demekti.

  BURADA OLMAYANLAR (index.jsx'te kalır, çünkü yalnızca o ekran kullanıyor): sıralama,
  tarih ve şikayet sebebi enum'ları, sunucuyla aynı sayıdaki alan sınırları.
  ══════════════════════════════════════════════════════════════════════════════
*/

/* ─── ETİKETLER ────────────────────────────────────────────────────────────────

   Arayüz Türkçe anahtarlarla çalışıyor ('stres'), sunucu enum adlarıyla ('ExamStress',
   Forum.cs → ForumTag). Çeviri TEK YERDE, burada.                                    */

export const ETIKET_ENUM = {
  stres: 'ExamStress',
  soru: 'Question',
  kaynak: 'Resource',
  program: 'StudyPlan',
  motivasyon: 'Motivation',
  tercih: 'Preference',
}

/** Ters yön: sunucudan gelen etiketi arayüz anahtarına çevirir. */
export const ETIKET_ANAHTARI = Object.fromEntries(
  Object.entries(ETIKET_ENUM).map(([anahtar, enumAdi]) => [enumAdi, anahtar]),
)

/**
 * Sunucu etiketinin arayüz anahtarı. Tanınmayan bir değer (sunucuya yeni etiket eklendi,
 * istemci henüz bilmiyor) OLDUĞU GİBİ döner: kart düşmez, ham adı gösterir.
 */
export function etiketAnahtari(tag) {
  return ETIKET_ANAHTARI[tag] ?? tag
}

/* 'hepsi' bir etiket değil, filtrenin "tümü" seçeneği; yeni gönderi formu onu süzüyor. */
export const ETIKETLER = [
  { key: 'hepsi', label: 'Tümü' },
  { key: 'stres', label: 'Sınav Stresi' },
  { key: 'soru', label: 'Soru Sor' },
  { key: 'kaynak', label: 'Kaynak' },
  { key: 'program', label: 'Ders Programı' },
  { key: 'motivasyon', label: 'Motivasyon' },
  { key: 'tercih', label: 'Tercih' },
]

export const ETIKET_ADI = Object.fromEntries(ETIKETLER.map((e) => [e.key, e.label]))

/*
  ETİKET RENKLERİ — A DÜZENİ (2026-09-26).

  Kural CLAUDE.md'de ("Renk rolleri"): anlamı olmayan etiket ve kategori `bg-brand-50
  text-brand-800` ile `bg-slate-100 text-slate-700` SIRAYLA. Forum etiketi bir kategori;
  "sınav stresi" bir uyarı, "motivasyon" bir tehlike değil.

  ⚠️ ESKİDEN ALTI AYRI RENKTİ ve dördü A düzenini çiğniyordu: kaynak yeşil, program
  mor, tercih gök mavisi — üçü de paletten çıkarılmış renkler — stres amber (amber
  YALNIZCA bekleyen iş ve dikkat), motivasyon rose (rose YALNIZCA tehlike ve sayaç).
  Uygulamada yeşili, moru ve gök mavisini sınıf olarak kullanan TEK yer burasıydı.

  Bedeli bilinçli: altı etiket iki tona indi, yani etiketler artık RENKTEN değil ADINDAN
  ayırt ediliyor. Pilin içinde ad zaten yazılı; renk yalnızca "burası bir etiket" diyor.

  Sıra ETIKETLER'in sırası (stres, soru, kaynak, program, motivasyon, tercih) ve
  slate'ten başlıyor, böylece marka mavisi SORU'ya düşüyor — eski "soru = marka rengi"
  kararı korunuyor: bu üründe soru sormak ana eylem.

  Kontrast: brand-800 / brand-50 7.16:1, slate-700 / slate-100 9.45:1.

  ⚠️ WEB RENKLİ KALIYOR (web frontend/src/pages/Topluluk.jsx). Bir sonraki web portunda
  yeşil, mor ve gök mavisi sınıfları buraya GERİ TAŞINMAZ; bilinçli sapma.

  Üç renk bu dosyada (ve theme.js ile Avatar.jsx yorumlarında) BİLEREK Türkçe adıyla
  yazılı: Tailwind adlarıyla app/ ve src/ üzerinde yapılan grep, sınıf kullanımını
  yakalayan bekçi ve BOŞ çıkmalı. Yorumda geçen bir ad o bekçiyi kör ederdi.
*/
const NOTR = { kutu: 'bg-slate-100', yazi: 'text-slate-700' }
const MARKA = { kutu: 'bg-brand-50', yazi: 'text-brand-800' }

export const ETIKET_TONU = {
  stres: NOTR,
  soru: MARKA,
  kaynak: NOTR,
  program: MARKA,
  motivasyon: NOTR,
  tercih: MARKA,
}

/* Tanınmayan etiket nötr çizilir. */
export const VARSAYILAN_ETIKET_TONU = NOTR

/* ─── ZAMAN ────────────────────────────────────────────────────────────────── */

/**
 * Sunucudan gelen UTC damgasını milisaniyeye çevirir.
 *
 * ⚠️ ZAMAN DİLİMİ EKİ YOKSA 'Z' EKLENİYOR. .NET, DateTime'ı Kind=Utc iken sonunda 'Z'
 * ile yazıyor; Kind=Unspecified iken YAZMIYOR ve o durumda metin YEREL saat sanılır.
 * Türkiye'de bu üç saatlik bir kayma demek: üç saat önce yazılmış bir gönderi "şimdi"
 * görünür, bir dakika önce yazılan gelecekte kalır. Sütun timestamptz olduğu için EF
 * bugün Utc döndürüyor — ama tek bir DTO'nun Kind'i değiştiğinde hata SESSİZ olur.
 */
export function damgayaCevir(metin) {
  if (!metin) return null
  const tamDamga = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(metin) ? metin : `${metin}Z`
  const ms = Date.parse(tamDamga)
  return Number.isNaN(ms) ? null : ms
}

/** Damganın kaç dakika önce olduğunu verir; okunamayan damga 0 sayılıyor ("şimdi"). */
export function yasDakika(metin) {
  const ms = damgayaCevir(metin)
  if (ms === null) return 0
  // Negatife düşebilir: sunucu saati istemciden birkaç saniye ileriyse. "-1 dk" yerine
  // "şimdi" göstermek doğru, çünkü fark saat farkı değil senkron gürültüsü.
  return Math.max(0, Math.round((Date.now() - ms) / 60000))
}

/** "22 dk" / "3 sa" / "2 g". Forumda mutlak tarih işe yaramıyor: okuyanın sorduğu şey
    "ne zaman yazıldı" değil, "hâlâ taze mi". */
export function zamanKisalt(dakika) {
  // "0 dk" sayı olarak doğru ama okunuşu bozuktu — sıfır birimli bir süre, süre değil.
  if (dakika < 1) return 'şimdi'
  if (dakika < 60) return `${dakika} dk`
  const saat = Math.floor(dakika / 60)
  if (saat < 24) return `${saat} sa`
  return `${Math.floor(saat / 24)} g`
}

export function goreliZaman(damga) {
  return zamanKisalt(yasDakika(damga))
}

/**
 * Ekran okuyucu için AÇIK yazım: "22 dakika önce", "3 saat önce", "2 gün önce".
 * Görünen kısaltma ("3 sa") sesli okunduğunda birim kayboluyordu.
 */
export function goreliZamanUzun(damga) {
  const dakika = yasDakika(damga)
  if (dakika < 1) return 'şimdi'
  if (dakika < 60) return `${dakika} dakika önce`
  const saat = Math.floor(dakika / 60)
  if (saat < 24) return `${saat} saat önce`
  return `${Math.floor(saat / 24)} gün önce`
}

/* ─── OY ───────────────────────────────────────────────────────────────────── */

/**
 * OY UYGULAMA — sunucudaki üç durumun istemci aynası (VoteForumContentHandler).
 *
 *   oy yok      → oy ekle
 *   aynı yön    → GERİ AL (sunucu satırı siler, sayaç düşer)
 *   ters yön    → çevir (bir taraftan düş, diğerine ekle)
 *
 * Tek fonksiyon çünkü üç durumun sayaç etkisi birbirine bağlı. Yine de bu yalnızca
 * TAHMİN: yanıt gelince sunucunun sayaçları yazılıyor.
 */
export function oyUygula(icerik, yon) {
  const onceki = icerik.myVote ?? 0
  const yeni = onceki === yon ? 0 : yon

  let arti = icerik.upvoteCount
  let eksi = icerik.downvoteCount

  if (onceki === 1) arti -= 1
  else if (onceki === -1) eksi -= 1

  if (yeni === 1) arti += 1
  else if (yeni === -1) eksi += 1

  return { ...icerik, upvoteCount: arti, downvoteCount: eksi, myVote: yeni }
}
