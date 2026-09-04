import { useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/lib/api'
import { AuthKabuk } from '../../src/components/AuthKabuk'
import { Button, ErrorBox, Field, Girdi, Notice } from '../../src/components/ui'

/*
  PAROLA SIFIRLAMA — web'deki SifreSifirla.jsx'in portu. TEK EKRAN, İKİ KİP.

  Web'de kipi adres belirliyordu (`?token=` varsa YENİ PAROLA, yoksa BAĞLANTI İSTE).
  Mobilde adres çubuğu yok: token ya derin bağlantının route parametresinden gelir
  (useLocalSearchParams) ya da kullanıcı e-postadaki token'ı ELLE yapıştırır —
  kayit.jsx'in doğrulama adımının da kullandığı kalıp. Kip bu yüzden URL'e değil bir
  duruma bağlı.

  Web'in "iki ayrı sayfa yazmayalım" gerekçesi mobilde daha da güçlü: token'ı
  kaybeden kullanıcı aynı ekrandan yeni bağlantı isteyebilmeli, e-postası eline
  geçen kullanıcı da başka ekran aramadan token'ını yapıştırabilmeli. Bu yüzden
  iki kip arasındaki geçiş HER İKİ YÖNDE de açık bir düğme olarak duruyor; web'de
  bunu adres satırı ve iki bağlantı yapıyordu.

  ─── KULLANICI NUMARALANDIRMASI ──────────────────────────────────────────────
  "Bağlantı gönderildi" mesajı, e-posta kayıtlı olsun olmasın AYNI (sunucu da her
  durumda 204 dönüyor). Mesajın dili bu belirsizliği gizlemiyor, AÇIKÇA söylüyor
  ("kayıtlıysa"): kullanıcı e-postanın neden gelmediğini anlayabilmeli, ama biz bir
  adresin platformda kayıtlı olup olmadığını kimseye doğrulamamalıyız.
  ─────────────────────────────────────────────────────────────────────────────
*/
export default function SifreSifirla() {
  const params = useLocalSearchParams()
  const tokenParam = typeof params.token === 'string' ? params.token : ''

  // Derin bağlantıyla token geldiyse doğrudan yeni parola kipi. Aksi halde bağlantı
  // isteme kipi: bu ekrana giriş sayfasından gelen kullanıcının elinde token yoktur.
  const [kip, setKip] = useState(tokenParam ? 'yeni' : 'iste')

  return kip === 'yeni' ? (
    <YeniParola ilkToken={tokenParam} onBaglantiIste={() => setKip('iste')} />
  ) : (
    <BaglantiIste onTokenVar={() => setKip('yeni')} />
  )
}

function BaglantiIste({ onTokenVar }) {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [gonderildi, setGonderildi] = useState(false)
  const [error, setError] = useState(null)

  // Kilit ref'te, state'te DEĞİL: klavyenin "gönder" tuşu da bu fonksiyona bağlı ve
  // state bir sonraki render'a kadar eski değerini gösterir — iki hızlı basış ikinci
  // bir istek yollayıp hız sınırını (429) kullanıcının kendi eliyle tetikletirdi.
  const gonderiliyor = useRef(false)

  async function gonder() {
    if (gonderiliyor.current) return

    // Web'de bu işi tarayıcının required/type=email doğrulaması yapıyordu; RN'de o
    // katman yok ve klavyenin "gönder" tuşu düğme pasifken bile buraya düşüyor.
    if (email.trim().length < 5) {
      setError({ message: 'E-posta adresini yaz.' })
      return
    }

    gonderiliyor.current = true
    setBusy(true)
    setError(null)
    try {
      await api.forgotPassword(email.trim())
      setGonderildi(true)
    } catch (err) {
      // 429 (hız sınırı) buraya düşer ve GÖSTERİLİR: sessizce "gönderildi" demek,
      // kullanıcıyı hiç gelmeyecek bir e-postayı beklemeye bırakırdı.
      setError(err)
    } finally {
      gonderiliyor.current = false
      setBusy(false)
    }
  }

  return (
    <AuthKabuk
      title="Şifreni mi unuttun?"
      subtitle="E-postanı yaz, sıfırlama bağlantısı gönderelim."
      // Puan/ücretsizlik alt bilgisi burada kapalı: ekran zaten iki bloklu ve uzun,
      // kayit.jsx'in doğrulama adımı da aynı gerekçeyle kapatıyor.
      altBilgi={false}
    >
      <View className="gap-6">
        <View className="gap-4">
          <Field label="E-posta">
            <Girdi
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={gonder}
            />
          </Field>

          {gonderildi && (
            <Notice tone="success">
              Bu adres kayıtlı ve doğrulanmışsa sıfırlama bağlantısını gönderdik. Gelen
              kutunu ve spam klasörünü kontrol et — bağlantı{' '}
              <Text className="font-semibold">1 saat</Text> geçerli.
            </Notice>
          )}

          <ErrorBox error={error} />

          <Button loading={busy} disabled={email.trim().length < 5} onPress={gonder}>
            Sıfırlama bağlantısı gönder
          </Button>
        </View>

        {/*
          Token kipine geçiş HER ZAMAN açık, yalnızca gönderimden sonra değil: web'de
          e-postadaki bağlantı kullanıcıyı doğrudan token'lı adrese düşürüyordu, mobilde
          böyle bir garanti yok. Uygulamayı kapatıp e-postasını okuduktan sonra dönen
          kullanıcı, sırf token kutusuna ulaşmak için ikinci bir bağlantı istemek
          zorunda kalmamalı (istese de hız sınırına takılabilir).
        */}
        <View className="gap-3 border-t border-slate-200 pt-5">
          <Text className="text-sm text-slate-600">
            <Text className="font-semibold">Bağlantı e-postan geldi mi?</Text> İçindeki
            token'ı bu ekrana yapıştırıp yeni parolanı belirleyebilirsin.
          </Text>
          <Button variant="secondary" onPress={onTokenVar}>
            Token'ım var, parolamı belirleyeyim
          </Button>
        </View>

        {/* back() değil replace(): bu ekrana derin bağlantıyla gelen kullanıcının
            yığınında geri dönecek bir ekran olmayabilir. */}
        <Button variant="ghost" onPress={() => router.replace('/giris')}>
          Girişe dön
        </Button>
      </View>
    </AuthKabuk>
  )
}

function YeniParola({ ilkToken, onBaglantiIste }) {
  const router = useRouter()

  const [token, setToken] = useState(ilkToken)
  const [parola, setParola] = useState('')
  const [tekrar, setTekrar] = useState('')
  const [busy, setBusy] = useState(false)
  const [bitti, setBitti] = useState(false)
  const [error, setError] = useState(null)
  const tekrarRef = useRef(null)

  // Kilit ref'te: token TEK KULLANIMLIK. İki hızlı basışta ikinci istek, ilki parolayı
  // çoktan değiştirmişken "token geçersiz" hatasıyla dönerdi — parola aslında
  // değişmişken kullanıcı ekranda hata görür, yeni parolasına güvenmezdi.
  const degistiriliyor = useRef(false)

  // Sunucudaki kuralla AYNI (ResetPasswordHandler.MinParolaUzunlugu) ve kayıt ekranıyla
  // da aynı. İstemci kontrolü sunucununkinin yerine geçmiyor, yalnızca kullanıcıyı
  // gidip gelmekten kurtarıyor.
  const yeterliUzunluk = parola.length >= 8
  const esitler = parola === tekrar
  const gonderilebilir = token.trim().length > 0 && yeterliUzunluk && esitler

  async function gonder() {
    if (degistiriliyor.current || !gonderilebilir) return

    degistiriliyor.current = true
    setBusy(true)
    setError(null)
    try {
      // Token trim'lenir: e-postadan kopyalanan metin baş/son boşluk ya da satır sonu
      // taşıyor ve ham hâli sunucuda geçersiz token olarak dönüyordu.
      await api.resetPassword(token.trim(), parola)
      setBitti(true)
    } catch (err) {
      setError(err)
    } finally {
      degistiriliyor.current = false
      setBusy(false)
    }
  }

  if (bitti) {
    return (
      <AuthKabuk
        title="Parolan değişti"
        subtitle="Yeni parolanla giriş yapabilirsin."
        altBilgi={false}
      >
        <View className="gap-4">
          <Notice tone="success">
            Parolan güncellendi. Sıfırlama bağlantısı artık geçersiz.
          </Notice>
          <Button onPress={() => router.replace('/giris')}>Giriş yap</Button>
        </View>
      </AuthKabuk>
    )
  }

  return (
    <AuthKabuk
      title="Yeni parola belirle"
      subtitle="Bağlantı yalnızca bir kez kullanılabilir."
      altBilgi={false}
    >
      <View className="gap-6">
        <View className="gap-4">
          {/* Çok satırlı, mono ve düzeltmesiz: uzun bir dizgeyi yapıştırmak için
              tasarlandı, yazmak için değil.

              ⚠️ PAROLA SIFIRLAMA HÂLÂ TOKEN'LA, e-posta doğrulaması gibi 6 haneli
              koda GEÇMEDİ — sunucu burada tek kullanımlık bir token bekliyor
              (ResetPasswordRequest). İki akış artık farklı; bu kutuyu "doğrulama
              ekranıyla aynı" diye kod girdisine çevirme. */}
          <Field label="Sıfırlama token'ı" hint="E-postandaki bağlantıdan gelir.">
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

          <Field label="Yeni parola" hint="En az 8 karakter.">
            <Girdi
              value={parola}
              onChangeText={setParola}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              // "İleri" gerçekten İLERLETMELİ (giris.jsx dersi): odak zinciri olmadan
              // tuş yalnızca klavyeyi kapatıyor. submitBehavior klavyeyi açık tutar.
              submitBehavior="submit"
              onSubmitEditing={() => tekrarRef.current?.focus()}
            />
          </Field>

          <Field label="Yeni parola (tekrar)">
            <Girdi
              ref={tekrarRef}
              value={tekrar}
              onChangeText={setTekrar}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={gonder}
            />
          </Field>

          {/* Uyarı yalnızca kullanıcı ikinci kutuya YAZMAYA BAŞLADIKTAN sonra: boş kutuyu
              "eşleşmiyor" diye işaretlemek, henüz hata yapmamış birini uyarmak olurdu. */}
          {tekrar.length > 0 && !esitler && (
            <Text className="text-sm text-rose-700">İki parola aynı değil.</Text>
          )}

          <ErrorBox error={error} />

          <Button loading={busy} disabled={!gonderilebilir} onPress={gonder}>
            Parolayı değiştir
          </Button>
        </View>

        <View className="gap-3 border-t border-slate-200 pt-5">
          <Text className="text-sm text-slate-600">
            <Text className="font-semibold">Bağlantının süresi mi doldu?</Text> Token 1 saat
            geçerlidir ve yalnızca bir kez kullanılır; yenisini isteyebilirsin.
          </Text>
          <Button variant="secondary" onPress={onBaglantiIste}>
            Yeni bağlantı iste
          </Button>
        </View>

        <Button variant="ghost" onPress={() => router.replace('/giris')}>
          Girişe dön
        </Button>
      </View>
    </AuthKabuk>
  )
}
