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
  düzeltme mobilde doğdu, web'e taşınmalı.
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
