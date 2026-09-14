/*
  İLİŞKİ HARİTASI — "bu kişiyle aramda ne var?" sorusunun tek cevabı.

  NEDEN VAR: kişi gösteren iki yüzey (başkasının profili, Keşfet'in Üniversite ve Arkadaş
  Ekle kartları) ilişkiyi hiç bilmiyordu. Zaten arkadaş olunan kişiye, bekleyen isteği olan
  kişiye ve sana istek atmış kişiye aynı "Arkadaş ekle" gösteriliyordu. Sunucuda
  (MatchRequests.cs) yalnızca AYNI YÖNDE bekleyen istek reddediliyor (409); arkadaşa ya da
  sana istek atmış kişiye gönderilen istek KABUL EDİLİYOR ve gereksiz bir bekleyen istek
  doğuruyor. Aynı yöndeki ikinci denemede ise kullanıcı düğmeye basıp hata metniyle
  karşılaşıyordu.

  Yeni uç YOK: `api.myMatches()` (Arkadaşlar ekranının kullandığı) üç listeyi zaten
  döndürüyor. Sunucu değişmiyor, api.js yüzeyi web ile aynı kalıyor.

  ⚠️ Web'de de aynı boşluk var (Profile.jsx ve Discover.jsx myMatches okumuyor); bu
  düzeltme mobilde doğdu, web'e taşınmalı. `ogrenciKonusu` ve `konuHaritasi` (Akış ve
  YKS kartlarının konu durumu) da web'de yok, onlar da taşınacaklar listesinde.
  `ogrenciKonusu`nun iki tüketicisi daha web'de eksik: Matches.jsx "Ders rezerve et"i hâlâ
  `requestedTopicName`e bakarak çiziyor (anlatanın ben olduğum takassız arkadaşlıkta da
  çıkıyor ve boş rezervasyon sayfasına götürüyor), Sessions.jsx de `?rezerve=` ön seçimini
  bilmiyor (mobil: app/eslesmeler.jsx, app/dersler.jsx).
*/

/** Kimlikler iki kaynaktan geliyor (adres, liste yanıtı); harf büyüklüğü farkı eşleşmeyi ıskalatmasın. */
export const kimlikAnahtari = (userId) => String(userId ?? '').toLowerCase()

/**
 * İlişki durumları. Öncelik sırası da bu: bir kişiyle hem aktif arkadaşlık hem bekleyen
 * istek olabilir (konulu ders isteği arkadaşlık sürerken de gönderilebiliyor) — ekranın
 * söylemesi gereken en güçlü ilişki.
 */
export const ILISKI = {
  arkadas: 'arkadas',
  gelen: 'gelen',
  giden: 'giden',
}

const ONCELIK = { arkadas: 3, gelen: 2, giden: 1 }

/**
 * `api.myMatches()` yanıtından userId → { durum, matchId, conversationId } haritası.
 * @param eslesmeler `{ incoming, outgoing, active }` ya da null
 */
export function iliskiHaritasi(eslesmeler) {
  const harita = new Map()
  if (!eslesmeler) return harita

  const ekle = (liste, durum) => {
    for (const m of liste ?? []) {
      const anahtar = kimlikAnahtari(m.otherUserId)
      const mevcut = harita.get(anahtar)
      if (!mevcut || ONCELIK[durum] > ONCELIK[mevcut.durum]) {
        harita.set(anahtar, { durum, matchId: m.matchId, conversationId: m.conversationId ?? null })
      }
    }
  }

  ekle(eslesmeler.active, ILISKI.arkadas)
  ekle(eslesmeler.incoming, ILISKI.gelen)
  ekle(eslesmeler.outgoing, ILISKI.giden)
  return harita
}

/**
 * Eşleşmede oturum sahibinin ÖĞRENCİ olduğu konu — karşı tarafın bana anlattığı.
 * İsteği ben başlattıysam istediğim konu, karşı taraf başlattıysa bana teklif ettiği konu.
 * Konusuz (üniversite ağı) eşleşmede ya da teklifsiz gelen istekte null: o eşleşmede
 * öğrenci olduğum bir konu yok.
 */
export function ogrenciKonusu(m) {
  const topicId = m.iAmInitiator ? m.requestedTopicId : m.offeredTopicId
  if (!topicId) return null
  return { topicId, topicName: m.iAmInitiator ? m.requestedTopicName : m.offeredTopicName }
}

/** Konu haritasının anahtarı: aynı kişiyle her konu ayrı bir istek. Haritayı okuyan da iyimser
    işareti yazan da bunu kullanır; iki yerde elle kurulan dize ayrışıp ıskalardı. */
export const konuAnahtari = (userId, topicId) => `${kimlikAnahtari(userId)}|${topicId}`

/**
 * KONU HARİTASI — "bu kişiden şu konuyu almak için aramızda ne var?"
 *
 * NEDEN KİŞİ HARİTASI YETMİYOR: ders istekleri KONU başına. Sunucu (MatchRequests.cs)
 * yalnızca aynı kişiye AYNI KONUDA bekleyen isteği reddediyor; Türev'de arkadaş olunan
 * kişiye Limit için istek atmak geçerli. Kartı kişi başına pasifleştirmek bu ikinci isteği
 * engellerdi, hiç bakmamak da aynı konuya ikinci basışı 409'a gönderiyordu.
 *
 * Anahtar `userId|topicId`, değer `{ durum: 'aktif' | 'bekliyor', matchId }`. Aktif önce
 * yazılır ve bekleyen onu ezmez: arkadaşlığı süren konuda "istek bekliyor" demek rezervasyon
 * yolunu gizlerdi. Gelen istekler haritada YOK: onlarda öğrenci olduğum konu karşı tarafın
 * teklifi, bana gönderilecek bir isteği kapatmıyor.
 *
 * @param eslesmeler `api.myMatches()` yanıtı (`{ incoming, outgoing, active }`) ya da null
 */
export function konuHaritasi(eslesmeler) {
  const harita = new Map()
  if (!eslesmeler) return harita

  for (const m of eslesmeler.active ?? []) {
    const konu = ogrenciKonusu(m)
    if (konu) harita.set(konuAnahtari(m.otherUserId, konu.topicId), { durum: 'aktif', matchId: m.matchId })
  }
  for (const m of eslesmeler.outgoing ?? []) {
    if (!m.requestedTopicId) continue
    const anahtar = konuAnahtari(m.otherUserId, m.requestedTopicId)
    if (!harita.has(anahtar)) harita.set(anahtar, { durum: 'bekliyor', matchId: m.matchId })
  }
  return harita
}
