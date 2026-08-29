import { cloneElement, isValidElement } from 'react'
import {
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
import { brand, slate } from '../lib/theme'

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
  success: { kutu: 'bg-emerald-600 active:bg-emerald-700', yazi: 'text-white' },
  ghost: { kutu: 'active:bg-slate-100', yazi: 'text-slate-600' },
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
  className = '',
  children,
}) {
  const v = BUTON_VARYANT[variant] ?? BUTON_VARYANT.primary
  const pasif = loading || disabled

  return (
    <Pressable
      accessibilityRole="button"
      // disabled prop'u ŞART: yalnızca onPress'i kaldırmak basışı engeller ama
      // NativeWind'in active: durumunu engellemez — pasif buton basınca renk
      // değiştirip "çalışıyormuş" derdi.
      disabled={pasif}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-lg px-4 py-2
                  ${v.kutu} ${pasif ? 'opacity-50' : ''} ${className}`}
    >
      {loading && <ActivityIndicator size="small" color={variant === 'secondary' || variant === 'ghost' ? slate[600] : '#fff'} />}
      <Text className={`text-sm font-medium ${v.yazi}`}>{children}</Text>
    </Pressable>
  )
}

export function Card({ className = '', children }) {
  return (
    <View
      className={`rounded-2xl border border-slate-100 bg-white p-5 ${className}`}
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

const ROZET_TONLARI = {
  neutral: { kutu: 'bg-slate-100', yazi: 'text-slate-700' },
  brand: { kutu: 'bg-brand-100', yazi: 'text-brand-700' },
  success: { kutu: 'bg-emerald-100', yazi: 'text-emerald-700' },
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

export function Spinner({ boy = 'small', renk = brand[600] }) {
  return <ActivityIndicator size={boy} color={renk} />
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
 */
export function Girdi({ className = '', ...props }) {
  return (
    <TextInput
      placeholderTextColor={slate[400]}
      className={`min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5
                  text-base text-slate-900 ${className}`}
      {...props}
    />
  )
}

const NOTICE_TONLARI = {
  success: { kutu: 'border-emerald-200 bg-emerald-50', yazi: 'text-emerald-800' },
  info: { kutu: 'border-brand-200 bg-brand-50', yazi: 'text-brand-800' },
  warning: { kutu: 'border-amber-200 bg-amber-50', yazi: 'text-amber-900' },
}

/** Kısa süreli bilgi/başarı bildirimi (sayfa üstünde) — web Notice'in portu. */
export function Notice({ tone = 'success', children, onDismiss }) {
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
export function Modal({ open, title, onClose, children, footer }) {
  const insets = useSafeAreaInsets()

  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
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
            girdilere dokunmayı yutmasın. */}
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Kapat" />

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              onPress={onClose}
              hitSlop={12}
              className="min-h-[32px] min-w-[32px] items-center justify-center"
            >
              <Text className="text-lg text-slate-400">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="shrink px-5 py-4" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>

          {footer && (
            <View className="flex-row justify-end gap-2 border-t border-slate-200 px-5 py-3">
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  )
}
