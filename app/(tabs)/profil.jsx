import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { api } from '../../src/lib/api'
import { useAsync } from '../../src/state/useAsync'
import { useAuth } from '../../src/state/AuthContext'
import { EkranBasligi } from '../../src/components/EkranBasligi'
import { ProfilGorunumu } from '../../src/components/ProfilGorunumu'
import { Button, ErrorBox, Field, Girdi, Loading, Modal, Notice } from '../../src/components/ui'

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
      const form = new FormData()
      form.append('avatar', {
        uri: foto.uri,
        name: foto.fileName ?? 'avatar.jpg',
        type: foto.mimeType ?? 'image/jpeg',
      })
      await api.uploadAvatar(form)
      // Önbellekteki eski avatar düşürülmeli, yoksa değişiklik görünmez (web kararı).
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

        <ProfilGorunumu key={version} userId={session?.userId} kendiProfilim />

        <Button variant="secondary" onPress={logout}>
          Çıkış yap
        </Button>
      </ScrollView>

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
