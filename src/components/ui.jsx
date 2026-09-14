import { Children, cloneElement, isValidElement, useEffect, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { beyaz, brand, slate } from '../lib/theme'
import { buyukHarf } from '../lib/metin'

/*
  YÜZEY DİLİ — web'deki components/ui.jsx'in RN portu. Kararlar aynen taşındı:

    zemin  bg-slate-50 (sayfa)
    kart   beyaz + border-slate-100 + hafif gölge — derinlik kartın kendisinden değil,
           zeminden AYRILMASINDAN gelir (web'deki 2026-08-24 kararı)
    köşe   rounded-2xl (16px): "kutu" değil "kart"
    buton  zemini brand-600 (beyaz metinle 4.90:1); brand-500 kimlik rengidir, zemin değil

  DOKUNMA HEDEFİ: her basılabilir öğe en az 44px yüksekliğinde. Web'de bu kural lg
  kırılımının ALTINDA geçerliydi; mobil uygulamada her ekran dokunmatik olduğundan
  kural koşulsuz.
*/

const BUTON_VARYANT = {
  primary: { kutu: 'bg-brand-600 active:bg-brand-700', yazi: 'text-white' },
  secondary: { kutu: 'bg-white border border-slate-300 active:bg-slate-50', yazi: 'text-slate-700' },
  danger: { kutu: 'bg-rose-600 active:bg-rose-700', yazi: 'text-white' },
  // `success` varyantı YOK: "Kabul et", "Onayla", "Doğrula" gibi olumlu eylemler primary.
  // Yeşil marka paletinin dışındaydı (kullanıcı kararı, A düzeni); bilinmeyen varyant
  // aşağıdaki `?? primary` ile yine primary'ye düşer.
  ghost: { kutu: 'active:bg-slate-100', yazi: 'text-slate-600' },
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  className = '',
  children,
}) {
  const v = BUTON_VARYANT[variant] ?? BUTON_VARYANT.primary
  const pasif = loading || disabled

  return (
    <Pressable
      accessibilityRole="button"
      // Etiket yalnızca metin tek başına yetmediğinde verilir: Keşfet kartlarındaki
      // "Engelle" düğmeleri birbirinin aynı ve TalkBack kimi engellediğini söylemeli.
      // Verilmezse undefined kalır, RN metin çocuğunu okur.
      accessibilityLabel={accessibilityLabel}
      // disabled prop'u ŞART: yalnızca onPress'i kaldırmak basışı engeller ama
      // NativeWind'in active: durumunu engellemez — pasif buton basınca renk
      // değiştirip "çalışıyormuş" derdi.
      disabled={pasif}
      onPress={onPress}
      /*
        `shrink`: RN'de flexShrink varsayılanı 0'dır, yani satıra sığmayan bir buton
        daralmak yerine TAŞAR. Satır `justify-end` ise taşma sola gider ve soldaki
        düğme ekranın dışında kalır (ölçüldü: 280 dp'de izin sayfasının "Yalnızca
        zorunlu" düğmesi x = -19). Daralınca etiket sarıyor, min-h zaten 44px'i
        koruyor. Sığan satırlarda etkisi yok.
      */
      className={`min-h-[44px] shrink flex-row items-center justify-center gap-2 rounded-lg px-4 py-2
                  ${v.kutu} ${pasif ? 'opacity-50' : ''} ${className}`}
    >
      {loading && <ActivityIndicator size="small" color={variant === 'secondary' || variant === 'ghost' ? slate[600] : beyaz} />}
      {/* text-center: shrink ile iki satıra saran etiket sola yaslanıyordu (320 dp'de
          kart düğmesinde ikinci satır 40 dp sola kayıktı). Tek satırda etkisi yok. */}
      <Text className={`text-center text-sm font-medium ${v.yazi}`}>{children}</Text>
    </Pressable>
  )
}

/*
  DOLGU AÇIK PROP, className'le EZİLMEZ. NativeWind sınıfları birleştirmiyor: `p-5 p-0`
  yan yana gelince hangisinin kazanacağını yazılış sırası değil üretilen stil sırası
  belirliyor ve genelde büyük değer kazanıyor. `className="p-0"` bu yüzden hiç işlemiyordu:
  Oluştur'daki bölüm şeritleri kartın kenarına oturmak yerine 20px beyaz çerçeveli bir iç
  kutu gibi duruyordu. Dolgusu farklı kart `dolgu="p-0"` / `dolgu="p-7"` verir; className
  yerleşim ve kırpma içindir (items-center, overflow-hidden).
*/
export function Card({ className = '', dolgu = 'p-5', children }) {
  return (
    <View
      className={`rounded-2xl border border-slate-100 bg-white ${dolgu} ${className}`}
      // Gölge NativeWind sınıfıyla değil style ile: RN'de gölge platforma göre ayrışır
      // (iOS shadow*, Android elevation) ve web'deki shadow-sm'in dengi bu ikili.
      style={{
        shadowColor: slate[900],
        shadowOpacity: 0.05,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {children}
    </View>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <View className="mb-3 flex-row items-center justify-between gap-3">
      <Text className="text-lg font-semibold text-slate-800">{children}</Text>
      {action}
    </View>
  )
}

/*
  ÜST ETİKET — küçük, büyük harfli bölüm etiketi ("SANA ANLATABİLİR", "GEÇMİŞ DERSLER").
  Tailwind'in büyük harf sınıfının (textTransform) yerine geçer: o sınıf "i"yi platforma
  göre "I" yapıyordu (gerekçe lib/metin.js'te). Stil tamamen çağıranın className'inden
  gelir; bileşen yalnızca metni dönüştürür.

  Erişim adı ÖZGÜN metin: büyük harfli dizeyi ekran okuyucu harf harf kodlama ya da
  kısaltma gibi okuyabilir, "Sana anlatabilir" doğal cümle olarak okunur. Ad yalnızca
  çocukların hepsi düz metin/sayıyken veriliyor; araya bir JSX öğesi girerse ad tahmin
  edilmez (o öğe de büyütülmez) ve Text kendi içeriğini okutur.

  Yeni üst etiket bu bileşenle yazılmalı. Büyük harf sınıfı uygulamada yalnızca
  Derslerim'deki doğrulama kodu girdisinde kaldı ve orada doğru: kod alfabesinde "I" yok
  (CodeGenerator.cs) ve sunucu ToUpperInvariant ile karşılaştırıyor (SessionRules.cs).
  Sınıf o girdinin dışında yeniden görünürse "SANA ANLATABILIR" hatası geri gelmiş olur.
*/
export function UstEtiket({ className = '', children, ...props }) {
  const parcalar = Children.toArray(children)
  const duz = parcalar.every((c) => typeof c === 'string' || typeof c === 'number')
  return (
    <Text accessibilityLabel={duz ? parcalar.join('') : undefined} className={className} {...props}>
      {Children.map(children, (c) => (typeof c === 'string' ? buyukHarf(c) : c))}
    </Text>
  )
}

/*
  Rozet rolleri: success = olumlu durum (brand-800/brand-100 6.34:1), warning = YALNIZCA
  bekleyen/dikkat, danger = tehlike. Olumlu durum marka mavisi: yeşil marka paletinin
  dışındaydı (kullanıcı kararı, A düzeni). Anlamı olmayan etiket (kategori, yön) neutral.
*/
const ROZET_TONLARI = {
  neutral: { kutu: 'bg-slate-100', yazi: 'text-slate-700' },
  brand: { kutu: 'bg-brand-100', yazi: 'text-brand-700' },
  success: { kutu: 'bg-brand-100', yazi: 'text-brand-800' },
  warning: { kutu: 'bg-amber-100', yazi: 'text-amber-800' },
  danger: { kutu: 'bg-rose-100', yazi: 'text-rose-700' },
}

export function Badge({ tone = 'neutral', className = '', children }) {
  const t = ROZET_TONLARI[tone] ?? ROZET_TONLARI.neutral
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${t.kutu} ${className}`}>
      <Text className={`text-xs font-medium ${t.yazi}`}>{children}</Text>
    </View>
  )
}

/**
 * Sayaç rozeti — "senden bekleyen iş var" işareti (gelen istek, işlem bekleyen ders).
 * Badge'den ayrı: Badge durum ANLATIR ve her zaman görünür, bu yalnızca sayı taşır ve
 * sayı 0 iken HİÇ çizilmez ("0" yazan kırmızı nokta kullanıcıyı boş bir ekrana çağırır).
 * Tek renk (rose-600 + beyaz), Mesajlar sekmesindeki okunmamış rozetiyle aynı dil.
 *
 * EKRAN OKUYUCUDAN GİZLİ: sayı değiştiğinde kendi başına duyurulmuyor. Sayıyı ebeveyn
 * düğmenin erişim adı taşımalı ("Derslerim, 2 ders işlem bekliyor"); rozet ayrıca
 * okunsaydı düğme adından kopuk bir "2" durağı olurdu.
 *
 * 9'dan sonrası "9+": 44px'lik ikon düğmesinin köşesine iki haneden fazlası sığmıyor ve
 * onuncu işten sonra kesin sayı karar değiştirmiyor. Konumu çağıran className ile verir
 * (ikon düğmesinde `absolute`): dokunma alanının İÇİNDE kalmalı, tur çıpası ölçüsü değişmesin.
 */
export function SayacRozeti({ sayi, className = '' }) {
  if (!(sayi > 0)) return null
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 ${className}`}
    >
      <Text
        className="text-[11px] font-semibold leading-[14px] text-white"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {sayi > 9 ? '9+' : sayi}
      </Text>
    </View>
  )
}

export function Spinner({ boy = 'small', renk = brand[600] }) {
  return <ActivityIndicator size={boy} color={renk} />
}

/**
 * İskelet bloğu — veri gelene kadar gerçek öğenin YERİNİ ayıran gri kutu. Yüzey dili tek yerde
 * kalsın diye burada (CLAUDE.md → "Dokunma ve yüzey dili"); boyutu çağıran className ile verir.
 * Yalnızca yer değiştiren içerikte kullanılır: bekleme göstergesi olarak Loading/Spinner var.
 */
export function IskeletBlok({ className = '' }) {
  return <View className={`rounded-lg bg-slate-200/70 ${className}`} />
}

export function Loading({ label = 'Yükleniyor…' }) {
  return (
    <View className="flex-row items-center justify-center gap-3 py-10">
      <Spinner />
      <Text className="text-sm text-slate-500">{label}</Text>
    </View>
  )
}

/** Hata kutusu — backend'in Türkçe `detail` mesajını gösterir. Kod GÖSTERİLMEZ
    (web kararı): kullanıcı için anlamsız; teşhis konsolda (api.js zaten logluyor). */
export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <View className="rounded-lg border border-rose-200 bg-rose-50 p-4">
      <Text className="text-sm font-medium text-rose-800">{error.message}</Text>
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mt-1 min-h-[44px] justify-center self-start"
        >
          <Text className="text-xs font-medium text-rose-800 underline">Tekrar dene</Text>
        </Pressable>
      )}
    </View>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10">
      <Text className="text-center font-medium text-slate-700">{title}</Text>
      {description ? (
        <Text className="mt-1 max-w-[280px] text-center text-sm text-slate-500">{description}</Text>
      ) : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  )
}

export function Field({ label, hint, children }) {
  /*
    Etiket girdiye PROGRAMATİK olarak da bağlanır: RN'de HTML'in <label for> eşleşmesi
    yok — görsel etiket tek başına kalsaydı TalkBack/VoiceOver alana odaklanınca yalnız
    "düzenleme kutusu" duyardı; E-posta mı, Ad Soyad mı ayırt edilemezdi. Çağıran kendi
    accessibilityLabel'ını verdiyse ona dokunulmaz.
  */
  const cocuk =
    isValidElement(children) && !children.props.accessibilityLabel
      ? cloneElement(children, { accessibilityLabel: label })
      : children

  return (
    <View>
      <Text className="mb-1 text-sm font-medium text-slate-700">{label}</Text>
      {cocuk}
      {hint ? <Text className="mt-1 text-xs text-slate-500">{hint}</Text> : null}
    </View>
  )
}

/**
 * Girdi — web'deki .input sınıfının karşılığı. 16px punto korunuyor: RN'de iOS'un
 * otomatik yakınlaştırma derdi yok ama 16px, dokunmatik okunabilirliğin alt sınırı
 * olarak bilinçli bir tasarım eşiğiydi; py ile birlikte ~44px yükseklik veriyor.
 *
 * Placeholder slate-500 (beyazda 4.76:1); slate-400 2.56:1'di ve birçok alanda ne
 * yazılacağını ("Örn. ...") yalnızca placeholder anlatıyor. Koyulaşan placeholder girilmiş
 * bir değer gibi okunabilir: çıplak değer yazma ("000000", hazır doğrulama kodu). Örnek
 * gerekiyorsa "Örn." ile başlat, değilse ne yazılacağını söyleyen cümle yaz.
 *
 * KENAR slate-500 (beyazda 4.76:1, slate-50 zeminde 4.55:1). slate-200 kenar 1.23:1'di:
 * Keşfet'in arama kutusu ve sohbetin mesaj kutusu zeminden seçilmiyor, kutunun nerede
 * başladığını yalnızca placeholder ele veriyordu. WCAG 1.4.11 bileşen sınırı için 3:1
 * istiyor; slate-400 (2.56:1) eşiği geçmediği için geçen en açık ton 500.
 *
 * ODAK 2px brand-600. RN'de outline/ring yok, odağı gösterecek tek şey kenar; ama kenar
 * kalınlaşınca içerik 1px kayar ve yazılan metin odakla birlikte zıplardı. Dolgu aynı
 * oranda 1px azalıyor (px-3 → 11px, py-2.5 → 9px): kenar + dolgu toplamı iki durumda da
 * aynı. Çağıranın onFocus/onBlur'u ezilmesin diye zincirleniyor. Girdi'ye kenar ya da
 * dolgu sınıfı veren çağıran yok; verilirse NativeWind birleştirmediği için bu hesap bozulur.
 */
export function Girdi({ className = '', onFocus, onBlur, ...props }) {
  const [odak, setOdak] = useState(false)
  return (
    <TextInput
      placeholderTextColor={slate[500]}
      onFocus={(e) => {
        setOdak(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setOdak(false)
        onBlur?.(e)
      }}
      className={`min-h-[44px] w-full rounded-lg bg-white text-base text-slate-900
                  ${odak ? 'border-2 border-brand-600 px-[11px] py-[9px]' : 'border border-slate-500 px-3 py-2.5'}
                  ${className}`}
      {...props}
    />
  )
}

/* Başarı bildirimi marka mavisi (brand-800/brand-50 7.16:1): yeşil marka paletinin dışındaydı
   (kullanıcı kararı, A düzeni). info ile aynı görünüm; ayrı anahtar çağıranın niyetini taşıyor.
   warning YALNIZCA bekleyen/dikkat. Yıkıcı ya da geri alınamaz eylemin SONUCUNU anlatan uyarı
   (hesap silme, itiraz) danger: amber'de kalınca yönetimdeki ban ve arkadaşlık sonlandırma
   onaylarından hafif okunuyordu. ErrorBox ile aynı kutu (rose-800/rose-50 7.30:1). */
const NOTICE_TONLARI = {
  success: { kutu: 'border-brand-200 bg-brand-50', yazi: 'text-brand-800' },
  info: { kutu: 'border-brand-200 bg-brand-50', yazi: 'text-brand-800' },
  warning: { kutu: 'border-amber-200 bg-amber-50', yazi: 'text-amber-900' },
  danger: { kutu: 'border-rose-200 bg-rose-50', yazi: 'text-rose-800' },
}

/** Kısa süreli bilgi/başarı bildirimi (sayfa üstünde) — web Notice'in portu. */
export function Notice({ tone = 'success', children, onDismiss }) {
  /*
    BİLDİRİM DUYURULUYOR. "Engellendi", "istek gönderildi", "engel kaldırıldı" gibi sonuçlar
    ekranda beliriyor ama ekran okuyucu kullanıcısı hiçbir şey duymuyordu; odak sökülen
    düğmeyle birlikte kaybolduğu için işlemin olup olmadığını listeyi yeniden tarayarak
    anlıyordu. Canlı bölge DEĞİL, açık duyuru: bildirim çoğu zaman bir alt sayfanın
    ARKASINDA çiziliyor ve Android'de etkin olmayan pencerenin canlı bölgesi okunmuyor.
    Metin başına bir kez (bağımlılık metnin kendisi). Kanca erken dönüşten ÖNCE.

    YALNIZCA KAPATILABİLİR bildirim duyuruluyor (onDismiss): projede geçici sonuç
    bildirimleri kapatılabilir, sayfaya gömülü sabit bilgi kutuları (ör. engelleme onayındaki
    şikayet uyarısı) değil. Hepsi duyurulsaydı alt sayfa açılır açılmaz ekran okuyucu başlığı
    okumadan uyarı kutusunu okuyordu (ölçüldü).
  */
  const duyuru = onDismiss && typeof children === 'string' ? children : null
  useEffect(() => {
    if (duyuru) AccessibilityInfo.announceForAccessibility(duyuru)
  }, [duyuru])

  if (!children) return null
  const t = NOTICE_TONLARI[tone] ?? NOTICE_TONLARI.success
  return (
    <View className={`flex-row items-start justify-between gap-3 rounded-lg border p-4 ${t.kutu}`}>
      <Text className={`flex-1 text-sm ${t.yazi}`}>{children}</Text>
      {onDismiss && (
        /* hitSlop 14: metin ~16px, 14+16+14 = 44px dokunma hedefi. */
        <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={14}>
          <Text className={`text-xs underline ${t.yazi}`}>kapat</Text>
        </Pressable>
      )}
    </View>
  )
}

/*
  MODAL — web'deki Modal'ın mobil yorumu: ALT SAYFA (bottom sheet).

  Web'de kutu mobil kırılımda zaten alta yaslanıyordu (items-end sm:items-center);
  mobil uygulamada bu tek doğal biçim. pageSheet/formSheet yerine transparan RN Modal +
  kendi karartmamız: web'dekiyle aynı görsel dil (slate-900/40 zemin) ve karartmaya
  dokununca kapanma.

  İçerik ScrollView'da, max %85 yükseklik: klavye ya da uzun liste kutuyu ekrandan
  taşırmasın — web'deki max-h-[90dvh] kararının karşılığı.
*/
/**
 * Alt sayfa.
 *
 * @param kapatilabilir Kullanıcı bu sayfayı cevap vermeden kapatabilir mi? `false` iken
 *   karartmaya dokunmak ve ✕ ile kapatma YOKTUR — ve ✕ HİÇ ÇİZİLMEZ. Görünür ama işlevsiz
 *   bir kapatma düğmesi, kullanıcıya olmayan bir çıkış yolu vaat eder: ilk açılıştaki izin
 *   sayfasında tam olarak bu oluyordu (onClose boş fonksiyondu, ✕ duruyordu).
 *   Kapanışın tek yolu bir cevap vermekse, o cevabı veren düğmeler de zaten footer'da.
 */
export function Modal({ open, title, onClose, children, footer, kapatilabilir = true }) {
  const insets = useSafeAreaInsets()
  // Android'in donanım geri tuşu onRequestClose'u ÇAĞIRIR ve prop zorunludur; kapatılamaz
  // kipte olayı yutan bir no-op veriliyor, yoksa geri tuşu sayfayı kapatırdı.
  const kapat = kapatilabilir ? onClose : () => {}

  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={kapat}>
      {/*
        KLAVYE KAÇINMA MODALIN KENDİ İÇİNDE ŞART: RN Modal ayrı bir pencere — ekrandaki
        (varsa) KeyboardAvoidingView onu etkilemez ve iOS'ta klavye, alta yaslı sheet'in
        alt yarısını (form alanları + footer düğmeleri) örtüyordu. 'padding' davranışı
        kullanılabilir yüksekliği kısar, justify-end sheet'i klavyenin üstüne taşır.
      */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-slate-900/40"
      >
        {/* Karartmaya dokunma = kapat. Kutunun kendisi ayrı Pressable DEĞİL: içindeki
            girdilere dokunmayı yutmasın. Kapatılamaz kipte dokunma yine YUTULUR (alttaki
            ekrana geçmesin) ama bir şey yapmaz. */}
        <Pressable
          className="flex-1"
          onPress={kapat}
          accessible={kapatilabilir}
          accessibilityLabel={kapatilabilir ? 'Kapat' : undefined}
        />

        {/*
          ScrollView, max-h'li kutunun DOĞRUDAN çocuğu ve `shrink` (flexShrink:1) taşıyor.
          İkisi de şart: RN'de flexShrink varsayılanı 0'dır — araya bir sarmalayıcı
          (ör. SafeAreaView) girse ya da shrink düşse, uzun içerikte ScrollView kutuya
          sığmak yerine footer'ı ekranın dışına iterdi. Alt güvenli alan bu yüzden
          sarmalayıcıyla değil, padding ile veriliyor.
        */}
        <View
          className="max-h-[85%] rounded-t-2xl bg-white"
          style={{ paddingBottom: insets.bottom }}
        >
          {/* Tutamaç: alt sayfanın evrensel işareti — sürüklenebilirlik vaadi değil,
              "bu bir katman" işareti. */}
          <View className="items-center pt-2.5">
            <View className="h-1 w-10 rounded-full bg-slate-200" />
          </View>

          <View className="flex-row items-center justify-between border-b border-slate-200 px-5 py-3">
            <Text className="text-base font-semibold text-slate-800">{title}</Text>
            {kapatilabilir && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kapat"
                onPress={onClose}
                hitSlop={12}
                className="min-h-[32px] min-w-[32px] items-center justify-center"
              >
                {/* slate-500: ✕ sayfanın tek görünür çıkışı, süs değil; slate-400 2.56:1'di. */}
                <Text className="text-lg text-slate-500">✕</Text>
              </Pressable>
            )}
          </View>

          <ScrollView className="shrink px-5 py-4" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>

          {/*
            `flex-wrap`: dar ekranda ya da işletim sisteminin yazı tipi ölçeği büyükken
            iki düğme tek satıra sığmıyor. Sarmasaydı taşan düğme ekranın DIŞINDA kalırdı
            ve bu, kapatılamaz kipte (izin sayfası) tek çıkışın kaybolması demek: 360 dp +
            2.0x ölçekte "Yalnızca zorunlu" merkezi bile ekran dışına düşüyordu, yani
            kullanıcıya yalnızca KABUL seçeneği kalıyordu. Sarma ile düğmeler alt alta
            geçiyor; `gap-2` satır arasını da veriyor.
          */}
          {footer && (
            <View className="flex-row flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  )
}
