import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { api } from '../../src/lib/api'
import { useAsync } from '../../src/state/useAsync'
import { useAuth } from '../../src/state/AuthContext'
import { EkranBasligi } from '../../src/components/EkranBasligi'
import { ProfilGorunumu } from '../../src/components/ProfilGorunumu'
import { Button, ErrorBox, Field, Girdi, Loading, Modal, Notice } from '../../src/components/ui'
import { RehberiTekrarIzle } from '../../src/components/UrunTuru'
import { VeriTercihleriBaglantisi } from '../../src/components/IzinSayfasi'

/*
  PROFİLİM SEKMESİ — web'deki Profile.jsx'in "kendi profilim" hâli. Başkasının profili
  ayrı rotada (app/profil/[userId].jsx); web'deki "tek bileşen, iki rota" kararının
  mobil karşılığı: görünüm ProfilGorunumu'nda ortak, fark yalnızca düzenleme
  düğmelerinin ve çıkışın görünürlüğü.

  FOTOĞRAF DEĞİŞTİRME web'deki AvatarPicker'ın (canvas kırpma) mobil karşılığı:
  expo-image-picker kare kırpmayı sistem arayüzüyle yapar (allowsEditing) — canvas'a
  gerek yok. Alan adı web ile aynı: form.append('avatar', …).
*/
export default function Profil() {
  const router = useRouter()
  const { session, logout } = useAuth()

  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState(null)
  // Alt bileşenleri yeniden kurmak için: avatar/profil değişince taze veri okunsun.
  const [version, setVersion] = useState(0)

  async function fotografDegistir() {
    setAvatarError(null)

    const secim = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // kare kırpma — web'deki canvas kırpıcının sistem karşılığı
      aspect: [1, 1],
      quality: 0.9,
    })
    if (secim.canceled) return

    const foto = secim.assets[0]
    setAvatarBusy(true)
    try {
      /*
        KÜÇÜLTME İSTEMCİDE — web'in canvas adımının mobil karşılığı ve ATLANAMAZ.

        ImagePicker'ın allowsEditing + aspect [1,1] ayarı yalnızca KIRPIYOR, çözünürlüğü
        düşürmüyor: telefon kamerasıyla çekilmiş 4032×3024 bir fotoğraf kare kırpıldıktan
        sonra da ~3000×3000 kalıyor ve q90 JPEG'te 2-4 MB ediyor. Sunucu sınırı 2 MB
        (ProfileCommands.MaxAvatarBytes), controller sınırı 3 MB — yani normal bir telefon
        fotoğrafı reddediliyordu. 2-3 MB arası "Fotoğraf 2 MB'tan büyük", üstünde ise
        gövdesiz 413 yüzünden hiçbir şey açıklamayan bir hata görünüyordu; küçük dosyalar
        (ekran görüntüsü) geçtiği için sorun rastgele görünüyordu.

        Hedef web ile AYNI: 512×512 JPEG (AvatarPicker.jsx → OUTPUT_SIZE = 512).
      */
      const olcekli = await ImageManipulator.manipulate(foto.uri)
        .resize({ width: 512, height: 512 })
        .renderAsync()
      const kucuk = await olcekli.saveAsync({ compress: 0.85, format: SaveFormat.JPEG })

      const form = new FormData()
      form.append('avatar', {
        uri: kucuk.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      })
      await api.uploadAvatar(form)
      /*
        ÜÇ ADIM, ÜÇÜ DE GEREKLİ:
        1. Seçilen dosya hatırlanıyor — kullanıcı yeni fotoğrafı ANINDA görüyor ve bu,
           uzaktaki görselin önbellekten tazelenmesine hiç bağlı değil. (Önceki sürümde
           yükleme sunucuda başarılıydı ama ekranda değişiklik olmuyordu.)
        2. Sürüm sayacı artıyor — diğer ekranlardaki (akış, sohbet) avatarlar bir
           sonraki çizimde ?v= ile yeniden isteniyor.
        3. Görünüm yeniden kuruluyor — profil verisi tazeleniyor.
      */
      api.rememberLocalAvatar(session.userId, kucuk.uri)
      api.forgetAvatar(session.userId)
      setVersion((v) => v + 1)
      setNotice('Profil fotoğrafın güncellendi.')
    } catch (err) {
      setAvatarError(err)
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <EkranBasligi baslik="Profilim" />

      <ScrollView contentContainerClassName="gap-3 p-4">
        {notice && (
          <Notice tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}
        <ErrorBox error={avatarError} />

        <View className="flex-row gap-2">
          <Button variant="secondary" className="flex-1" loading={avatarBusy} onPress={fotografDegistir}>
            Fotoğrafı değiştir
          </Button>
          <Button className="flex-1" onPress={() => setDialog('edit')}>
            Profili düzenle
          </Button>
        </View>

        {/* Tab çubuğuna girmeyen iki bölümün ikinci girişi (ilki Akış başlığında):
            profil, "benimle ilgili her şey"in doğal toplanma yeri. */}
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/dersler')}
            className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white"
          >
            <Text className="text-sm font-medium text-slate-700">Derslerim</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/eslesmeler')}
            className="min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white"
          >
            <Text className="text-sm font-medium text-slate-700">Eşleşmelerim</Text>
          </Pressable>
        </View>

        {/* Yönetim girişi YALNIZCA yetkili hesapta çizilir. Asıl kapı sunucuda (403);
            buradaki koşul, yetkisi olmayana çalışmayan bir düğme göstermemek için. */}
        {session?.isAdmin && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/yonetim')}
            className="min-h-[44px] items-center justify-center rounded-xl border border-brand-200 bg-brand-50"
          >
            <Text className="text-sm font-medium text-brand-700">Yönetim paneli</Text>
          </Pressable>
        )}

        <ProfilGorunumu key={version} userId={session?.userId} kendiProfilim />

        <Button variant="secondary" onPress={logout}>
          Çıkış yap
        </Button>

        {/*
          ALTBİLGİ — web'deki Layout altbilgisinin karşılığı.

          Yasal metinlere uygulama İÇİNDEN erişim mağaza incelemesinin de beklediği bir
          şey; ayrıca kayıt ekranındaki onay bağlantıları buraya değil, doğrudan
          sayfalara gidiyor — kullanıcı sonradan da okuyabilmeli.
        */}
        <View className="mt-2 items-center gap-1 border-t border-slate-200 pt-4">
          <View className="flex-row flex-wrap items-center justify-center gap-x-4">
            <AltBaglanti onPress={() => router.push('/hakkimizda')}>Hakkımızda</AltBaglanti>
            <AltBaglanti onPress={() => router.push('/kosullar')}>Kullanım koşulları</AltBaglanti>
            <AltBaglanti onPress={() => router.push('/gizlilik')}>Gizlilik</AltBaglanti>
          </View>
          <View className="flex-row flex-wrap items-center justify-center gap-x-4">
            <VeriTercihleriBaglantisi />
            <RehberiTekrarIzle />
          </View>

          {/*
            HESABI SİL — Google Play, hesap açtıran uygulamalarda silmeyi UYGULAMA İÇİNDE
            zorunlu tutuyor, yani bu bağlantı bulunabilir olmak ZORUNDA. Ama öne de
            çıkmamalı: geri alınamaz bir işlem, "Çıkış yap"ın yanında eşit ağırlıkta
            durursa yanlışlıkla dokunulur. Çözüm: altbilginin en dibinde, ayrı bir
            satırda ve sönük — arayan bulur, aramayan çarpmaz.
          */}
          <View className="mt-2 items-center border-t border-slate-100 pt-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setDialog('sil')}
              className="min-h-[44px] justify-center px-2"
            >
              <Text className="text-sm text-slate-400">Hesabımı sil</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <HesabiSilModali open={dialog === 'sil'} onClose={() => setDialog(null)} onDeleted={logout} />

      <ProfilDuzenleModali
        open={dialog === 'edit'}
        userId={session?.userId}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null)
          setVersion((v) => v + 1)
          setNotice('Profilin güncellendi.')
        }}
      />
    </SafeAreaView>
  )
}

/** Altbilgi bağlantısı — 44px dokunma hedefi, ikincil ton. */
/*
  HESABI SİL — geri alınamaz, bu yüzden iki kapı var: ne olacağını AÇIKÇA yazan bir metin
  ve parolanın yeniden girilmesi. Parola sunucuda da doğrulanıyor; buradaki alan onay
  niyetini kanıtlıyor, güvenliği tek başına buraya bırakmıyor.

  METİN NEYİN KALDIĞINI DA SÖYLÜYOR. "Her şey silinecek" demek yanlış olurdu: ders
  geçmişi, verilen puanlar ve değerlendirmeler KARŞI TARAFA ait ve duruyor — orada
  "Silinmiş kullanıcı" olarak görünüyorsun. Kullanıcıya olmayan bir şey vaat etmek,
  silme hakkını yanlış anlatmaktır.
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
        <Notice tone="warning">
          Bu işlem geri alınamaz. Hesabına bir daha giriş yapamazsın.
        </Notice>

        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-slate-900">Silinecekler</Text>
          {[
            'Adın, e-postan, telefonun ve profil fotoğrafın',
            'Biyografin, üniversite ve bölüm bilgin',
            'Açtığın ders ilanları',
            'Veri tercihlerin ve cihaz kaydın',
          ].map((madde) => (
            <View key={madde} className="flex-row gap-2">
              <Text className="text-xs text-slate-400">•</Text>
              <Text className="flex-1 text-sm leading-relaxed text-slate-600">{madde}</Text>
            </View>
          ))}
        </View>

        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-slate-900">Kalacaklar</Text>
          <Text className="text-sm leading-relaxed text-slate-600">
            Yaptığın dersler, kazandırdığın puanlar ve yazdığın değerlendirmeler karşı
            tarafın geçmişine ait olduğu için siliniyor değil — orada adın yerine
            "Silinmiş kullanıcı" görünecek.
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

function AltBaglanti({ onPress, children }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="min-h-[44px] justify-center">
      <Text className="text-sm text-slate-500">{children}</Text>
    </Pressable>
  )
}

/* Web'deki EditProfileModal'ın portu: form yalnızca veri geldiğinde bir kez doldurulur,
   sonrası kullanıcının. Boş metinler null'a çevrilerek gönderilir (web ile aynı). */
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
