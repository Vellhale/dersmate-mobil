import { useEffect, useReducer, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/lib/api'
import { kalanBeklemeSn, kodGonderildiIsaretle } from '../../src/lib/dogrulamaKodu'
import { SOZLESME_SURUMU } from '../../src/lib/yasalMetinler'
import { AuthKabuk } from '../../src/components/AuthKabuk'
import { Button, ErrorBox, Field, Girdi, Notice } from '../../src/components/ui'

/** Sunucudaki EmailVerificationRules ile aynı olmalı. */
const KOD_UZUNLUK = 6
const KOD_DAKIKA = 15

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
  KAYIT VE E-POSTA DOĞRULAMA — TEK EKRAN, İKİ ADIM.

  ─── AYRI /dogrula EKRANI NEDEN KALDIRILDI (2026-09-04) ─────────────────────────

  Akış üç ekrandı: form → "Kayıt alındı" ara ekranı → düğme → /dogrula. Tek iş için üç
  ekran ve ortadaki hiçbir iş yapmıyordu; yalnızca "şimdi de şuraya git" diyordu.

  Şimdi kayıt başarılı olunca AYNI ekran kod girişine dönüşüyor: gezinme yok, geri
  yığını yok, adres parametreyle taşınmıyor (zaten state'te duruyor).

  ⚠️ ADIM URL'E DEĞİL DURUMA BAĞLI. Rota olarak ayrılsaydı geri düğmesi kullanıcıyı
  doldurulmuş forma geri atardı ve "Hesap oluştur" ikinci kez basılabilir hâle gelirdi —
  sunucu bunu duplicate ile reddeder, kullanıcı da neden reddedildiğini anlamaz.
  sifre-sifirla.jsx aynı gerekçeyle aynı kalıbı kullanıyor.

  ─── GİRİŞTEN GELEN YOL ─────────────────────────────────────────────────────────

  Doğrulanmamış hesapla giriş denemesi EMAIL_NOT_VERIFIED veriyor ve giris.jsx oraya bir
  düğme koyuyor. O düğme buraya `?dogrula=1&email=...` ile geliyor ve ekran DOĞRUDAN 2.
  adımda açılıyor — kayıt formu hiç görünmüyor. Yani "doğrulama" ayrı bir alan değil,
  bu ekranın bir durumu.

  Dünkü kullanıcının hesabına dönebilmesi bu yola bağlı; ayrı ekranı silerken bu yol
  kurulmasaydı doğrulanmamış hesap KALICI olarak kilitlenirdi: doğrulanmadan giriş
  kapalı, aynı e-postayla yeniden kayıt da kapalı.
*/
export default function Kayit() {
  const router = useRouter()
  const params = useLocalSearchParams()

  /*
    expo-router bir parametreyi iki kez taşıyan adreste DİZİ döndürebiliyor; tür kontrolü
    o yüzden var, String(params.email) yeterli değil (dizi "a,b" olurdu).
  */
  const giristenDogrulama = params.dogrula === '1'
  const gelenEposta = typeof params.email === 'string' ? params.email : ''

  const [adim, setAdim] = useState(giristenDogrulama ? 'kod' : 'form')
  const [form, setForm] = useState({
    email: giristenDogrulama ? gelenEposta : '',
    password: '',
    displayName: '',
  })
  const [kod, setKod] = useState('')

  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [resendBusy, setResendBusy] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  const [kosullarKabul, setKosullarKabul] = useState(false)
  const [yasBeyani, setYasBeyani] = useState(false)
  const emailRef = useRef(null)
  const sifreRef = useRef(null)

  const eposta = form.email.trim()

  /*
    ─── GERİ SAYIM: SUNUCUNUN SESSİZ BEKLEMESİNİ GÖRÜNÜR KILIYOR ────────────────

    ⚠️ BU BİR SÜS DEĞİL, GERÇEK BİR KUSURUN ÇARESİ. Gerekçenin tamamı
    src/lib/dogrulamaKodu.js başında; özeti: sunucu dakikada bir posta gönderiyor ve
    sınırı SESSİZCE uyguluyor (varlık sızdırmamak için), o yüzden kalan süreyi yalnızca
    istemci bilebilir.

    ⚠️ SAYAÇ "NEREDEN GELİNDİĞİNE" DEĞİL, KODUN GERÇEKTEN GÖNDERİLDİĞİ ANA BAĞLI.
    Bir ara yalnızca `email` parametresinin varlığı sayacı dolduruyordu ve YANLIŞTI:
    giriş ekranı EMAIL_NOT_VERIFIED dalında buraya adres yolluyor ama o yolda HİÇBİR kod
    gönderilmiyor (Login.cs yalnızca hata fırlatıyor). Sonuç, kodu bir hafta önce ölmüş
    kullanıcının 60 saniye boşuna bekletilmesiydi — hem de "Yeni kod gönder (60 sn)"
    etiketi kod az önce gönderilmiş gibi dururken.

    Kalan süre her render'da damgadan HESAPLANIYOR, bir sayaçtan düşülmüyor.
  */
  const [tik, tikla] = useReducer((n) => n + 1, 0)
  const bekleme = adim === 'kod' ? kalanBeklemeSn(eposta) : 0

  /*
    Tetikleyici `tik`, `bekleme` DEĞİL: iki ardışık ölçüm aynı tam sayıya yuvarlanırsa
    (yarım saniyelik kayma) `bekleme`ye bağlı bir effect yeniden koşmaz ve geri sayım
    ekranda donardı. 500 ms, saniyelik değişimi kaçırmayacak kadar sık.
  */
  useEffect(() => {
    if (bekleme <= 0) return undefined
    const t = setTimeout(tikla, 500)
    return () => clearTimeout(t)
  }, [tik, bekleme])

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onKayit() {
    // Busy koruması: klavyenin "done" tuşu bu fonksiyona doğrudan bağlı — korumasız hâli
    // uçuştaki kaydın üstüne ikinci bir istek bindirip duplicate hata üretiyordu.
    if (busy) return

    // Web'de tarayıcının required/type=email/minLength doğrulamasıydı; RN'de o katman
    // yok — kısa şifreyi sunucuya taşımak turu sunucu hatasıyla kapatırdı.
    if (!form.displayName.trim()) {
      setError({ message: 'Adını yaz.' })
      return
    }
    if (!/\S+@\S+\.\S+/.test(eposta)) {
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
      const sonuc = await api.register({
        ...form,
        email: eposta,
        termsVersion: kosullarKabul ? SOZLESME_SURUMU : null,
        ageConfirmed: yasBeyani,
      })

      /*
        Kayıt başarılıysa sunucu doğrulama kodunu GÖNDERDİ (Register.cs). Damga, "yeni kod
        gönder" beklemesinin tek doğru kaynağı.
      */
      kodGonderildiIsaretle(eposta)

      // Geliştirmede sunucu kodu yanıtta döndürüyor; kullanıcı e-postaya bakmasın diye
      // doğrudan kutuya yazılıyor. Üretimde bu alan BOŞ gelir ve hiçbir şey değişmez.
      if (sonuc?.verificationToken) setKod(sonuc.verificationToken)

      setAdim('kod')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const kodGonderilebilir = eposta.length >= 5 && kod.length === KOD_UZUNLUK

  async function onDogrula() {
    if (busy || !kodGonderilebilir) return
    setBusy(true)
    setError(null)
    try {
      await api.verifyEmail(eposta, kod)
      setAdim('bitti')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function onYenidenGonder() {
    if (resendBusy || bekleme > 0) return
    setResendBusy(true)
    setError(null)
    try {
      const r = await api.resendVerification(eposta)
      setResendDone(true)
      // Gönderim GERÇEKLEŞTİ: damga buradan atılıyor, geri sayım damgadan türüyor.
      kodGonderildiIsaretle(eposta)
      if (r?.verificationToken) setKod(r.verificationToken)
    } catch (err) {
      setError(err)
    } finally {
      setResendBusy(false)
    }
  }

  /* ─── 3. ADIM: DOĞRULANDI ──────────────────────────────────────────────────── */
  if (adim === 'bitti') {
    return (
      <AuthKabuk
        title="E-postan doğrulandı"
        subtitle="Hesabın etkin. Artık eşleşme isteği gönderebilirsin."
        altBilgi={false}
      >
        <View className="gap-4">
          <Notice tone="success">
            Hesabın açıldı 🎉 Giriş yapıp ilk dersini ayarlayabilirsin.
          </Notice>
          <Button onPress={() => router.replace('/giris')}>Giriş yap</Button>
        </View>
      </AuthKabuk>
    )
  }

  /* ─── 2. ADIM: KOD GİRİŞİ (gezinme yok, aynı ekran) ────────────────────────── */
  if (adim === 'kod') {
    return (
      <AuthKabuk
        title="E-postanı doğrula"
        subtitle="Son adım — kodu gir, hesabın açılsın."
        altBilgi={false}
      >
        <View className="gap-6">
          <View className="gap-4">
            <Notice tone="info">
              <Text className="font-semibold">{KOD_UZUNLUK} haneli kod</Text> {eposta} adresine
              gönderildi. Kodu girince hesabın etkinleşir.
            </Notice>

            <Field label="Doğrulama kodu" hint={`E-postandaki ${KOD_UZUNLUK} haneli sayı.`}>
              {/*
                keyboardType="number-pad": telefonda doğrudan sayı tuş takımı açılıyor.
                Değer STRING olarak tutuluyor ve öyle gönderiliyor — sayıya çevrilseydi
                baştaki sıfırlar kırpılırdı, oysa "004271" geçerli bir koddur (sunucu D6
                ile üretiyor) ve kırpılırsa eşleşme tutmaz.

                ⚠️ SINIR `maxLength` İLE DEĞİL, SÜZGECİN İÇİNDE. maxLength yerli katmanda
                uygulanıyor (iOS RCTBaseTextInputView, Android InputFilter.LengthFilter) ve
                metni onChangeText'e ULAŞMADAN kırpıyor. İkisi birlikte kullanılınca
                yapıştırma sessizce bozuluyordu:

                  pano " 042713" → maxLength 6'ya kırpar → " 04271" → süzgeç → "04271"

                Kutuda beş hane kalıyor, "Doğrula" kapalı ve kullanıcıya neyin eksik
                olduğunu söyleyen hiçbir şey yok. Kod e-postada kendi satırında durduğu için
                baştaki boşluğu da kapan seçim OLAĞAN durum. Önce rakamları süz, SONRA
                altıya in.

                Rakam dışı her karakter siliniyor: bazı Android klavyeleri sayı tuş
                takımında da boşluk/virgül verebiliyor ve kullanıcı fark etmediği bir
                karakter yüzünden "kod yanlış" alırdı — üstelik yanlış deneme sayacı
                (5 hakta kod iptal) o denemeyi de sayardı.

                OTOMATİK DOLDURMA İKİ PLATFORMDA DA AÇIK:
                  • textContentType="oneTimeCode" → iOS
                  • autoComplete="email-otp"      → Android
                `email-otp` tam olarak "e-postayla gelen tek kullanımlık kod" demek. Bir ara
                burada "off" yazıyordu ve gerekçesi "Android'de karşılığı yok" idi —
                YANLIŞTI; "off" Android'in otomatik doldurmasını KAPATIYORDU. `sms-otp` ise
                gerçekten yanlış olurdu: o, SMS dinler.

                inputAccessoryViewButtonLabel: iOS'un sayı tuş takımında return tuşu yok, RN
                returnKeyType verilince üstte bir araç çubuğu çiziyor ve düğme metnini
                İngilizce "Done" olarak SABİT yazıyor. Etiketi Türkçeleştirilmezse ekrandaki
                tek İngilizce metin olurdu. (Android'de bu prop yok sayılıyor.)
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
                onSubmitEditing={onDogrula}
                className="text-center text-lg font-semibold tracking-[0.3em]"
              />
            </Field>

            <ErrorBox error={error} />

            <Button loading={busy} disabled={!kodGonderilebilir} onPress={onDogrula}>
              Doğrula
            </Button>
          </View>

          <View className="gap-3 border-t border-slate-200 pt-5">
            <Text className="text-sm text-slate-600">
              <Text className="font-semibold">Kod gelmedi mi ya da süresi doldu mu?</Text> Kod{' '}
              {KOD_DAKIKA} dakika geçerlidir; yenisini gönderelim.
            </Text>

            {/* Yanıt her durumda aynı: e-posta kayıtlı olsun olmasın — aksi halde bu düğme,
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
              disabled={eposta.length < 5 || bekleme > 0}
              onPress={onYenidenGonder}
            >
              {bekleme > 0 ? `Yeni kod gönder (${bekleme} sn)` : 'Yeni kod gönder'}
            </Button>
          </View>

          {/*
            ÇIKIŞ YOLU — ve iki durumda İKİ FARKLI yol olmak zorunda.

            Kayıttan gelindiyse en olası arıza yanlış yazılmış adrestir (kod hiç gelmez),
            çaresi forma dönüp düzeltmek. Girişten gelindiyse dönülecek bir form yok: adres
            zaten kayıtlı hesabın adresi ve kullanıcının isteyeceği şey giriş ekranı.

            Tek düğmeye indirgenirse durumların biri mutlaka yanlış yere gider.
          */}
          {giristenDogrulama ? (
            <Button variant="ghost" onPress={() => router.replace('/giris')}>
              Giriş sayfasına dön
            </Button>
          ) : (
            <Button
              variant="ghost"
              onPress={() => {
                setError(null)
                setKod('')
                setResendDone(false)
                setAdim('form')
              }}
            >
              Adresi düzelt
            </Button>
          )}
        </View>
      </AuthKabuk>
    )
  }

  /* ─── 1. ADIM: KAYIT FORMU ─────────────────────────────────────────────────── */
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
            onSubmitEditing={onKayit}
          />
        </Field>

        {/*
          ONAY VE YAŞ BEYANI.

          İKİ AYRI KUTU, tek kutu değil: biri sözleşmeyi kabul etmek, diğeri yaş beyanı.
          Tek kutuda birleştirilseydi kullanıcı ikisini de okumadan tek hareketle geçer ve
          hangisine onay verdiği ayrıştırılamazdı.

          Bağlantılar aynı yığında açılıyor (web'de yeni sekmedeydi): mobilde geri düğmesi
          kullanıcıyı forma döndürür ve doldurduğu alanlar yerinde kalır.

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
            içteki bağlantılara odaklanılamıyordu — yani metni okumadan onaylamak, ekran
            okuyucu kullanan için tek seçenekti.
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

        <Button loading={busy} disabled={!kosullarKabul || !yasBeyani} onPress={onKayit}>
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
