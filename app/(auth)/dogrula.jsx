import { useEffect, useReducer, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/lib/api'
import { kalanBeklemeSn, kodGonderildiIsaretle } from '../../src/lib/dogrulamaKodu'
import { AuthKabuk } from '../../src/components/AuthKabuk'
import { Button, ErrorBox, Field, Girdi, Notice } from '../../src/components/ui'

/** Sunucudaki EmailVerificationRules ile aynı olmalı. */
const KOD_UZUNLUK = 6
const KOD_DAKIKA = 15

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

  /*
    Parametre YALNIZCA kutuyu ön-doldurur; başka hiçbir şeye karar vermez. Bir ara
    geri sayımı da bu değer belirliyordu — bkz. aşağıdaki uyarı.

    expo-router bir parametreyi iki kez taşıyan adreste dizi döndürebiliyor; tür
    kontrolü o yüzden var, `String(params.email)` yeterli değil (dizi "a,b" olurdu).
  */
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

    ⚠️ BU BİR SÜS DEĞİL, GERÇEK BİR KUSURUN ÇARESİ. Gerekçenin tamamı
    src/lib/dogrulamaKodu.js başında; özeti: sunucu dakikada bir posta gönderiyor ve
    sınırı SESSİZCE uyguluyor, o yüzden kalan süreyi yalnızca istemci bilebilir.

    ⚠️ SAYAÇ "NEREDEN GELDİĞİNE" DEĞİL, KODUN GERÇEKTEN GÖNDERİLDİĞİ ANA BAĞLI.
    Bir ara `kayittanGeldi` (yani yalnızca `email` parametresinin varlığı) sayacı
    doldurmak için kullanılıyordu ve YANLIŞTI: giriş ekranı da EMAIL_NOT_VERIFIED
    dalında bu ekrana `email` yollayor ama o yolda HİÇBİR kod gönderilmiyor
    (Login.cs yalnızca hata fırlatıyor). Sonuç, kodu bir hafta önce ölmüş kullanıcının
    60 saniye boşuna bekletilmesiydi — hem de "Yeni kod gönder (60 sn)" etiketi kod az
    önce gönderilmiş gibi dururken.

    Kalan süre her render'da damgadan HESAPLANIYOR, bir sayaçtan düşülmüyor. Böylece
    kullanıcı adresi elle değiştirdiğinde de doğru cevap çıkıyor: damga o adrese
    aitse kalan süre görünür, değilse bekleme yok.
  */
  const [tik, tikla] = useReducer((n) => n + 1, 0)
  const bekleme = kalanBeklemeSn(email)

  /*
    Tetikleyici `tik`, `bekleme` DEĞİL: iki ardışık ölçüm aynı tam sayıya yuvarlanırsa
    (yarım saniyelik kayma) `bekleme`ye bağlı bir effect yeniden koşmaz ve geri sayım
    ekranda donardı. 500 ms, saniyelik değişimi kaçırmayacak kadar sık.
  */
  useEffect(() => {
    if (bekleme <= 0) return
    const t = setTimeout(tikla, 500)
    return () => clearTimeout(t)
  }, [tik, bekleme])

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
      // Gönderim GERÇEKLEŞTİ: damga buradan atılıyor, geri sayım damgadan türüyor.
      kodGonderildiIsaretle(email.trim())
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

                ⚠️ SINIR `maxLength` İLE DEĞİL, SÜZGECİN İÇİNDE. maxLength yerli
                katmanda uygulanıyor (iOS RCTBaseTextInputView, Android
                InputFilter.LengthFilter) ve metni onChangeText'e ULAŞMADAN kırpıyor.
                İkisi birlikte kullanılınca yapıştırma sessizce bozuluyordu:

                  pano " 042713" → maxLength 6'ya kırpar → " 04271" → süzgeç → "04271"

                Kutuda beş hane kalıyor, "Doğrula" kapalı ve kullanıcıya neyin eksik
                olduğunu söyleyen hiçbir şey yok. Kod e-postada kendi satırında durduğu
                için baştaki boşluğu da kapan seçim OLAĞAN durum. Önce rakamları süz,
                SONRA altıya in.

                Rakam dışı her karakter siliniyor: bazı Android klavyeleri sayı tuş
                takımında da boşluk/virgül verebiliyor ve kullanıcı fark etmediği bir
                karakter yüzünden "kod yanlış" alırdı — üstelik yanlış deneme sayacı
                (5 hakta kod iptal) o denemeyi de sayardı.

                OTOMATİK DOLDURMA İKİ PLATFORMDA DA AÇIK:
                  • textContentType="oneTimeCode" → iOS
                  • autoComplete="email-otp"      → Android
                `email-otp` tam olarak "e-postayla gelen tek kullanımlık kod" demek
                (RN 0.86'da Android'e özgü değerler arasında). Bir ara burada "off"
                yazıyordu ve gerekçesi "Android'de karşılığı yok" idi — YANLIŞTI;
                "off" Android'in otomatik doldurmasını kapatıyordu. `sms-otp` ise
                gerçekten yanlış olurdu: o, SMS dinler.

                inputAccessoryViewButtonLabel: iOS'un sayı tuş takımında return tuşu
                yok, RN returnKeyType verilince üstte bir araç çubuğu çiziyor ve
                düğme metnini İngilizce "Done" olarak SABİT yazıyor. Klavyeyi
                kapatmanın tek yolu o düğme; etiketi Türkçeleştirilmezse ekrandaki tek
                İngilizce metin olurdu. (Android'de bu prop yok sayılıyor; orada IME
                tuşu zaten sistem dilinde.)
              */}
              <Girdi
                value={kod}
                onChangeText={(v) => setKod(v.replace(/\D/g, '').slice(0, KOD_UZUNLUK))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="email-otp"
                autoCorrect={false}
                placeholder="000000"
                returnKeyType="done"
                inputAccessoryViewButtonLabel="Bitti"
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
