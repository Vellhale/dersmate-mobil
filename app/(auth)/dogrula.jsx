import { useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/lib/api'
import { AuthKabuk } from '../../src/components/AuthKabuk'
import { Button, ErrorBox, Field, Girdi, Notice } from '../../src/components/ui'

/*
  E-POSTA DOĞRULAMA — web'deki VerifyEmail.jsx'in portu.

  Web'de token URL query'sinden geliyordu; mobilde kayıt ekranındaki geliştirme
  kısayolu route parametresiyle taşır (useLocalSearchParams), üretimde kullanıcı
  e-postadaki token'ı elle yapıştırır.

  Yeniden gönderme bloğu web'deki gerekçeyle: token'ın ömrü 24 saat ve süresi
  dolduğunda bu ekran tek başına işe yaramıyordu — hesap kilitli kalırdı.
*/
export default function Dogrula() {
  const router = useRouter()
  const params = useLocalSearchParams()

  const [token, setToken] = useState(typeof params.token === 'string' ? params.token : '')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const [email, setEmail] = useState('')
  const [resendBusy, setResendBusy] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  async function onSubmit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setResult(await api.verifyEmail(token.trim()))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function onResend() {
    if (resendBusy) return
    setResendBusy(true)
    setError(null)
    try {
      const r = await api.resendVerification(email.trim())
      setResendDone(true)
      // Geliştirme ortamında sunucu token'ı döner; kullanıcı kopyalamakla uğraşmasın
      // diye doğrudan kutuya yazılır. Üretimde alan boş gelir, hiçbir şey değişmez.
      if (r?.verificationToken) setToken(r.verificationToken)
    } catch (err) {
      setError(err)
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <AuthKabuk title="E-posta doğrulama" subtitle="Doğrulama, hesabını etkinleştirir." altBilgi={false}>
      {result ? (
        <View className="gap-4">
          <Notice tone="success">
            E-postan doğrulandı 🎉 Artık eşleşme isteği gönderebilir ve ders rezerve edebilirsin.
          </Notice>
          <Button onPress={() => router.replace('/giris')}>Giriş yap</Button>
        </View>
      ) : (
        <View className="gap-6">
          <View className="gap-4">
            <Field label="Doğrulama token'ı" hint="E-postandaki bağlantıdan gelir.">
              <Girdi
                value={token}
                onChangeText={setToken}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
                className="h-28 font-mono text-xs"
              />
            </Field>

            <ErrorBox error={error} />

            <Button loading={busy} disabled={token.trim().length === 0} onPress={onSubmit}>
              Doğrula
            </Button>
          </View>

          <View className="gap-3 border-t border-slate-200 pt-5">
            <Text className="text-sm text-slate-600">
              <Text className="font-semibold">Bağlantın gelmedi mi ya da süresi doldu mu?</Text>{' '}
              Doğrulama bağlantısı 24 saat geçerlidir; e-postanı yaz, yenisini gönderelim.
            </Text>

            <Field label="E-posta">
              <Girdi
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </Field>

            {/* Yanıt her durumda aynı: e-posta kayıtlı olsun olmasın — aksi halde bu form,
                bir adresin platformda kayıtlı olup olmadığını herkese söylerdi. */}
            {resendDone && (
              <Notice tone="success">
                Bu adres kayıtlı ve henüz doğrulanmamışsa yeni bir bağlantı gönderdik. Gelen
                kutunu (ve spam klasörünü) kontrol et.
              </Notice>
            )}

            <Button
              variant="secondary"
              loading={resendBusy}
              disabled={email.trim().length < 5}
              onPress={onResend}
            >
              Yeniden gönder
            </Button>
          </View>

          <Button variant="ghost" onPress={() => router.back()}>
            Geri dön
          </Button>
        </View>
      )}
    </AuthKabuk>
  )
}
