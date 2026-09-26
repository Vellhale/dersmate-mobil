import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'

/*
  GEÇMİŞ SAYFALARI — sunucunun ofsetle sayfaladığı ders geçmişini (GET /sessions → past)
  sayfa sayfa BİRİKTİREN kanca. Derslerim'de iki örneği var:

    Rezerve geçmişi  süzgeçsiz geçmiş. İlk sayfası ekranın açılış isteğinden (aktif listeyle
                     AYNI yanıt) dışarıdan verilir: `disIlkSayfa`. Ek istek yok.
    Geçmiş dersler   yalnızca Completed (`durum` → sunucuda ?pastStatus=). İlk sayfayı kanca
                     kendisi çeker, sekme İLK açıldığında (`etkin`); açılmayan sekmenin
                     maliyeti yok.

  Sayfalar FlatList onEndReached ile eklenir (mobil iş kuralı: 5'erli sayfa, birikir).
  Aşağıdaki üç kural 2026-09-26'ya kadar dersler.jsx'in içindeydi; ikinci örnek gelince
  buraya çıktı, iki sekme aynı yarışları aynı biçimde karşılasın diye.

  1) BİRİKİNTİ YALNIZCA TOPLAM DEĞİŞİNCE SIFIRLANIR. Geçmişe ders yalnızca EKLENİR (onay,
     iptal, süre dolumu aktiften geçmişe taşır; geçmişten çıkış yok), yani toplam aynıysa
     ofsetler de aynı: biriken sayfalar ve uçuştaki "daha getir" hâlâ geçerli. Toplam
     değiştiyse sayfa sınırları kaydı ve birikinti atılır. Her tazelemede sıfırlansaydı
     push'la gelen her arka plan tazelemesi kullanıcının yüklediği sayfaları silerdi.

  2) NESİL SAYACI — tazeleme ile sayfalama yarışıyor. Sıfırlama sırasında uçuşta bir
     "daha getir" varsa, dönen ESKİ ofsetli sayfa yeni listenin üstüne eklenirdi: arada
     kalan kayıtlar hiç görünmezdi. Eski nesle ait yanıt atılır.

  3) TEKİLLEŞTİRME TÜM birikinti üzerinden: sayfalar yüklenirken başa yeni kayıt düşerse
     sonraki sayfa bir öncekinin son öğesini TEKRAR getirir (saf ofset). Aynı kimlik
     FlatList'e iki kez girip çift kart ve çift anahtar üretirdi.

  ⚠️ BOŞ SAYFADA LİSTE TAKILIR — kendiliğinden devam bu yüzden var. RN VirtualizedList
  onEndReached'i içerik uzunluğu başına YALNIZCA BİR KEZ çağırıyor
  (VirtualizedList.js → _sentEndForContentLength). Görünür kart eklemeyen bir sayfa içerik
  uzunluğunu değiştirmez ve sonraki sayfa HİÇ istenmez; liste ekrandan kısaysa kullanıcı
  eşikten uzaklaşıp dönemediği için kalıcı olarak. İki durumda olur:
    • süzgeçli örnek ESKİ SUNUCUYA çarparsa (parametre sessizce yok sayılır, sayfalar
      iptal / süresi dolmuş derslerle gelir ve istemci süzer),
    • sayfa, tekilleştirmede tamamen elenirse (arada beş yeni kayıt).
  Kart eklemeyen her sayfadan sonra bir sonraki kendiliğinden istenir, art arda en çok
  BOS_SAYFA_SINIRI kez; sonra `durdu` olur ve çağıran bir düğme gösterir (istek yağmuru
  olmasın: her yanıt aktif listeyi de yeniden taşıyor).

  SÜZGEÇ İSTEMCİDE DE UYGULANIR (`durum`): sunucu ?pastStatus='ı tanımıyorsa süzülmemiş
  liste döner. Sayfada durumu tutmayan tek kayıt görülürse `suzgecTutmadi` olur ve
  `toplam` null döner: o toplam süzülmemiş kümeye ait, göstermek yanlış sayı yazmak olurdu.
  Sunucu önce dağıtılır; bu yalnızca geçiş anının güvencesi.
*/

/** Kart eklemeyen art arda en çok kaç sayfa kendiliğinden istenir. */
export const BOS_SAYFA_SINIRI = 4

const BOS_IC = Object.freeze({ sayfa: null, yukleniyor: false, hata: null })

// Boş birikintinin dizisi TEK örnek: sıfırlanmış durum her render'da yeniden kuruluyor ve
// yeni [] her seferinde items'ı (dolayısıyla FlatList verisini) yeniden hesaplatırdı.
const BOS_DIZI = Object.freeze([])

const bosBirikinti = (anahtar) => ({
  anahtar,
  ek: BOS_DIZI,
  sayfa: 1,
  // Son "daha getir" kaç görünür kart ekledi (null: bu nesilde henüz sayfa eklenmedi).
  sonEklenen: null,
  bosSeri: 0,
  yukleniyor: false,
  hata: null,
})

/**
 * @param durum            null (süzgeçsiz) ya da geçmiş durumu ('Completed'…)
 * @param sayfaBoyutu      sunucu sayfa boyu; dışarıdan gelen ilk sayfa da bu boyla çekilmiş olmalı
 * @param disIlkSayfa      verilirse ilk sayfa dışarıdan (null = henüz gelmedi); VERİLMEZSE
 *                         (undefined) kanca ilk sayfayı kendisi çeker
 * @param etkin            (iç kip) ilk sayfanın çekilmesine izin — sekme ilk açıldığında true
 * @param tazelemeAnahtari (iç kip) değişince 1. sayfa yeniden çekilir; toplam aynı çıkarsa
 *                         birikinti korunur (kural 1)
 */
export function useGecmisSayfalari({
  durum = null,
  sayfaBoyutu = 5,
  disIlkSayfa,
  etkin = true,
  tazelemeAnahtari = null,
}) {
  const disaridan = disIlkSayfa !== undefined
  const uygun = useCallback((s) => !durum || s.status === durum, [durum])

  /* ── İÇ KİP: ilk sayfa ─────────────────────────────────────────────────── */
  const [ic, setIc] = useState(BOS_IC)
  const icNesil = useRef(0)
  // İlk sayfa hangi anahtarla çekildi: anahtar ondan sonra değişirse sayfa bayat olabilir.
  const icAnahtar = useRef(undefined)
  const anahtarRef = useRef(tazelemeAnahtari)
  anahtarRef.current = tazelemeAnahtari

  const icYukle = useCallback(async () => {
    const n = ++icNesil.current
    icAnahtar.current = anahtarRef.current
    setIc((d) => ({ ...d, yukleniyor: true, hata: null }))
    try {
      const data = await api.mySessions(1, sayfaBoyutu, durum)
      if (n !== icNesil.current) return
      setIc({ sayfa: data?.past ?? { items: [], totalCount: 0 }, yukleniyor: false, hata: null })
    } catch (err) {
      if (n !== icNesil.current) return
      // Elde sayfa varken düşen tazeleme listeyi silmez, hata kutusu da açmaz: gösterilen
      // liste hâlâ doğru (geçmiş yalnızca büyür), bir sonraki tetik yeniden dener.
      setIc((d) => ({ ...d, yukleniyor: false, hata: d.sayfa ? null : err }))
    }
  }, [durum, sayfaBoyutu])

  useEffect(() => {
    if (disaridan || !etkin) return
    if (ic.sayfa == null && !ic.yukleniyor && !ic.hata) icYukle()
  }, [disaridan, etkin, ic, icYukle])

  useEffect(() => {
    if (disaridan) return
    // Hiç çekilmediyse ilk açılış zaten taze çekecek.
    if (icAnahtar.current === undefined) return
    const onceki = icAnahtar.current
    // İlk çekim anahtar gelmeden (ders listesi yüklenirken) başladıysa ikisi aynı sunucu
    // durumunu okudu: ikinci istek atılmaz, yalnızca anahtar not edilir.
    if (onceki == null) {
      icAnahtar.current = tazelemeAnahtari
      return
    }
    if (tazelemeAnahtari != null && tazelemeAnahtari !== onceki) icYukle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tazelemeAnahtari])

  /* ── BİRİKİNTİ ─────────────────────────────────────────────────────────── */
  const ilkSayfa = disaridan ? disIlkSayfa : ic.sayfa
  const toplamHam = ilkSayfa?.totalCount ?? 0

  /*
    NESİL = TOPLAM (kural 1 ve 2 birlikte). Birikinti durumu hangi toplama ait olduğunu
    (`anahtar`) taşıyor; ilk sayfanın toplamı değişince eski durum RENDER SIRASINDA yok
    sayılıyor, sıfırlama efekti beklenmiyor. Efektle sıfırlansaydı arada bir render eski
    birikintiyi yeni ilk sayfayla birlikte gösterir ve kendiliğinden devam o eski sayfa
    numarasıyla istek atabilirdi. Uçuştaki istek de dönüşte anahtarını karşılaştırıyor.
  */
  const toplamAnahtari = ilkSayfa ? ilkSayfa.totalCount : null
  const [durumHam, setDurumHam] = useState(() => bosBirikinti(null))
  const b = durumHam.anahtar === toplamAnahtari ? durumHam : bosBirikinti(toplamAnahtari)

  const anahtarSimdi = useRef(toplamAnahtari)
  anahtarSimdi.current = toplamAnahtari
  // Uçuştaki isteğin anahtarı (undefined: uçuş yok). Kilit yalnızca AYNI nesli durdurur:
  // sıfırlamadan sonra eski neslin uçuşu yeni listenin ilk "daha getir"ini bekletmez.
  const kilit = useRef(undefined)
  // Kaç sayfa yüklendi: ref, çünkü kilit açıldığı anla yeniden çizim arasında gelen bir
  // onEndReached eski kapanıştaki sayıyla AYNI sayfayı yeniden isterdi.
  const sayfaRef = useRef({ anahtar: null, sayfa: 1 })

  function guncelle(anahtar, degisim) {
    setDurumHam((onceki) => {
      const temel = onceki.anahtar === anahtar ? onceki : bosBirikinti(anahtar)
      return { ...temel, ...degisim(temel) }
    })
  }

  const items = useMemo(() => {
    const gorulen = new Set()
    const liste = []
    for (const s of [...(ilkSayfa?.items ?? []), ...b.ek]) {
      if (!uygun(s) || gorulen.has(s.sessionId)) continue
      gorulen.add(s.sessionId)
      liste.push(s)
    }
    return liste
  }, [ilkSayfa, b.ek, uygun])

  const suzgecTutmadi = useMemo(
    () => !!durum && [...(ilkSayfa?.items ?? []), ...b.ek].some((s) => !uygun(s)),
    [durum, ilkSayfa, b.ek, uygun],
  )

  // Ofset kesin: toplam değişmediği sürece n sayfa ilk n×boy kaydı kapsar. Görünür kart
  // sayısına bakılamaz: istemci süzgecinde o sayı toplamdan hep küçük kalır.
  const dahaVar = ilkSayfa != null && b.sayfa * sayfaBoyutu < toplamHam

  async function dahaGetir() {
    const anahtar = toplamAnahtari
    // Eski render'ın kapanışı (anahtar çoktan değişti) ya da aynı neslin uçuşu sürüyor.
    if (anahtar == null || anahtar !== anahtarSimdi.current || kilit.current === anahtar) return
    const yuklu = sayfaRef.current.anahtar === anahtar ? sayfaRef.current.sayfa : 1
    if (yuklu * sayfaBoyutu >= toplamHam) return
    const hedef = yuklu + 1
    const gorulen = new Set(items.map((s) => s.sessionId))
    kilit.current = anahtar
    guncelle(anahtar, () => ({ yukleniyor: true, hata: null }))
    try {
      const data = await api.mySessions(hedef, sayfaBoyutu, durum)
      // Liste bu sırada sıfırlandıysa bu sayfa artık başka bir listeye ait: at.
      if (anahtar !== anahtarSimdi.current) return
      const yeni = data?.past?.items ?? []
      const eklenen = yeni.filter((s) => uygun(s) && !gorulen.has(s.sessionId)).length
      sayfaRef.current = { anahtar, sayfa: hedef }
      guncelle(anahtar, (t) => ({
        ek: [...t.ek, ...yeni],
        sayfa: hedef,
        sonEklenen: eklenen,
        bosSeri: eklenen === 0 ? t.bosSeri + 1 : 0,
      }))
    } catch (err) {
      if (anahtar === anahtarSimdi.current) guncelle(anahtar, () => ({ hata: err }))
    } finally {
      if (kilit.current === anahtar) kilit.current = undefined
      /* Eski neslin bayrağı dokunulmadan bırakılır: yeni nesil zaten boş durumla (yukleniyor
         false) başladı. Eskiden burada indirilmeyen bayrak liste dibindeki spinner'ı çöpe
         gitmiş bir sayfa için süresiz döndürüyordu. */
      if (anahtar === anahtarSimdi.current) guncelle(anahtar, () => ({ yukleniyor: false }))
    }
  }

  /*
    KENDİLİĞİNDEN DEVAM (bkz. "BOŞ SAYFADA LİSTE TAKILIR"). İki tetik: son sayfa kart
    eklemedi, ya da daha hiç sayfa eklenmedi ve ilk sayfadan görünür kart çıkmadı (eski
    sunucuda ilk beş dersin hepsi iptalse boş durum yanlışlıkla "henüz yok" derdi).
    Hata varken durur: hata kutusunun "Tekrar dene"si kullanıcının elinde.
  */
  const otomatik =
    dahaVar &&
    !b.yukleniyor &&
    !b.hata &&
    b.bosSeri < BOS_SAYFA_SINIRI &&
    (b.sonEklenen === 0 || (b.sonEklenen === null && items.length === 0))
  useEffect(() => {
    if (otomatik) dahaGetir()
    // dahaGetir bu render'ın kapanışı: anahtar ve sayfa taze.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otomatik, b.sayfa, toplamAnahtari])

  /*
    LİSTE SONU TETİĞİ (onEndReached) SINIRA UYAR. Sınıra gelinince liste içeriği "yükleniyor"
    ile düğme arasında gidip geliyor ve her değişim içerik uzunluğunu değiştirdiği için
    onEndReached yeniden tetikleniyordu: sınır düz dahaGetir'le delinip kısa listede bütün
    sayfalar art arda isteniyordu (önizlemede ölçüldü: 4 yerine 6 boş sayfa). Sınırdan sonra
    yalnızca düğme (devamEt) devam ettirir.
  */
  function sonaGelince() {
    if (b.bosSeri < BOS_SAYFA_SINIRI) dahaGetir()
  }

  function devamEt() {
    if (toplamAnahtari != null) guncelle(toplamAnahtari, () => ({ bosSeri: 0 }))
    dahaGetir()
  }

  return {
    items,
    /** Sunucunun (süzülmüş) toplamı; süzgeç tutmadıysa null — sayı gösterilmez. */
    toplam: suzgecTutmadi ? null : toplamHam,
    suzgecTutmadi,
    dahaVar,
    yukleniyor: b.yukleniyor,
    hata: b.hata,
    /** Hata kutusunun "Tekrar dene"si: sınırı yok sayar, tek sayfa ister. */
    dahaGetir,
    /** FlatList onEndReached'e bu verilir (boş sayfa sınırına uyar). */
    sonaGelince,
    /** Art arda boş sayfa sınırına gelindi: kendiliğinden devam durdu, düğme gösterilmeli. */
    durdu: dahaVar && !b.yukleniyor && b.bosSeri >= BOS_SAYFA_SINIRI,
    devamEt,
    /** İlk sayfa elde mi (dış kipte: dışarıdan geldi mi). */
    hazir: ilkSayfa != null,
    /** İç kip: ilk sayfa yükleniyor / düştü. Dış kipte ilk sayfanın durumu çağıranda. */
    ilkYukleniyor: !disaridan && etkin && ic.sayfa == null && !ic.hata,
    ilkHata: disaridan ? null : ic.hata,
    ilkYenidenDene: icYukle,
  }
}
