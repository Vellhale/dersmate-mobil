import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { api, loadSession } from './api'
import { eylemBekliyor } from './dersDurumu'
import { dersSurumuAbone } from './dersSurumu'
import { iliskiSurumuAbone } from './iliskiSurumu'

/*
  BEKLEYEN İŞ SAYAÇLARI — çekmecedeki Arkadaşlar ve Derslerim satırlarının rozet verisi.

  NEDEN GERİ GELDİ (kullanıcı kararı, 2026-09-25): sayaçlar Akış başlığındaydı ve
  3c0f61c birleştirmesinde Akış silinince onlar da gitti. Push bildirimleri geldi ama
  push'u REDDEDEN kullanıcıya 14 günde düşen isteği ve 48 saatte otomatik onaylanan dersi
  haber veren tek şey yine bunlar. Sohbet satırındaki okunmamış rozetiyle aynı dil.

  Tanımlar tek yerden:
  • gelenIstek → myMatches().incoming.length (Arkadaşlar'ın "Gelen" sekmesiyle aynı liste).
  • dersEylem  → mySessions(1, 1).active içinde eylemBekliyor (lib/dersDurumu.js). Derslerim'in
    "Senden aksiyon bekleyenler" grubu da onu kullanıyor: rozet ile liste ayrışamaz.
    mySessions(1, 1): aktif dersler sayfadan bağımsız döner, geçmişten yalnızca tek kayıt.

  NEDEN KANCA DEĞİL DE MODÜL DÜZEYİNDE DEPO: tüketiciler ÇOK. Çekmece bir tane, ama
  hamburger düğmesi her kabuk ekranında ayrı bir örnek ve kök yığın alttakileri kurulu
  tutuyor. Her örnek kendi useAsync'ini koşsaydı ön plana her dönüşte beş myMatches ve beş
  mySessions isteği giderdi. Burada tek çekim, tek sonuç; useSyncExternalStore herkese
  aynı anlık görüntüyü veriyor.

  NE ZAMAN TAZELENİR (çekmece kökte, ekranların dışında: odak olayı YOK, useOnePlanaGelince
  burada çalışmaz):
  • ilk abone bağlanınca (oturum açılınca kabuk kurulur),
  • uygulama öne gelince (AppState 'active'),
  • iliskiSurumu / dersSurumu artınca — push ön planda alındığında sağlayıcı, cihazda işlem
    yapıldığında ekranlar artırıyor,
  • elle: bekleyenIsleriTazele() (ör. çekmece açılırken).

  OTURUM: son abone ayrılınca (çıkışta kabuk sökülür) sayaçlar sıfırlanır ve nesil artar;
  uçuştaki eski hesabın yanıtı yeni hesabın rozetine YAZILMAZ. Her yanıt ayrıca istek
  anındaki hesapla karşılaştırılıyor (api.js'teki __oturumSahibi dersi).

  HATADA eski değer kalır: bilinmeyeni rozet olarak çizmek (ya da 0'a çekip gerçek bir
  işi saklamak) ikisi de yanlış; bir sonraki tazeleme düzeltir.
*/

const BOS = Object.freeze({ gelenIstek: 0, dersEylem: 0, sahip: null })

let durum = BOS
const dinleyiciler = new Set()
let nesil = 0
let baglantiyiKes = null

const oturumSahibi = () => loadSession()?.userId ?? null

function yay(yeni) {
  durum = Object.freeze(yeni)
  for (const dinleyici of [...dinleyiciler]) dinleyici()
}

/*
  Tek uçuş + sonda bir tekrar: uçuş sürerken gelen istek kaybolmaz (uçuş, değişiklikten
  ÖNCEKİ durumu okumuş olabilir) ama istek yağmuru da çekime dönüşmez — kaç istek gelirse
  gelsin uçuştan sonra TEK bir çekim daha.
*/
function tekUcus(is) {
  let ucus = null
  let tekrar = false
  const calistir = () => {
    if (ucus) {
      tekrar = true
      return ucus
    }
    ucus = (async () => {
      try {
        await is()
      } finally {
        ucus = null
        if (tekrar) {
          tekrar = false
          calistir()
        }
      }
    })()
    return ucus
  }
  return calistir
}

async function cek(yukle, alan) {
  const n = nesil
  const sahip = oturumSahibi()
  if (!sahip) return
  try {
    const deger = await yukle()
    // Arada çıkış, hesap değişimi ya da son abonenin ayrılması: yanıt artık kimsenin değil.
    if (n !== nesil || sahip !== oturumSahibi()) return
    // Öteki sayaç başka hesaba aitse taşınmaz: sıfırdan başlanır.
    const taban = durum.sahip === sahip ? durum : BOS
    yay({ ...taban, sahip, [alan]: deger })
  } catch {
    /* eski değer kalır — gerekçe dosyanın başında */
  }
}

const istekleriTazele = tekUcus(() =>
  cek(async () => (await api.myMatches())?.incoming?.length ?? 0, 'gelenIstek'),
)

const dersleriTazele = tekUcus(() =>
  cek(async () => {
    const simdi = Date.now()
    return ((await api.mySessions(1, 1))?.active ?? []).filter((s) => eylemBekliyor(s, simdi)).length
  }, 'dersEylem'),
)

/** İki sayacı birden tazeler; abone yokken (oturum kapalı) hiçbir şey yapmaz. */
export function bekleyenIsleriTazele() {
  if (!baglantiyiKes) return Promise.resolve()
  return Promise.all([istekleriTazele(), dersleriTazele()]).then(() => {})
}

function baglan() {
  nesil += 1
  const vazgecler = [
    iliskiSurumuAbone(() => istekleriTazele()),
    dersSurumuAbone(() => dersleriTazele()),
  ]
  const onPlan = AppState.addEventListener('change', (d) => {
    if (d === 'active') bekleyenIsleriTazele()
  })
  return () => {
    vazgecler.forEach((vazgec) => vazgec())
    onPlan.remove()
    nesil += 1
    durum = BOS
  }
}

function abone(dinleyici) {
  dinleyiciler.add(dinleyici)
  if (!baglantiyiKes) {
    baglantiyiKes = baglan()
    bekleyenIsleriTazele()
  }
  return () => {
    dinleyiciler.delete(dinleyici)
    if (dinleyiciler.size === 0 && baglantiyiKes) {
      const kes = baglantiyiKes
      baglantiyiKes = null
      kes()
    }
  }
}

function anlikGoruntu() {
  return durum
}

/**
 * { gelenIstek, dersEylem } — ikisi de sayı, bilinmiyorsa 0 (rozet çizilmez).
 * Başka hesabın kalıntısı asla dönmez: anlık görüntü oturumdaki hesaba ait değilse sıfır.
 */
export function useBekleyenIsler() {
  const anlik = useSyncExternalStore(abone, anlikGoruntu, anlikGoruntu)
  return anlik.sahip && anlik.sahip === oturumSahibi() ? anlik : BOS
}
