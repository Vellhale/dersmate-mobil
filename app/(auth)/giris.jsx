import { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { AuthKabuk } from '../../src/components/AuthKabuk'
import { Button, ErrorBox, Field, Girdi } from '../../src/components/ui'
import { useAuth } from '../../src/state/AuthContext'

/*
  GİRİŞ — web'deki Login.jsx'in portu, AuthKabuk (bölünmüş tek ekran) içinde.

  Başarılı girişte navigate ÇAĞRILMAZ: kök yığındaki Stack.Protected guard'ı oturum
  gelince (tabs) grubuna kendisi geçer.

  Doğrulanmamış hesap çıkmaza girmesin (web kararı): EMAIL_NOT_VERIFIED kodunda
  doğrudan doğrulama ekranına yol verilir.
*/
export default function Giris() {
  const { login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const sifreRef = useRef(null)

  async function onSubmit() {
    // Busy koruması ŞART: düğme pasifken bile klavyenin "done" tuşu (onSubmitEditing)
    // bu fonksiyona doğrudan bağlı — korumasız hâli uçuştaki isteğin üstüne ikinci
    // bir login isteği bindiriyordu.
    if (busy) return

    // Web'de bu işi tarayıcının required/type=email doğrulaması yapıyordu; RN'de o
    // katman yok — boş alanları sunucuya taşımak turu sunucu hatasıyla kapatırdı.
    if (!email.trim() || !password) {
      setError({ message: 'E-posta ve şifreni yaz.' })
      return
    }

    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthKabuk title="Giriş yap" subtitle="Bilgini paylaş, ihtiyacın olan dersi ücretsiz al.">
      <View className="gap-4">
        <Field label="E-posta">
          <Girdi
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            // "İleri" gerçekten İLERLETMELİ: odak zinciri olmadan tuş yalnızca
            // klavyeyi kapatıyordu. submitBehavior klavyeyi açık tutar.
            submitBehavior="submit"
            onSubmitEditing={() => sifreRef.current?.focus()}
          />
        </Field>

        <Field label="Şifre">
          <Girdi
            ref={sifreRef}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        </Field>

        <ErrorBox error={error} />

        {/*
          DOĞRULANMAMIŞ HESABIN TEK ÇIKIŞI BURASI.

          Ayrı /dogrula ekranı kaldırıldı (2026-09-04); kod girişi artık kayıt ekranının
          ikinci adımı. `dogrula=1` o ekranı DOĞRUDAN kod adımında açıyor — kayıt formu
          görünmüyor, çünkü kullanıcının zaten hesabı var.

          Adres parametreyle taşınıyor: doğrulama, kodun yanında e-posta da istiyor
          (6 hane kullanıcıya özgü değil, sunucu "kimin için" sorusunu bilmek zorunda) ve
          buraya kadar gelen kullanıcı adresini az önce yazdı. Yeniden yazdırmak, hatanın
          hemen ardında gereksiz bir sürtünme olurdu.
        */}
        {error?.code === 'EMAIL_NOT_VERIFIED' && (
          <Button
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/kayit', params: { dogrula: '1', email: email.trim() } })
            }
          >
            E-postamı doğrula
          </Button>
        )}

        <Button loading={busy} onPress={onSubmit}>
          Giriş yap
        </Button>
      </View>

      {/* Parola sıfırlama bağlantısı FORMUN HEMEN ALTINDA, "Kayıt ol"dan da ÖNCE (web
          kararı): buraya gelip giremeyen kullanıcının ilk ihtiyacı yeni hesap açmak
          değil, kendi hesabına dönmek. Sıfırlama yolu gelene kadar parolasını unutan
          kullanıcı hesabını kalıcı kaybediyordu. */}
      <View className="mt-4 flex-row justify-center">
        <Link href="/sifre-sifirla" asChild>
          <Pressable accessibilityRole="link" hitSlop={12}>
            <Text className="text-sm font-medium text-brand-600">Şifreni mi unuttun?</Text>
          </Pressable>
        </Link>
      </View>

      <View className="mt-2 flex-row justify-center">
        <Text className="text-sm text-slate-600">Hesabın yok mu? </Text>
        <Link href="/kayit" asChild>
          <Pressable accessibilityRole="link" hitSlop={12}>
            <Text className="text-sm font-medium text-brand-600">Kayıt ol</Text>
          </Pressable>
        </Link>
      </View>

      {/*
        "E-postanı henüz doğrulamadın mı? → Doğrulama" bağlantısı KALDIRILDI (2026-09-04).

        Boşa çıkan bir yoldu: kod, kime ait olduğu bilinmeden doğrulanamıyor, yani o ekran
        kullanıcıdan adresi yeniden yazmasını istiyordu. Oysa giriş denemesi aynı bilgiyi
        zaten topluyor ve doğrulanmamış hesapta EMAIL_NOT_VERIFIED ile yukarıdaki düğmeyi
        adres DOLU olarak çıkarıyor. İki yoldan biri her zaman daha fazla iş istiyordu.

        Kaldırmak aynı zamanda "doğrulama" diye ayrı bir alan hissini bitiriyor: doğrulama
        artık kayıt akışının bir adımı, ayrı bir sayfa değil.
      */}
    </AuthKabuk>
  )
}
