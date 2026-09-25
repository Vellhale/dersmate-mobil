import { Pressable, Text, View } from 'react-native'
import { Avatar } from './Avatar'
import { SeviyeRozeti } from './SeviyeRozeti'
import { YonetimRozeti } from './YonetimRozeti'
import { BayrakIkonu, MesajIkonu, OyOkuIkonu, UyariIkonu } from './Ikonlar'
import { amber, brand, rose, slate } from '../lib/theme'
import { onizlemeAkisTarzi } from '../lib/onizleme'
import {
  ETIKET_ADI,
  ETIKET_TONU,
  VARSAYILAN_ETIKET_TONU,
  etiketAnahtari,
  goreliZaman,
  goreliZamanUzun,
} from '../lib/forum'

/*
  ══════════════════════════════════════════════════════════════════════════════
  TOPLULUK AKIŞ KARTI — ve akışla ipliğin ortak parçaları.

  ─── TARZ TEK YERDEN ─────────────────────────────────────────────────────────
  Akışın görünümünü belirleyen TEK anahtar AKIS_TARZI. İki tarz aynı prop sözleşmesini
  alıyor ve aynı parçalardan kuruluyor; geri dönüş bu dosyada tek satırlık değişiklik:

    'instagram'  kenardan kenara beyaz kart, kartlar arasında 8px bant (VARSAYILAN)
    'reddit'     solda dikey oy rayı, ince çizgiyle ayrılan satırlar (2026-09-23 hâli)

  Kullanılmayan tarz çürümesin diye önizlemede adresten seçilebiliyor: ?akis=reddit ya
  da ?akis=instagram (src/lib/onizleme.js → onizlemeAkisTarzi). Önizleme dışında ve
  parametre yokken sabit geçerli.

  ORTAK PROP SÖZLEŞMESİ (iki tarz da bunu alır):
    { gonderi, benimUserId, onOy, onAc, onYazar, gizliAcik, onGizliAc, onSikayet }
    onOy(postId, yon) · onAc() · onYazar(userId) · onGizliAc() · onSikayet(hedef)

  ─── NEDEN KART GERİ GELDİ, NEDEN Card DEĞİL ─────────────────────────────────
  2026-09-23'te gönderi KARTI kaldırılmıştı: sayfa zemini slate-50 ile beyaz kart
  arasında ~1.04:1 kontrast vardı, kartın kenarı fiziksel olarak okunmuyordu; hiyerarşi
  `shadowOpacity 0.05`'e kalmıştı. Yerine Reddit'in ince çizgili satırları geldi —
  bu kez de "tek düze, gönderiler birbirine karışıyor" şikâyeti doğdu (1px slate-100
  çizgi, beyaz üstünde ~1.1:1).

  Yeni kart o tuzağa GERİ DÜŞMÜYOR, çünkü ayrımı kenardan ya da gölgeden beklemiyor:
    • Kart kenardan kenara beyaz blok; yarıçap, yan kenar ve gölge YOK. ui.jsx'in Card'ı
      ve KART_GOLGESI BİLEREK kullanılmıyor: tam genişlik blokta gölge yalnızca alt
      kenarda yayvan bir leke olurdu ve ayrımı yine 1.04'lük kenara bırakırdı.
    • Ayrımı KalinAyrac veriyor: 8px slate-100 bant + iki keskin slate-200 çizgi
      (beyaz/slate-100 1.10:1, beyaz/slate-200 çizgi 1.23:1). Ayrım renk farkından
      değil bandın KALINLIĞINDAN ve iki çizgiden geliyor.
  CLAUDE.md "sayfalar kendi yüzey dilini icat etmez" diyor; burada icat edilen bir
  yüzey yok: beyaz içerik + zemin rengi bant, kutu değil.
  ══════════════════════════════════════════════════════════════════════════════
*/

export const AKIS_TARZI = 'instagram'

/* ─── ORTAK PARÇALAR ──────────────────────────────────────────────────────── */

/** Etiket pili. `className` yerleşim içindir (varsayılan self-start: sütunda sola yaslı). */
export function EtiketPili({ etiket, className = 'self-start' }) {
  const ton = ETIKET_TONU[etiket] ?? VARSAYILAN_ETIKET_TONU
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${ton.kutu} ${className}`}>
      <Text className={`text-[12px] font-semibold leading-[16px] ${ton.yazi}`}>
        {ETIKET_ADI[etiket] ?? etiket}
      </Text>
    </View>
  )
}

/**
 * İnceleme şeridi — perde "Yine de göster"le açıldıktan sonra içeriğin ÜSTÜNDE kalır:
 * kullanıcı o anı unutabilir, içeriğin durumu unutulmamalı. Akışta kenardan kenara
 * şerit, iplikte (`kutu`) yuvarlak kutu.
 */
export function IncelemeSeridi({ sikayetSayisi, kutu = false }) {
  return (
    <View
      className={`flex-row items-center gap-2 border-amber-200 bg-amber-50 ${
        kutu ? 'rounded-lg border px-3 py-2' : 'border-b px-4 py-2'
      }`}
    >
      <UyariIkonu renk={amber[800]} boy={16} />
      <Text className="flex-1 text-xs font-medium text-amber-900">
        İncelemede — {sikayetSayisi} şikayet aldı, moderasyon sürüyor.
      </Text>
    </View>
  )
}

/*
  İNCELEMEDEKİ GÖNDERİ AKIŞTA KAPALI GELİR. Silinmiyor, PERDELENİYOR. Aradaki fark
  moderasyonun görünürlüğü: sessizce silinen içerik, hem yazarına hem okuyanına hiçbir
  şey söylemez ve "burada sansür var mı" sorusunu cevaplanamaz hâle getirir. Perde ise
  sebebi yazıyor, sayıyı veriyor ve kararı okuyana bırakıyor.

  İki tarz için ORTAK (dağıtıcı çiziyor): perde bir moderasyon kararı, görünüm tercihi
  değil. Yazar ve başlık perdenin arkasında GİZLİ. Amber burada "dikkat" anlamında.
*/
export function IncelemePerdesi({ gonderi, onGizliAc }) {
  const anahtar = etiketAnahtari(gonderi.tag)
  return (
    <View className="bg-amber-50 px-4 py-4">
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5">
          <UyariIkonu renk={amber[800]} boy={20} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-slate-900">Bu gönderi incelemede</Text>
          <Text className="mt-1 text-sm leading-relaxed text-slate-700">
            {gonderi.reportCount} kişi topluluk kurallarını ihlal ettiğini bildirdi. Moderasyon
            sonuçlanana kadar akışta kapalı tutuluyor.
          </Text>
          <View className="mt-3 flex-row flex-wrap items-center gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={onGizliAc}
              className="min-h-[44px] justify-center rounded-lg border border-amber-300 bg-white px-3 active:bg-amber-100"
            >
              <Text className="text-xs font-semibold text-amber-900">Yine de göster</Text>
            </Pressable>
            <Text className="text-xs text-slate-600">Etiket: {ETIKET_ADI[anahtar] ?? anahtar}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

/**
 * YAZAR BAŞLIĞI — Instagram kartının ve yorum ipliğinin başı: avatar + ad + (yönetim
 * rozeti) + seviye; altında zaman · etiket.
 *
 * BASILABİLİR: yazarın profiline götürür. Forumda bu yol hiç yoktu ve YonetimRozeti'nin
 * doğrulama yolu ("Yönetim" rozetli bir gönderi görür → adına dokunur → profilde aynı
 * rozeti görür) tam olarak buna dayanıyor. Bu yüzden yönetim rozeti burada NORMAL boyda.
 * `onPress` yoksa (yazarın kimliği gelmedi) düz View çizilir: gidilemeyecek bir yere
 * götürüyormuş gibi görünen düğme, kırık düğmedir.
 *
 * ETİKET SAĞ ÜSTTE DEĞİL, ALT SATIRDA: 360dp'de "Ders Programı" pili (~105dp), Yönetim
 * rozeti (~66dp) ve madalyon ada ~60dp bırakıyordu ve "dersmate ekibi" kesiliyordu.
 *
 * ERİŞİLEBİLİR AD tek düğme olduğu için içindeki her şeyi taşır: Pressable'a ad verilince
 * iOS çocukları (rozetler, zaman, etiket) ayrıca okumaz. Önce eylem ("{ad} — profilini
 * aç"), ardından bağlam; yönetim işareti bir güvenlik bilgisi olduğu için düşmüyor.
 */
export function YazarBasligi({ yazar, damga, etiket, onPress, className = 'mx-4 mt-3' }) {
  const ad = yazar?.displayName ?? 'Kullanıcı'
  const etiketAdi = etiket ? (ETIKET_ADI[etiket] ?? etiket) : null
  const baglam = [
    yazar?.isStaff ? 'Yönetim, resmi hesap' : null,
    goreliZamanUzun(damga),
    etiketAdi ? `Etiket: ${etiketAdi}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const icerik = (
    <>
      <Avatar userId={yazar?.userId} name={ad} size="md" />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="shrink text-sm font-semibold text-slate-900">
            {ad}
          </Text>
          {/* isStaff SUNUCUDAN gelir, istemci türetmez. */}
          {yazar?.isStaff ? <YonetimRozeti /> : null}
          <SeviyeRozeti kaynak={{ level: yazar?.level }} boyut="sm" ton="acik" etiketli={false} />
        </View>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <Text className="text-[12px] leading-[16px] text-slate-500">{goreliZaman(damga)}</Text>
          {etiket ? (
            <>
              <Text className="text-[12px] leading-[16px] text-slate-400">·</Text>
              <EtiketPili etiket={etiket} className="" />
            </>
          ) : null}
        </View>
      </View>
    </>
  )

  const kap = `min-h-[44px] flex-row items-center gap-3 ${className}`

  if (!onPress || !yazar?.userId) return <View className={kap}>{icerik}</View>

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ad} — profilini aç. ${baglam}.`}
      onPress={() => onPress(yazar.userId)}
      className={`${kap} rounded-lg active:opacity-70`}
    >
      {icerik}
    </Pressable>
  )
}

/**
 * Yazar satırı: avatar + ad + (yönetim rozeti) + seviye + zaman — YORUMLAR ve Reddit
 * tarzı satır için. Gönderi başlığı artık YazarBasligi; bu satır yorumun dar sütununa
 * sığan küçük sürüm.
 *
 * Seviye rozeti ETİKETSİZ: "Seviye" kelimesi bu dar satırda ada yer bırakmıyordu; rozet
 * yalnızca `level` ile besleniyor — puan başkasının verisi ve forum DTO'su göndermiyor.
 */
export function YazarSatiri({ yazar, damga, kucuk = false }) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
      <Avatar userId={yazar?.userId} name={yazar?.displayName ?? 'Kullanıcı'} size="sm" />
      <Text
        numberOfLines={1}
        className={`max-w-[45%] font-medium text-slate-700 ${kucuk ? 'text-[11px]' : 'text-xs'}`}
      >
        {yazar?.displayName ?? 'Kullanıcı'}
      </Text>
      {/* isStaff SUNUCUDAN gelir, istemci türetmez. */}
      {yazar?.isStaff ? <YonetimRozeti kucuk /> : null}
      <SeviyeRozeti kaynak={{ level: yazar?.level }} boyut="sm" ton="acik" etiketli={false} />
      <Text className="text-xs text-slate-500">· {goreliZaman(damga)}</Text>
    </View>
  )
}

/*
  OY RAYI.

  Renk oyun yönünü söylüyor: yukarı marka mavisi (bu ürünün "evet" rengi), aşağı rose.
  Sayı da oyun rengini alıyor — kullanıcı kendi oyunu, okların hangisinin dolu olduğuna
  bakmadan görebiliyor.

  ⚠️ GÖSTERİLEN SAYI = arti − eksi. Kendi oyu AYRICA EKLENMİYOR: sunucudan gelen
  upvoteCount/downvoteCount kullanıcının kendi oyunu zaten içeriyor.

  ÖLÇÜLER px İLE (2026-09-26 düzeltmesi):
  • Gönderi rayında düğmeler h-[44px] w-[44px]. ⚠️ ESKİDEN `h-11 w-11` yazıyordu ve
    yorumu "44px" diyordu — yanlıştı: NativeWind cihazda rem'i 14 sayıyor, h-11 telefonda
    38.5dp çiziliyordu. Web önizlemesi rem 16 ile 44 gösterdiği için fark görünmüyordu.
  • Yorum rayında (`kucuk`) h-[36px] w-[36px] + hitSlop: 44'lük iki ok, iki satırlık bir
    yorumdan uzun bir ray üretiyordu. hitSlop dokunma hedefini cihazda kurala getiriyor
    (web önizlemesi hitSlop uygulamıyor), aradaki sayı iki bölgenin çakışmasını engelliyor.
  • `yatay`: Instagram kartının eylem satırı ve iplikteki gönderi. Orada gövde tam
    genişlikte akıyor; solda dikey bir ray okuma genişliğini boşuna daraltırdı.
*/
export function OyRayi({ arti, eksi, oy = 0, onOy, kucuk = false, yatay = false }) {
  const olcu = kucuk ? 'h-[36px] w-[36px]' : 'h-[44px] w-[44px]'
  const hedefBuyutme = kucuk ? { top: 4, bottom: 4, left: 6, right: 6 } : undefined
  const sayiRengi = oy === 1 ? 'text-brand-700' : oy === -1 ? 'text-rose-700' : 'text-slate-800'
  const puan = arti - eksi

  return (
    <View className={`shrink-0 items-center gap-0.5 ${yatay ? 'flex-row' : 'flex-col'}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Yukarı oy ver"
        accessibilityState={{ selected: oy === 1 }}
        hitSlop={hedefBuyutme}
        onPress={() => onOy(1)}
        className={`${olcu} items-center justify-center rounded-lg ${oy === 1 ? 'bg-brand-50' : 'active:bg-slate-100'}`}
      >
        {/* Tek çizim, iki yön: OyOkuIkonu YUKARI çizilir, aşağı oy 180° döndürülür.
            Gövdeli ok (sap + baş) basılabilir bir eylem gibi okunur; çıplak chevron
            oy düğmesinde "aşağı kaydır" gibi dururdu (bkz. Ikonlar.jsx). */}
        <OyOkuIkonu renk={oy === 1 ? brand[600] : slate[400]} boy={18} kalinlik={oy === 1 ? 2.6 : 2} />
      </Pressable>

      <Text
        accessibilityLabel={`Puan: ${puan}`}
        className={`text-sm font-bold ${sayiRengi}`}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {puan}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aşağı oy ver"
        accessibilityState={{ selected: oy === -1 }}
        hitSlop={hedefBuyutme}
        onPress={() => onOy(-1)}
        className={`${olcu} items-center justify-center rounded-lg ${oy === -1 ? 'bg-rose-50' : 'active:bg-slate-100'}`}
      >
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <OyOkuIkonu renk={oy === -1 ? rose[600] : slate[400]} boy={18} kalinlik={oy === -1 ? 2.6 : 2} />
        </View>
      </Pressable>
    </View>
  )
}

/**
 * Yorum düğmesi — Instagram kartının eylem satırında. Görünen metin YALNIZCA sayı (0 ise
 * hiç sayı yok, balon tek başına "yorum yaz/oku" diyor); sayının ne olduğu erişilebilir
 * adda okunuyor. İpliği açar (gövdeye dokunmakla aynı hedef).
 */
export function YorumDugmesi({ sayi = 0, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sayi > 0 ? `Yorumlar — ${sayi} yorum` : 'Yorumlar — henüz yorum yok'}
      onPress={onPress}
      className="min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-1.5 rounded-lg px-2.5 active:bg-slate-100"
    >
      <MesajIkonu renk={slate[600]} boy={20} />
      {sayi > 0 ? (
        <Text
          className="text-sm font-semibold text-slate-700"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {sayi}
        </Text>
      ) : null}
    </Pressable>
  )
}

/*
  ŞİKAYET DÜĞMESİ — her gönderide ve her yorumda. Sessiz duruyor (slate-500) ama saklı
  değil: dikkat çeken bir düğme forumu ihbar hattı gibi gösterir, üç nokta menüsüne
  gömülen bir şikayet ise ihlali gören kullanıcının vazgeçtiği bir yol olur. Basılınca
  rose'a dönüyor (hover yok).

  İKON BAYRAK, ÜÇGEN DEĞİL: UyariIkonu (üçgen) bu ekranda "incelemede" perdesini
  çiziyor — aynı çizimi şikayet düğmesinde de kullanmak, sistemin verdiği uyarı ile
  kullanıcının verdiği işareti birbirine karıştırırdı (bkz. Ikonlar.jsx BayrakIkonu).

  `yalnizIkon` — AKIŞ KARTINDA (2026-09-26 kararı). Eskiden "metin her boyutta duruyor:
  dar ekranda yalnız ikon bırakmak eylemi tanınmaz yapardı" kararı vardı; Instagram
  kartının eylem satırı oy rayı + yorum + şikayetten oluşuyor ve metinli düğme o satırda
  gözü eylemlerden ÖNCE şikayete çekiyordu. Bedeli bilinçli: bayrak tek başına daha az
  tanınır. Karşılığı: (a) erişilebilir ad yine "Şikayet et"; (b) iplikte ve yorumlarda
  METİNLİ sürüm kalıyor, kullanıcı eylemi orada adıyla öğreniyor; (c) dokunma hedefi
  tam 44px kare.
*/
export function SikayetDugmesi({ onPress, kucuk = false, yalnizIkon = false }) {
  if (yalnizIkon) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Şikayet et"
        onPress={onPress}
        className="h-[44px] w-[44px] items-center justify-center rounded-lg active:bg-rose-50"
      >
        <BayrakIkonu renk={slate[500]} boy={18} />
      </Pressable>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Şikayet et"
      onPress={onPress}
      hitSlop={kucuk ? 8 : undefined}
      className={`shrink-0 flex-row items-center justify-center gap-1 rounded-lg px-2 active:bg-rose-50
                  ${kucuk ? 'min-h-[36px]' : 'min-h-[44px]'}`}
    >
      <BayrakIkonu renk={slate[500]} boy={kucuk ? 12 : 14} />
      <Text className={`font-medium text-slate-500 ${kucuk ? 'text-[11px]' : 'text-xs'}`}>
        Şikayet et
      </Text>
    </Pressable>
  )
}

/**
 * İLK YORUM ÖNİZLEMESİ — kartın altında, iki satır: "{ad} {yorum}" ve (en az iki yorum
 * varsa) "{n} yorumun tümünü gör". İpliği açar.
 *
 * Veri SUNUCUDAN hazır gelir (ForumPostDto.FirstComment, 2026-09-26). Hangi yorumun
 * seçildiği sunucunun kararı: görünür (Visible) olan ilk yorum; incelemedeki/kaldırılmış
 * yorum ve bakanla arasında engel olan kişinin yorumu GİRMEZ, perdeli gönderinin
 * önizlemesi hiç kurulmaz. İstemci bu kuralları YENİDEN UYGULAMAZ — yalnızca çizer.
 * Alan yoksa (eski sunucu ya da uygun yorum yok) blok HİÇ çizilmez: yer tutucu ya da
 * "yükleniyor" yok, kart eylem satırıyla biter.
 *
 * ⚠️ "{n} yorumun tümünü gör" gönderinin commentCount'unu kullanır ve bu sayaç yalnızca
 * artıyor (moderasyonla kaldırılan yorum düşmüyor, ForumCommands.cs). İplik açılınca
 * index.jsx sayıyı görünen listeyle eşitliyor.
 */
export function YorumOnizlemesi({ yorum, sayi = 0, onPress }) {
  const ad = yorum.author?.displayName ?? 'Kullanıcı'
  const yonetim = Boolean(yorum.author?.isStaff)
  // Yorum zaten noktalama ile bitiyorsa ikinci nokta eklenmez ("teşekkürler!." okunmasın).
  const govde = /[.!?…]$/.test(yorum.body.trim()) ? yorum.body.trim() : `${yorum.body.trim()}.`
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`İlk yorum, ${ad}${yonetim ? ' (Yönetim)' : ''}: ${govde} Tüm yorumları aç.`}
      onPress={onPress}
      className="min-h-[44px] justify-center px-4 pb-3 pt-1 active:bg-slate-50"
    >
      <Text numberOfLines={2} className="text-sm leading-snug text-slate-700">
        <Text className="font-semibold text-slate-900">{ad}</Text>
        {/* Rozet METNİN İÇİNDE (satır içi görünüm): yorum adla aynı satırdan akmaya devam
            etsin diye. Resmi cevabın hangisi olduğu önizlemede de ayırt edilmeli. */}
        {yonetim ? (
          <>
            {' '}
            <YonetimRozeti kucuk />
          </>
        ) : null}{' '}
        {yorum.body}
      </Text>
      {sayi >= 2 ? (
        <Text className="mt-1 text-[12px] font-medium leading-[16px] text-slate-500">
          {sayi} yorumun tümünü gör
        </Text>
      ) : null}
    </Pressable>
  )
}

/* ─── INSTAGRAM TARZI (varsayılan) ────────────────────────────────────────── */

/*
  Sıra: (perde açıldıysa şerit) → yazar başlığı → başlık + metin → eylem satırı →
  (varsa) ilk yorum. Tahmini boy ~270-300dp; 780dp ekranda ~2.5 gönderi.
*/
function InstagramKarti({ gonderi, benimUserId, onOy, onAc, onYazar, onSikayet }) {
  const anahtar = etiketAnahtari(gonderi.tag)
  // KENDİ GÖNDERİNİ ŞİKAYET EDEMEZSİN: sunucu da reddediyor, ama hatayı göstermektense
  // düğmeyi hiç çizmemek doğru — tıklandığında reddedilen bir düğme, kırık bir düğmedir.
  const benimGonderim = gonderi.author?.userId === benimUserId

  return (
    <View className="bg-white">
      {gonderi.underReview ? <IncelemeSeridi sikayetSayisi={gonderi.reportCount} /> : null}

      <YazarBasligi
        yazar={gonderi.author}
        damga={gonderi.createdAtUtc}
        etiket={anahtar}
        onPress={onYazar}
      />

      {/* Başlık ve metin gönderiyi AÇAR: ipliğin kendisi bir alt sayfa, kartın gövdesi
          onu açan doğal hedef — "Yorumlar" düğmesini aramak zorunda kalmadan. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${gonderi.title} — gönderiyi ve yorumları aç`}
        onPress={onAc}
        className="px-4 pt-2.5 active:opacity-70"
      >
        <Text numberOfLines={3} className="text-[17px] font-bold leading-snug text-slate-900">
          {gonderi.title}
        </Text>
        {/* Akış TARANABİLİR kalmalı: metin üç satırda kesiliyor, tamamı iplikte. Satır
            araları korunuyor. slate-700: burada metin içeriğin kendisi, ikincil bilgi değil. */}
        <Text numberOfLines={3} className="mt-1.5 text-sm leading-relaxed text-slate-700">
          {gonderi.body}
        </Text>
      </Pressable>

      {/* px-2: 44px'lik düğmenin içindeki ikonun görünür kenarı metnin px-4 hizasına iner. */}
      <View className="mt-1.5 flex-row items-center px-2 pb-1">
        <OyRayi
          yatay
          arti={gonderi.upvoteCount}
          eksi={gonderi.downvoteCount}
          oy={gonderi.myVote}
          onOy={(yon) => onOy(gonderi.postId, yon)}
        />
        <YorumDugmesi sayi={gonderi.commentCount} onPress={onAc} />
        <View className="flex-1" />
        {!benimGonderim ? (
          <SikayetDugmesi
            yalnizIkon
            onPress={() =>
              onSikayet({
                tur: 'Gönderi',
                id: gonderi.postId,
                baslik: gonderi.title,
                yazar: gonderi.author?.displayName,
              })
            }
          />
        ) : null}
      </View>

      {gonderi.firstComment ? (
        <YorumOnizlemesi yorum={gonderi.firstComment} sayi={gonderi.commentCount} onPress={onAc} />
      ) : null}
    </View>
  )
}

/* KALIN AYRAÇ — h-2 YAZILMAZ: rem cihazda 14 sayıldığı için 7dp çizilirdi. */
function KalinAyrac() {
  return <View className="h-[8px] border-y border-slate-200 bg-slate-100" />
}

/* ─── REDDIT TARZI (geri dönüş) ───────────────────────────────────────────── */

/*
  2026-09-23 – 2026-09-26 arasındaki akış satırı, index.jsx'ten TAŞINDI (silinmedi):
  solda dikey oy rayı, sağ sütunda etiket + metinli şikayet, yazar satırı, başlık + özet,
  yorum düğmesi. Satırlar arasındaki çizgi artık satırın kendi border-b'si değil,
  InceAyrac (FlatList ItemSeparatorComponent) — görünüm aynı.
*/
function RedditSatiri({ gonderi, benimUserId, onOy, onAc, onSikayet }) {
  const anahtar = etiketAnahtari(gonderi.tag)
  const benimGonderim = gonderi.author?.userId === benimUserId

  return (
    <View className="bg-white">
      {gonderi.underReview ? <IncelemeSeridi sikayetSayisi={gonderi.reportCount} /> : null}

      <View className="flex-row gap-3 p-4">
        <OyRayi
          arti={gonderi.upvoteCount}
          eksi={gonderi.downvoteCount}
          oy={gonderi.myVote}
          onOy={(yon) => onOy(gonderi.postId, yon)}
        />

        <View className="min-w-0 flex-1 gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <EtiketPili etiket={anahtar} />
            {!benimGonderim ? (
              <SikayetDugmesi
                onPress={() =>
                  onSikayet({
                    tur: 'Gönderi',
                    id: gonderi.postId,
                    baslik: gonderi.title,
                    yazar: gonderi.author?.displayName,
                  })
                }
              />
            ) : null}
          </View>

          <YazarSatiri yazar={gonderi.author} damga={gonderi.createdAtUtc} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${gonderi.title} — gönderiyi ve yorumları aç`}
            onPress={onAc}
            className="active:opacity-70"
          >
            <Text numberOfLines={3} className="text-[17px] font-bold leading-snug text-slate-900">
              {gonderi.title}
            </Text>
            <Text numberOfLines={3} className="mt-2 text-sm leading-relaxed text-slate-600">
              {gonderi.body}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onAc}
            className="min-h-[44px] flex-row items-center gap-2 self-start rounded-lg px-2.5 active:bg-slate-100"
          >
            <MesajIkonu renk={slate[600]} boy={16} />
            <Text className="text-xs font-semibold text-slate-600">
              {gonderi.commentCount > 0 ? `${gonderi.commentCount} yorum` : 'Yorumlar'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

function InceAyrac() {
  return <View className="h-px bg-slate-100" />
}

/* ─── DAĞITICI ────────────────────────────────────────────────────────────── */

const TARZLAR = {
  instagram: { Kart: InstagramKarti, Ayrac: KalinAyrac },
  reddit: { Kart: RedditSatiri, Ayrac: InceAyrac },
}

/* Etkin tarz modül yüklenirken BİR KEZ seçilir (önizleme parametresi de açılışta bir kez
   okunuyor). Tanınmayan bir sabit değeri uygulamayı düşürmesin: varsayılana döner. */
const ETKIN_TARZ = TARZLAR[onizlemeAkisTarzi() ?? AKIS_TARZI] ?? TARZLAR.instagram

/**
 * Akıştaki tek gönderi. Perdeli gönderide (incelemede ve "Yine de göster" basılmamış)
 * iki tarz için ORTAK perdeyi, değilse etkin tarzın kartını çizer.
 */
export function GonderiKarti(props) {
  const { gonderi, gizliAcik, onGizliAc } = props
  if (gonderi.underReview && !gizliAcik) {
    return <IncelemePerdesi gonderi={gonderi} onGizliAc={onGizliAc} />
  }
  const { Kart } = ETKIN_TARZ
  return <Kart {...props} />
}

/**
 * Gönderiler arasındaki ayraç — etkin tarzın. FlatList ayırıcıyı ilk öğeden önce ve son
 * öğeden sonra çizmiyor; o iki yeri ekran kendisi çağırıyor (liste başlığının sonu,
 * altbilginin başı).
 */
export function AkisAyraci() {
  const { Ayrac } = ETKIN_TARZ
  return <Ayrac />
}
