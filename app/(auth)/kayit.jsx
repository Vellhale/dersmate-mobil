import { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { api } from '../../src/lib/api'
import { AuthKabuk } from '../../src/components/AuthKabuk'
import { Button, ErrorBox, Field, Girdi, Notice } from '../../src/components/ui'

/*
  KAYIT — web'deki Register.jsx'in portu.

  Kayıt sonrası iki dal (web ile aynı):
  • Geliştirme ortamında sunucu verificationToken döner — kullanıcı tek dokunuşla
    doğrulama ekranına token'la gider (üretimde alan gelmez, dal hiç görünmez).
  • Üretimde e-postadaki token doğrulama ekranına elle yapıştırılır.
*/
export default function Kayit() {
  const router = useRouter()

  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const emailRef = useRef(null)
  const sifreRef = useRef(null)

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit() {
    // Busy koruması: klavyenin "done" tuşu bu fonksiyona doğrudan bağlı — korumasız
    // hâli uçuştaki kaydın üstüne ikinci bir istek bindirip duplicate hata üretiyordu.
    if (busy) return

    // Web'de tarayıcının required/type=email/minLength doğrulamasıydı; RN'de o katman
    // yok — kısa şifreyi sunucuya taşımak turu sunucu hatasıyla kapatırdı.
    if (!form.displayName.trim()) {
      setError({ message: 'Adını yaz.' })
      return
    }
    if (!/\S+@\S+\.\S+/.test(form.email.trim())) {
      setError({ message: 'Geçerli bir e-posta adresi yaz.' })
      return
    }
    if (form.password.length < 8) {
      setError({ message: 'Şifre en az 8 karakter olmalı.' })
      return
    }

    setBusy(true)
    setError(null)
    try {
      setResult(await api.register({ ...form, email: form.email.trim() }))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <AuthKabuk title="Kayıt alındı" subtitle="Son adım: e-postanı doğrula." altBilgi={false}>
        <View className="gap-4">
          <Notice tone="info">
            Doğrulama bağlantısı {form.email} adresine gönderildi. Doğrulamayı tamamlayınca
            hesabın etkinleşir ve eşleşme isteği gönderebilirsin.
          </Notice>

          {result.verificationToken ? (
            <>
              <Text className="text-sm text-slate-600">
                Geliştirme ortamında token doğrudan burada gösterilir (gerçek kurulumda
                yalnızca e-postaya gider):
              </Text>
              <Button
                onPress={() =>
                  router.push({ pathname: '/dogrula', params: { token: result.verificationToken } })
                }
              >
                E-postamı şimdi doğrula
              </Button>
            </>
          ) : (
            <Text className="text-sm text-slate-600">
              E-postandaki doğrulama token'ını doğrulama ekranına yapıştır.
            </Text>
          )}

          <Button variant="secondary" onPress={() => router.replace('/giris')}>
            Giriş sayfasına dön
          </Button>
        </View>
      </AuthKabuk>
    )
  }

  return (
    <AuthKabuk title="Kayıt ol" subtitle="İyi olduğun dersi anlat, ihtiyacın olanı ücretsiz al.">
      <View className="gap-4">
        <Field label="Ad Soyad">
          <Girdi
            value={form.displayName}
            onChangeText={(v) => update('displayName', v)}
            maxLength={100}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        </Field>

        <Field label="E-posta">
          <Girdi
            ref={emailRef}
            value={form.email}
            onChangeText={(v) => update('email', v)}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => sifreRef.current?.focus()}
          />
        </Field>

        <Field label="Şifre" hint="En az 8 karakter.">
          <Girdi
            ref={sifreRef}
            value={form.password}
            onChangeText={(v) => update('password', v)}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        </Field>

        <ErrorBox error={error} />

        <Button loading={busy} onPress={onSubmit}>
          Hesap oluştur
        </Button>
      </View>

      <View className="mt-4 flex-row justify-center">
        <Text className="text-sm text-slate-600">Zaten hesabın var mı? </Text>
        <Link href="/giris" asChild>
          <Pressable accessibilityRole="link" hitSlop={12}>
            <Text className="text-sm font-medium text-brand-600">Giriş yap</Text>
          </Pressable>
        </Link>
      </View>
    </AuthKabuk>
  )
}
