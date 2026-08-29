import { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { api } from '../../src/lib/api'
import { SOZLESME_SURUMU } from '../../src/lib/yasalMetinler'
import { AuthKabuk } from '../../src/components/AuthKabuk'
import { Button, ErrorBox, Field, Girdi, Notice } from '../../src/components/ui'

/**
 * Onay kutusu — RN'de yerleşik checkbox yok.
 *
 * Kutunun KENDİSİ ve metni tek dokunma hedefi: onay metinlerinin içindeki bağlantılara
 * ayrıca basılabildiği için metin, kutuyu tetikleyen alanın dışında bırakılamazdı —
 * bağlantıya basmak kutuyu da işaretlerdi. Çözüm: dış Pressable yalnızca kutu +
 * metnin boş alanını kapsıyor, bağlantılar kendi onPress'leriyle üstte duruyor
 * (RN'de iç Text.onPress dıştaki Pressable'ı yutar).
 */
function OnayKutusu({ secili, onToggle, children }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: secili }}
      onPress={onToggle}
      className="min-h-[44px] flex-row items-start gap-2.5 py-1"
    >
      <View
        className={`mt-0.5 h-5 w-5 shrink-0 items-center justify-center rounded border-2
                    ${secili ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'}`}
      >
        {secili && <Text className="text-xs font-bold text-white">✓</Text>}
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  )
}

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
  const [kosullarKabul, setKosullarKabul] = useState(false)
  const [yasBeyani, setYasBeyani] = useState(false)
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
    if (!kosullarKabul || !yasBeyani) {
      setError({ message: 'Devam etmek için iki onay kutusunu da işaretlemelisin.' })
      return
    }

    setBusy(true)
    setError(null)
    try {
      /*
        ONAY SUNUCUYA GİDİYOR. `kosullarKabul` bir düğme durumu değil, kaydedilecek bir
        beyan: hangi metin sürümünü gördüğümüzü bildiriyoruz ve sunucu kendi yürürlükteki
        sürümüyle karşılaştırıp KENDİ değerini yazıyor (LegalDocuments.cs).

        Sürüm state'te tutulmuyor, gönderim anında sabitten okunuyor: kullanıcı formu
        açıkken metin güncellenirse göndermeye çalıştığı sürüm hâlâ GÖRDÜĞÜ sürüm olur ve
        sunucu bunu reddedip "uygulamayı güncelle" der. Doğru davranış bu.

        ⚠️ Bu iki alan olmadan sunucu kaydı REDDEDİYOR (Register.cs: AgeConfirmed ve
        TermsVersion zorunlu) — alanlar eklenene kadar mobilden hiç kayıt olunamıyordu.
      */
      setResult(
        await api.register({
          ...form,
          email: form.email.trim(),
          termsVersion: kosullarKabul ? SOZLESME_SURUMU : null,
          ageConfirmed: yasBeyani,
        }),
      )
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

        {/*
          ONAY VE YAŞ BEYANI.

          İKİ AYRI KUTU, tek kutu değil: biri sözleşmeyi kabul etmek, diğeri yaş beyanı.
          Tek kutuda birleştirilseydi kullanıcı ikisini de okumadan tek hareketle geçer
          ve hangisine onay verdiği ayrıştırılamazdı.

          Bağlantılar aynı yığında açılıyor (web'de yeni sekmedeydi): mobilde geri
          düğmesi kullanıcıyı forma döndürür ve doldurduğu alanlar yerinde kalır —
          web'deki "formu terk eden alanları kaybetmesin" gerekçesinin karşılığı.

          Kutuların pasif bıraktığı düğme yalnızca YÖNLENDİRME; asıl kapı sunucuda.
        */}
        <View className="gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <OnayKutusu secili={kosullarKabul} onToggle={() => setKosullarKabul((v) => !v)}>
            <Text className="text-sm leading-relaxed text-slate-700">
              Kullanım koşullarını ve gizlilik metnini okudum, kabul ediyorum.
            </Text>
          </OnayKutusu>

          {/*
            METİN BAĞLANTILARI KUTUNUN DIŞINDA ve ayrı düğmeler.

            Önce onay metninin İÇİNDE, iç içe Text.onPress ile duruyorlardı: dışardaki
            Pressable `accessible` olduğu için ekran okuyucu tüm bloğu TEK öğe okuyor ve
            içteki bağlantılara odaklanılamıyordu — yani metni okumadan onaylamak,
            ekran okuyucu kullanan için tek seçenekti. Ayrı satır hem erişilebilir hem
            de dokunma hedeflerini ayırıyor (yanlışlıkla onaylamak yerine metni açmak).
          */}
          <View className="flex-row flex-wrap items-center gap-x-4 pl-8">
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/kosullar')}
              className="min-h-[44px] justify-center"
            >
              <Text className="text-sm font-medium text-brand-700">Kullanım koşulları</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/gizlilik')}
              className="min-h-[44px] justify-center"
            >
              <Text className="text-sm font-medium text-brand-700">Gizlilik metni</Text>
            </Pressable>
          </View>

          <OnayKutusu secili={yasBeyani} onToggle={() => setYasBeyani((v) => !v)}>
            <Text className="text-sm leading-relaxed text-slate-700">
              18 yaşından büyüğüm ya da hesabımı velimin bilgisi ve onayıyla açıyorum.
            </Text>
          </OnayKutusu>
        </View>

        <ErrorBox error={error} />

        <Button
          loading={busy}
          disabled={!kosullarKabul || !yasBeyani}
          onPress={onSubmit}
        >
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
