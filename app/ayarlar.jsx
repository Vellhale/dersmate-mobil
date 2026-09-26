import { Children, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { isRunningInExpoGo } from 'expo'
import * as Application from 'expo-application'
import { api } from '../src/lib/api'
import { profilDegisti } from '../src/lib/profilSurumu'
import { turuYenidenBaslat } from '../src/lib/tur'
import { brand, rose, slate } from '../src/lib/theme'
import { useAsync } from '../src/state/useAsync'
import { useAuth } from '../src/state/AuthContext'
import { useBildirim } from '../src/state/BildirimSaglayici'
import { useIzin } from '../src/state/IzinContext'
import {
  BilgiIkonu,
  CikisIkonu,
  KalemIkonu,
  KalkanIkonu,
  SagOkIkonu,
  UyariIkonu,
  ZilIkonu,
} from '../src/components/Ikonlar'
import {
  Button,
  Card,
  ErrorBox,
  Field,
  GeriDugmesi,
  Girdi,
  Loading,
  Modal,
  Notice,
  UstEtiket,
} from '../src/components/ui'

/*
  AYARLAR (/ayarlar, 2026-09-26) — Profilim'in sağ üstündeki dişliden açılan yığın ekranı.

  İLKE: Profil kişinin VİTRİNİ (Instagram düzeni), ayarlar tek bir yerde. Eskiden Profilim'in
  üstünde dört ayrı düğme bloğu (fotoğraf, düzenle, Derslerim/Arkadaşlarım, Bildirim
  ayarları, Yönetim paneli), altında Çıkış yap ve alt bilginin dibinde sönük bir "Hesabımı
  sil" vardı. Fotoğraf artık avatarın kamera rozetinde, Arkadaşlarım fotoğrafın altındaki
  hapta; Derslerim ve Yönetim zaten çekmecede. Kalan her şey burada.

  NEDEN ROTA, ALT SAYFA DEĞİL: satırların üçü kendisi katman açıyor (Profili düzenle,
  Hesabımı sil, Veri tercihleri → kökteki IzinSayfasi). Ayarlar da alt sayfa olsaydı iOS'ta
  iki RN Modal üst üste binerdi (bkz. IZIN_KAPANMA_SURESI ve ApproveModal kuralı). Rota
  ekranında her eylem TEK katman açar; geri tuşu, kenar kaydırma ve derin bağlantı
  (dersmate://ayarlar) kendiliğinden doğru çalışır ve yasal metinlerin tarif ettiği yol
  kararlı olur: "Profil › Ayarlar › Hesabımı sil / Bildirim ayarları / Veri tercihleri"
  (gizlilik §4 ve §7, IzinContext, BildirimIzniSorusu; web HesapSilme §1 de bu yolu
  anlatıyor, yani adlar ve sıra değişirse iki depoda metin değişir).

  Adres `/profil/ayarlar` DEĞİL: [userId] dinamik kardeşiyle karışırdı. Kök
  Stack.Protected listesinde ve tekil (app/_layout.jsx): dişliye iki kez basınca kopya
  itilmesin, oturumsuz açılmasın.

  YÖNETİM BURAYA KONMAZ: bir gezinme hedefi, ayar değil; çekmecede duruyor.

  ALT BİLGİ YOK: Hakkımızda, yasal metinler ve künye Profilim'in altındaki AltBilgi'de.
  Sayfa bağlantıları ile ayarlar ayrı şeyler (AltBilgi.jsx başındaki ilke).
*/

/*
  Sürüm: yüklü paketin kendi sürümü (app.json → version). Expo Go'da bu değer Expo Go'nun
  sürümü olurdu, web önizlemesinde null — ikisinde de satır çizilmiyor. Yanlış bir sürüm
  göstermek, hiç göstermemekten kötü: kullanıcı destek isterken o sayıyı söyleyecek.
*/
const SURUM = isRunningInExpoGo() ? null : Application.nativeApplicationVersion

export default function Ayarlar() {
  const router = useRouter()
  const guvenli = useSafeAreaInsets()
  const { session, logout } = useAuth()
  const { ayarlariAc } = useIzin()
  const { kayit } = useBildirim()

  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState(null)

  /* Veri tercihleri kökteki IzinSayfasi'ni (RN Modal) açıyor. Bu ekranda başka bir alt
     sayfa açıkken tetiklenmez: iki Modal üst üste iOS'ta ikincisini hiç göstermeyebiliyor.
     Satır o sırada alt sayfanın arkasında kaldığı için pratikte dokunulamıyor; koşul,
     klavye/erişilebilirlik gibi dolaylı yollar için sigorta. */
  function veriTercihleriniAc() {
    if (dialog) return
    ayarlariAc()
  }

  /*
    REHBERİ TEKRAR İZLE — tur Topluluk'ta ('/') açılıyor. Önce Ayarlar KAPATILIYOR: yalnızca
    navigate('/') deseydik `dangerouslySingular` Topluluk'u en üste taşır ama Ayarlar
    yığında onun altında kalırdı; turu bitirip geri tuşuna basan kullanıcı Ayarlar'a
    dönerdi. back() + navigate ile yığın [..., Profilim, Topluluk] olur ve geri Profil'e
    döner. Derin bağlantıyla açıldıysa (geri yok) doğrudan navigate.
  */
  function rehberiBaslat() {
    if (router.canGoBack()) router.back()
    router.navigate('/')
    turuYenidenBaslat()
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <GeriDugmesi
          accessibilityLabel="Profile dön"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profil'))}
        />
        <Text accessibilityRole="header" className="min-w-0 flex-1 text-lg font-bold text-slate-900">
          Ayarlar
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-5 p-4"
        contentContainerStyle={{ paddingBottom: guvenli.bottom + 16 }}
      >
        {notice && (
          <Notice tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}

        <AyarGrubu baslik="Hesap">
          <AyarSatiri
            Ikon={KalemIkonu}
            etiket="Profili düzenle"
            aciklama="Adın, hakkında yazın, okulun ve bölümün"
            onPress={() => setDialog('edit')}
          />
          {/* "Açık" YALNIZCA sunucu kaydı başarılıyken: izin + aydınlatma tek başına
              yetmiyor (Firebase dosyası yoksa token alınamıyor). Bildirim ayarları
              ekranındaki "Bildirimler açık" rozetiyle aynı kural (CLAUDE.md → Push). */}
          <AyarSatiri
            Ikon={ZilIkonu}
            etiket="Bildirim ayarları"
            aciklama="Hangi bildirimleri alacağını seç"
            deger={kayit?.kayitli ? 'Açık' : null}
            ok
            onPress={() => router.push('/bildirimler')}
          />
        </AyarGrubu>

        <AyarGrubu baslik="Gizlilik ve veri">
          <AyarSatiri
            Ikon={KalkanIkonu}
            etiket="Veri tercihleri"
            aciklama="Hangi verilerin işlendiğini gör, izinlerini değiştir"
            onPress={veriTercihleriniAc}
          />
        </AyarGrubu>

        <AyarGrubu baslik="Yardım">
          <AyarSatiri
            Ikon={BilgiIkonu}
            etiket="Rehberi tekrar izle"
            aciklama="Uygulamayı adım adım yeniden tanı"
            onPress={rehberiBaslat}
          />
        </AyarGrubu>

        {/* Onaysız, eski Profilim düğmesiyle aynı davranış: çıkış geri alınabilir bir
            işlem (yeniden giriş) ve kök guard'lar giriş ekranına kendisi geçiyor. */}
        <AyarGrubu baslik="Oturum">
          <AyarSatiri Ikon={CikisIkonu} etiket="Çıkış yap" onPress={logout} />
        </AyarGrubu>

        {/*
          HESABIMI SİL — Google Play, hesap açtıran uygulamalarda silmeyi UYGULAMA İÇİNDE
          zorunlu tutuyor; bulunabilir olmak ZORUNDA. Öne de çıkmamalı: geri alınamaz. Eskiden
          Profilim'in alt bilgisinin dibinde sönük bir bağlantıydı; artık Ayarlar'ın EN
          ALTINDA, kendi kartında ve tehlike tonunda (A düzeni: yıkıcı eylem = rose). Renk
          tek başına anlam taşımıyor: açıklama satırı ne olacağını söylüyor, asıl kapılar
          (neyin silinip neyin kaldığı ve parola) alt sayfada. Yol metni gizlilik §7'de ve
          web HesapSilme §1'de; ikincisi satırın YERİNİ de tarif ediyor (Ayarlar'ın en
          altı), yani buraya bir satır eklenecekse bu kartın üstüne eklenir.
        */}
        <AyarGrubu>
          <AyarSatiri
            Ikon={UyariIkonu}
            etiket="Hesabımı sil"
            aciklama="Hesabın ve kimlik bilgilerin kalıcı olarak silinir"
            ton="tehlike"
            onPress={() => setDialog('sil')}
          />
        </AyarGrubu>

        {SURUM ? (
          <Text className="text-center text-[12px] leading-[18px] text-slate-500">Sürüm {SURUM}</Text>
        ) : null}
      </ScrollView>

      <HesabiSilModali open={dialog === 'sil'} onClose={() => setDialog(null)} onDeleted={logout} />

      <ProfilDuzenleModali
        open={dialog === 'edit'}
        userId={session?.userId}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null)
          /* Profilim kök yığında kurulu ve kendiliğinden tazelenmiyor: sayaç, dönüşte
             görünümü yeniden kurduruyor (src/lib/profilSurumu.js). */
          profilDegisti()
          setNotice('Profilin güncellendi.')
        }}
      />
    </SafeAreaView>
  )
}

/*
  AYAR GRUBU — üst etiket + bölünmüş dolgulu kart (CLAUDE.md → "Dokunma ve yüzey dili":
  `<Card dolgu="p-0" className="overflow-hidden">`). Satırlar arasına ince ayırıcı; ilk
  satırda yok. Başlık 12px: rem cihazda 14 sayıldığı için text-xs 10.5dp çıkıyor.
*/
function AyarGrubu({ baslik, children }) {
  const satirlar = Children.toArray(children).filter(Boolean)
  return (
    <View>
      {baslik ? (
        <UstEtiket
          accessibilityRole="header"
          className="px-1 pb-2 text-[12px] font-semibold tracking-wide text-slate-500"
        >
          {baslik}
        </UstEtiket>
      ) : null}
      <Card dolgu="p-0" className="overflow-hidden">
        {satirlar.map((satir, i) => (
          <View key={satir.key ?? i} className={i > 0 ? 'border-t border-slate-100' : ''}>
            {satir}
          </View>
        ))}
      </Card>
    </View>
  )
}

/*
  AYAR SATIRI — ikon kutusu + etiket (+ açıklama) + isteğe bağlı değer ve ok.

  Ok (SagOkIkonu) yalnızca BAŞKA EKRANA geçen satırda: alt sayfa açan (Profili düzenle,
  Veri tercihleri, Hesabımı sil) ya da anında iş yapan (Çıkış yap) satırda yok.
  Açıklama `numberOfLines` almıyor: büyük yazıda sarıyor, satır büyüyor (min 56px).
  Değer bugün yalnızca olumlu bir durum ("Açık") taşıyor; rengi o rolden (A düzeni:
  olumlu durumun düz metni brand-700).

  Erişim adı etiket + değer ("Bildirim ayarları, Açık"), açıklama ipucu olarak okunuyor.
  İkon kutusu px ile (32): rem cihazda 14 sayılıyor.
*/
function AyarSatiri({ Ikon, etiket, aciklama, deger, ok = false, ton, onPress }) {
  const tehlike = ton === 'tehlike'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[etiket, deger].filter(Boolean).join(', ')}
      accessibilityHint={aciklama}
      onPress={onPress}
      className="min-h-[56px] flex-row items-center gap-3 px-4 py-2.5 active:bg-slate-50"
    >
      <View
        className={`h-[32px] w-[32px] shrink-0 items-center justify-center rounded-lg ${
          tehlike ? 'bg-rose-50' : 'bg-brand-50'
        }`}
      >
        <Ikon renk={tehlike ? rose[600] : brand[600]} boy={18} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`text-[15px] font-medium ${tehlike ? 'text-rose-700' : 'text-slate-900'}`}>
          {etiket}
        </Text>
        {aciklama ? (
          <Text className="mt-0.5 text-[13px] leading-[18px] text-slate-500">{aciklama}</Text>
        ) : null}
      </View>
      {deger ? <Text className="shrink-0 text-sm font-medium text-brand-700">{deger}</Text> : null}
      {ok ? <SagOkIkonu renk={slate[400]} boy={18} /> : null}
    </Pressable>
  )
}

/*
  HESABI SİL — geri alınamaz, bu yüzden iki kapı var: ne olacağını AÇIKÇA yazan bir metin
  ve parolanın yeniden girilmesi. Parola sunucuda da doğrulanıyor; buradaki alan onay
  niyetini kanıtlıyor, güvenliği tek başına buraya bırakmıyor.

  METİN NEYİN KALDIĞINI DA SÖYLÜYOR. "Her şey silinecek" demek yanlış olurdu: ders
  geçmişi, verilen puanlar ve değerlendirmeler KARŞI TARAFA ait ve duruyor — orada
  "Silinmiş kullanıcı" olarak görünüyorsun. Kullanıcıya olmayan bir şey vaat etmek,
  silme hakkını yanlış anlatmaktır.

  (2026-09-26'da app/profil/index.jsx'ten AYNEN taşındı; metin ve kilit değişmedi.
  "Silinecekler" listesi gizlilik §7'deki silme maddesiyle aynı olmalı.)
*/
function HesabiSilModali({ open, onClose, onDeleted }) {
  const [sifre, setSifre] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const kilit = useRef(false)

  useEffect(() => {
    if (open) {
      setSifre('')
      setError(null)
      kilit.current = false
    }
  }, [open])

  async function sil() {
    // Geri alınamaz işlemde çift gönderim koruması: ikinci istek 404 ile dönerdi ve
    // kullanıcı hesabı silindiği hâlde hata görürdü.
    if (kilit.current) return
    if (!sifre) {
      setError({ message: 'Devam etmek için parolanı yaz.' })
      return
    }

    kilit.current = true
    setBusy(true)
    setError(null)
    try {
      await api.deleteAccount(sifre)
      // Oturumu düşürmek yeterli: kök guard'lar giriş ekranına kendisi geçiyor.
      onDeleted()
    } catch (err) {
      kilit.current = false
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Hesabımı sil"
      footer={
        <>
          <Button variant="secondary" onPress={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="danger" loading={busy} onPress={sil}>
            Hesabımı kalıcı olarak sil
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Notice tone="danger">
          Bu işlem geri alınamaz. Hesabına bir daha giriş yapamazsın.
        </Notice>

        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-slate-900">Silinecekler</Text>
          {[
            'Adın, e-postan ve profil fotoğrafın',
            'Biyografin, üniversite ve bölüm bilgin',
            'Açtığın ders ilanları',
            'Veri tercihlerin ve cihaz kaydın',
            // Sunucu hesap silmede cihaz kayıtlarını, tercihleri ve bildirim defterini siliyor.
            'Bildirim ayarların, bildirim kayıtların ve bildirim alan cihazların',
          ].map((madde) => (
            <View key={madde} className="flex-row gap-2">
              <Text className="text-xs text-slate-400">•</Text>
              <Text className="flex-1 text-sm leading-relaxed text-slate-600">{madde}</Text>
            </View>
          ))}
        </View>

        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-slate-900">Kalacaklar</Text>
          {/* Topluluk cümlesi 2026-09-27: DeleteAccount forum içeriğine dokunmuyor, yalnızca
              adı "Silinmiş kullanıcı" yapıyor. Gizlilik §7 "Silme" ile aynı olgu. */}
          <Text className="text-sm leading-relaxed text-slate-600">
            Yaptığın dersler, kazandırdığın puanlar ve yazdığın değerlendirmeler karşı
            tarafın geçmişine ait olduğu için siliniyor değil — orada adın yerine
            "Silinmiş kullanıcı" görünecek. Topluluk’taki gönderilerin, yorumların ve
            oyların da kalacak; gönderi ve yorumlarında da adın yerine "Silinmiş kullanıcı"
            görünecek.
          </Text>
        </View>

        <Field label="Parolan" hint="Onay için parolanı yeniden yaz.">
          <Girdi
            value={sifre}
            onChangeText={setSifre}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={sil}
          />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* Web'deki EditProfileModal'ın portu: form yalnızca veri geldiğinde bir kez doldurulur,
   sonrası kullanıcının. Boş metinler null'a çevrilerek gönderilir (web ile aynı).
   (2026-09-26'da app/profil/index.jsx'ten AYNEN taşındı.) */
function ProfilDuzenleModali({ open, userId, onClose, onSaved }) {
  const profile = useAsync(
    () => (open ? api.userProfile(userId) : Promise.resolve(null)),
    [open, userId],
  )
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  /*
    VAZGEÇ GERÇEKTEN VAZGEÇSİN.

    `form` state'i modal kapandığında duruyordu ve `values = form ?? sunucuVerisi`
    her zaman taslağı tercih ettiği için modal, VAZGEÇİLEN metinlerle yeniden
    açılıyordu. Kullanıcı bunu sunucudaki kayıtlı bilgisi sanıp başka bir alanı
    düzeltip "Kaydet"e bastığında, iptal ettiğini sandığı değişiklik de kaydediliyordu.

    Açılışta sıfırlanıyor: her açılış sunucudaki gerçek veriden başlar.
  */
  useEffect(() => {
    if (open) {
      setForm(null)
      setError(null)
    }
  }, [open])

  const values = form ?? {
    displayName: profile.data?.displayName ?? '',
    bio: profile.data?.bio ?? '',
    university: profile.data?.university ?? '',
    department: profile.data?.department ?? '',
  }

  const set = (patch) => setForm({ ...values, ...patch })

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await api.updateProfile({
        displayName: values.displayName.trim(),
        bio: values.bio.trim() || null,
        university: values.university.trim() || null,
        department: values.department.trim() || null,
      })
      setForm(null)
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Profili düzenle"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            loading={busy}
            // Profil daha yüklenmeden kaydetmek, boş formu gerçek değerlerin üstüne
            // (bio/üniversite → null) ezerdi — veri gelene kadar kapalı.
            disabled={profile.loading || Boolean(profile.error) || values.displayName.trim().length < 2}
            onPress={submit}
          >
            Kaydet
          </Button>
        </>
      }
    >
      {/* Sessiz boş form YOK: çekim sürerken spinner, hata verdiyse yeniden denenebilir
          hata kutusu — kullanıcı bilgilerinin silinmediğini görmeli. */}
      {profile.loading ? (
        <Loading label="Profil yükleniyor…" />
      ) : profile.error ? (
        <View className="pb-2">
          <ErrorBox error={profile.error} onRetry={profile.reload} />
        </View>
      ) : (
      <View className="gap-4 pb-2">
        <Field label="Görünen ad">
          <Girdi value={values.displayName} onChangeText={(v) => set({ displayName: v })} maxLength={100} />
        </Field>

        <Field label="Hakkında" hint="Kendini birkaç cümleyle anlat — resmi olmasına gerek yok.">
          <Girdi
            value={values.bio}
            onChangeText={(v) => set({ bio: v })}
            maxLength={1000}
            multiline
            textAlignVertical="top"
            className="h-28"
            placeholder="Merhaba! Matematikte iyiyim, kimyada desteğe ihtiyacım var…"
          />
        </Field>

        <Field label="Üniversite / Lise">
          <Girdi value={values.university} onChangeText={(v) => set({ university: v })} maxLength={150} />
        </Field>

        <Field label="Bölüm / Alan">
          <Girdi value={values.department} onChangeText={(v) => set({ department: v })} maxLength={150} />
        </Field>

        <ErrorBox error={error} />
      </View>
      )}
    </Modal>
  )
}
