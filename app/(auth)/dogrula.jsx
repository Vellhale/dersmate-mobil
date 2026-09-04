import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/lib/api'
import { AuthKabuk } from '../../src/components/AuthKabuk'
import { Button, ErrorBox, Field, Girdi, Notice } from '../../src/components/ui'

/** Sunucudaki EmailVerificationRules ile aynı olmalı. */
const KOD_UZUNLUK = 6
const KOD_DAKIKA = 15
const YENIDEN_BEKLEME_SN = 60

/*
  E-POSTA DOĞRULAMA — web'deki VerifyEmail.jsx'in portu.

  ─── BAĞLANTI YERİNE KOD (2026-09-02) ───────────────────────────────────────────

  Bu ekran eskiden bir JWT yapıştırma kutusuydu ve MOBİLDE ZATEN ZORDU: kullanıcının
  posta uygulamasına geçip 300 karakterlik bir dizeyi kopyalayıp geri dönmesi
  gerekiyordu. Sunucu 2 Eylül'de 6 haneli koda geçti; bu ekran o güne kadar eski
  sözleşmeyi (token) göndermeye devam etti, yani mobilden HİÇ KİMSE hesabını
  doğrulayamıyordu — doğrulanmadan giriş de kapalı olduğu için yeni kayıt tamamen
  kilitliydi.

  E-POSTA DA İSTENİYOR ve bu bir zahmet değil zorunluluk: 6 hane kullanıcıya özgü
  değil, aynı anda yüzlerce hesapta aynı kod olabilir. Sunucu "bu kodu kimin için
  deniyorsun" sorusunun cevabını bilmek zorunda.

  ADRES ÖNCEDEN DOLU GELİYOR: kayıt ekranı buraya `email` parametresiyle yönlendiriyor,
  yani kullanıcı az önce yazdığı adresi ikinci kez yazmıyor. Doğrudan gelen (geri
  dönen, giriş ekranından sapan) kullanıcı için kutu boş ve düzenlenebilir kalıyor.
*/
export default function Dogrula() {
  const router = useRouter()
  const params = useLocalSearchParams()

  const kayittanGeldi = typeof params.email === 'string' && params.email.length > 0

  const [email, setEmail] = useState(kayittanGeldi ? params.email : '')
  const [kod, setKod] = useState(typeof params.kod === 'string' ? params.kod : '')

  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const [resendBusy, setResendBusy] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  /*
    ─── GERİ SAYIM: SUNUCUNUN SESSİZ BEKLEMESİNİ GÖRÜNÜR KILIYOR ────────────────

    ⚠️ BU BİR SÜS DEĞİL, GERÇEK BİR KUSURUN ÇARESİ. Sunucu aynı adrese dakikada
    birden fazla doğrulama postası göndermiyor (EmailVerificationRules
    .ResendCooldownSeconds) ve bunu SESSİZCE yapıyor — hata döndürmüyor, çünkü
    "biraz bekle" demek o adresin kayıtlı olduğunu söylerdi (bu ucun tüm tasarımı
    varlık sızdırmamak üzerine kurulu).

    Kullanıcı açısından sonuç şuydu: kodu göremeyen kişi "Yeni kod gönder"e basıyor,
    arayüz "gönderdik" diyor ve HİÇBİR ŞEY GÖNDERİLMİYOR. Kayıttan sonraki ilk
    dakika, tam olarak bu düğmeye basılma olasılığının en yüksek olduğu an.

    Çare düğmeyi İSTEMCİDE kilitlemek: sayaç cihazda tutuluyor, sunucuya hiç
    sorulmuyor, yani varlık bilgisi sızmıyor.

    Kayıttan geliniyorsa sayaç DOLU başlıyor: kod az önce gönderildi.
  */
  const [bekleme, setBekleme] = useState(kayittanGeldi ? YENIDEN_BEKLEME_SN : 0)

  useEffect(() => {
    if (bekleme <= 0) return
    const t = setTimeout(() => setBekleme((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [bekleme])

  const gonderilebilir = email.trim().length >= 5 && kod.trim().length === KOD_UZUNLUK

  async function onSubmit() {
    if (busy || !gonderilebilir) return
    setBusy(true)
    setError(null)
    try {
      setResult(await api.verifyEmail(email.trim(), kod.trim()))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function onResend() {
    if (resendBusy || bekleme > 0) return
    setResendBusy(true)
    setError(null)
    try {
      const r = await api.resendVerification(email.trim())
      setResendDone(true)
      setBekleme(YENIDEN_BEKLEME_SN)
      // Geliştirmede sunucu kodu yanıtta döndürüyor; kullanıcı e-postaya bakmasın diye
      // doğrudan kutuya yazılıyor. Üretimde bu alan BOŞ gelir ve hiçbir şey değişmez.
      if (r?.verificationToken) setKod(r.verificationToken)
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
            <Field label="E-posta" hint="Kodu gönderdiğimiz adres.">
              <Girdi
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
              />
            </Field>

            <Field label="Doğrulama kodu" hint={`E-postandaki ${KOD_UZUNLUK} haneli sayı.`}>
              {/*
                keyboardType="number-pad": telefonda doğrudan sayı tuş takımı açılıyor,
                kullanıcı klavye değiştirmiyor. Değer STRING olarak tutuluyor ve öyle
                gönderiliyor — sayıya çevrilseydi baştaki sıfırlar kırpılırdı, oysa
                "004271" geçerli bir koddur (sunucu D6 ile üretiyor) ve kırpılırsa
                eşleşme tutmaz.

                Rakam dışı her karakter anında siliniyor: bazı Android klavyeleri sayı
                tuş takımında da boşluk/virgül verebiliyor ve kullanıcı fark etmediği
                bir karakter yüzünden "kod yanlış" alırdı — üstelik yanlış deneme
                sayacı (5 hakta kod iptal) o denemeyi de sayardı.

                textContentType="oneTimeCode": iOS kodu klavyenin üstünde önerip tek
                dokunuşla dolduruyor. Android tarafında karşılığı YOK ve bilerek
                eklenmedi: autoComplete="sms-otp" SMS dinler, bu kod ise e-postayla
                geliyor — çalışmayacak bir ipucu vermek yerine kapatıldı.
              */}
              <Girdi
                value={kod}
                onChangeText={(v) => setKod(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={KOD_UZUNLUK}
                textContentType="oneTimeCode"
                autoComplete="off"
                autoCorrect={false}
                placeholder="000000"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                className="text-center text-lg font-semibold tracking-[0.3em]"
              />
            </Field>

            <ErrorBox error={error} />

            <Button loading={busy} disabled={!gonderilebilir} onPress={onSubmit}>
              Doğrula
            </Button>
          </View>

          <View className="gap-3 border-t border-slate-200 pt-5">
            <Text className="text-sm text-slate-600">
              <Text className="font-semibold">Kod gelmedi mi ya da süresi doldu mu?</Text> Kod{' '}
              {KOD_DAKIKA} dakika geçerlidir; e-postanı yaz, yenisini gönderelim.
            </Text>

            {/* Yanıt her durumda aynı: e-posta kayıtlı olsun olmasın — aksi halde bu form,
                bir adresin platformda kayıtlı olup olmadığını herkese söylerdi. */}
            {resendDone && (
              <Notice tone="success">
                Bu adres kayıtlı ve henüz doğrulanmamışsa yeni bir kod gönderdik. Gelen
                kutunu (ve spam klasörünü) kontrol et.
              </Notice>
            )}

            <Button
              variant="secondary"
              loading={resendBusy}
              disabled={email.trim().length < 5 || bekleme > 0}
              onPress={onResend}
            >
              {bekleme > 0 ? `Yeni kod gönder (${bekleme} sn)` : 'Yeni kod gönder'}
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
