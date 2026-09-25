import { useRouter } from 'expo-router'
import {
  Bolum,
  Kalin,
  Madde,
  Maddeler,
  MetinBaglantisi,
  MetinSayfasi,
  Paragraf,
} from '../src/components/MetinSayfasi'
import { ISLETMECI, ISLETMECI_ALAN_ADI, MARKA } from '../src/lib/kunye'
import { SOZLESME_TARIHI } from '../src/lib/yasalMetinler'

/*
  KULLANIM KOŞULLARI — web'deki pages/Kosullar.jsx'in portu. Metin neredeyse birebir:
  kurallar backend'de yaşıyor ve backend iki istemci için de aynı.

  Metin ürünün GERÇEK kurallarını anlatıyor, genel bir şablon değil:
    • Ders almak ücretsiz, ders puanı yalnızca ANLATANA basılıyor ve harcanmıyor
      (CreditLedgerService — tek bacaklı işlem, escrow yok)
    • Topluluk'ta net oy eşiği de puan basıyor (CommunityRewardRules,
      MintCommunityRewardAsync)
    • Kazanılan puan (ders ve topluluk) YANMIYOR: iki basımda da CreditLot.ExpiresAtUtc
      = null (CreditLedgerService → MintLessonRewardAsync, MintCommunityRewardAsync)
    • Ders kanıtla kapanıyor, 48 saatte otomatik onaylanıyor (AutoApproveHours)
    • Yaptırım ölçeği: uyarı / süreli askı / kalıcı ban + cihaz banı
      (ApplySanction, BanUser)

  ⚠️ TUTULAMAYACAK SÖZ VERME KURALI: bu sayfada anlatılan her mekanizmanın kodda
  karşılığı var. Bir maddeyi değiştirmeden önce kodun hâlâ öyle davrandığını doğrula.

  ⚠️ §3 2026-09-25 SÜRÜMÜNÜN İÇİNDE DÜZELTİLDİ (2026-09-26, yayından önce; web'le aynı
  metin). Önceki hâli sunucuyla çelişiyordu: "puan YALNIZCA ders anlatana yazılır" (oysa
  Topluluk oyları da puan basıyor) ve "kazanılan puan 30 günde yanar" (oysa ders kazancı
  vadesiz açılıyor; EconomyOptions.EarnedCreditValidityDays hâlâ tanımlı ama hiçbir kod
  onu okumuyor).
  SOZLESME_SURUMU ARTMADI: 2026-09-25 henüz hiçbir yerde yayında değil (üç yer de main'e
  birleşmemiş dallarda), bu metni kabul etmiş kullanıcı yok (bkz. src/lib/yasalMetinler.js).

  "Kazandığın puan" bilerek böyle: kayıtta tanımlanan hoş geldin hediyesi
  (WelcomeBonus) HÂLÂ vadeli (WelcomeCreditValidityDays) ve süresi dolunca yakılıyor.
  O bir kazanç değil hediye ve unvana da sayılmıyor; ama "puan yanmaz" diye genel bir
  cümle, kullanıcının kendi puan geçmişindeki eksi satırla çelişirdi. Madde bu yüzden
  kaynağı adıyla sayıyor.

  MOBİLE ÖZGÜ TEK EKLEME §6'da: arkadaşlığı tek taraflı sonlandırma. Web metninde yok ama
  kodda VAR (closeMatch — app/eslesmeler.jsx) ve mağaza incelemesinin kullanıcı üretimli
  içerik için aradığı "rahatsız eden kişiyle iletişimi kesebilme" şartının karşılığı bu.
  Var olan bir yeteneği yazmak vaat değil, tarif. Cümle ekranı ADIYLA anıyor: o dosyanın
  başlığı değişirse bu metin de değişmeli.

  2026-09-10: web #31'in ürün geneli yeniden adlandırması (arkadaşlık) buraya taşındı.
  "Yeni mesaj gelmez" SONLANDIRILAN kaydın sohbeti için doğru: sohbet tek bir kayda bağlı
  (Conversation.MatchId), CloseMatch yalnızca onu kapatıyor ve yazma o kaydın durumuna
  bakıyor (ConversationAccess.GetForWriteAsync). Aynı çiftin başka konuda kabul edilmiş
  bir kaydı varsa arkadaşlık onun üzerinden sürer, onun sohbeti açık kalır. Kişiyle
  iletişimi TÜMDEN kesen yol engelleme (SendMessageHandler engeli sohbetten bağımsız
  sınıyor); o Gizlilik §6'da anlatılıyor ve burada ayrıca vaat edilmedi.
*/
export default function Kosullar() {
  const router = useRouter()

  return (
    <MetinSayfasi
      baslik="Kullanım koşulları"
      ozet="dersmate'i kullanırken geçerli kurallar ve karşılıklı beklentiler."
      sonGuncelleme={SOZLESME_TARIHI}
    >
      <Bolum no="1" baslik="dersmate nedir">
        <Paragraf>
          {MARKA}, öğrencilerin birbirine ders anlattığı bir akran öğrenme platformudur.
          Burada öğretmen değil akran vardır: anlatan da öğrenen de öğrencidir. Platform,
          dersin içeriğinden veya kalitesinden sorumlu değildir; yalnızca insanları
          buluşturur ve kayıt tutar.
        </Paragraf>
        {/*
          2026-09-21'de eklendi (web'le aynı). Kullanım koşulları İKİ TARAF arasındaki
          sözleşmedir ve taraflardan biri buraya kadar isimsizdi: §7'deki sorumluluk
          sınırı ve §6'daki yaptırım yetkisi, kimin adına kullanıldığı belli olmayan
          haklardı.
        */}
        <Paragraf>
          {MARKA}, <Kalin>{ISLETMECI}</Kalin> ({ISLETMECI_ALAN_ADI}) tarafından
          işletilmektedir. Bu metindeki “biz” ve “{MARKA}” ifadeleri {ISLETMECI}’i anlatır.
          Künye ve iletişim bilgileri sayfanın altındadır.
        </Paragraf>
      </Bolum>

      <Bolum no="2" baslik="Hesabın">
        <Maddeler>
          <Madde>Gerçek bir e-posta adresiyle kayıt olur ve adresini doğrularsın.</Madde>
          <Madde>Hesabını başkasıyla paylaşamaz, başkası adına hesap açamazsın.</Madde>
          <Madde>18 yaşından küçüksen hesabını velinin bilgisi ve onayıyla açmalısın.</Madde>
          <Madde>Şifrenin güvenliği senin sorumluluğunda.</Madde>
        </Maddeler>
      </Bolum>

      <Bolum no="3" baslik="Para ve puan">
        <Paragraf>
          <Kalin>Platformda para dolaşmaz.</Kalin> Ders almak ücretsizdir; kimse kimseye
          ödeme yapmaz ve dersmate senden ücret almaz.
        </Paragraf>
        <Maddeler>
          <Madde>
            Puan, onaylanan dersin <Kalin>anlatanına</Kalin> yazılır: her 30 dakikalık blok
            için 50 puan. Topluluk’ta yeterli net oy toplayan katkıların da puan kazandırır.
          </Madde>
          <Madde>
            Puan <Kalin>harcanmaz</Kalin>. Ders almak için puana ihtiyacın yok; puan yalnızca
            seviyeni ve profilindeki görünürlüğünü belirler.
          </Madde>
          <Madde>
            Ders anlatarak ve Topluluk katkılarınla kazandığın puanın{' '}
            <Kalin>süresi dolmaz</Kalin>; bu puan yanmaz.
          </Madde>
          <Madde>Puanın nakit veya başka bir değerle karşılığı yoktur, devredilemez.</Madde>
        </Maddeler>
      </Bolum>

      <Bolum no="4" baslik="Dersler">
        <Maddeler>
          <Madde>
            Ders saatini ve görüşme bağlantısını taraflar kendi aralarında sohbet üzerinden
            kararlaştırır.
          </Madde>
          <Madde>
            Ders bittikten sonra anlatan taraf kanıt yükler; karşı taraf onaylar. 48 saat
            içinde yanıt gelmezse ders otomatik olarak onaylanmış sayılır.
          </Madde>
          <Madde>
            Sahte kanıt yüklemek ağır bir ihlaldir. Aynı görselin birden fazla derste
            kullanılması sistem tarafından tespit edilir.
          </Madde>
        </Maddeler>
      </Bolum>

      <Bolum no="5" baslik="Yasak davranışlar">
        <Maddeler>
          <Madde>Hakaret, taciz, ayrımcılık, tehdit.</Madde>
          <Madde>Telif hakkı olan kitap, soru bankası, deneme veya PDF paylaşmak.</Madde>
          <Madde>Reklam, satış, yönlendirme bağlantısı ve spam.</Madde>
          <Madde>
            Başkasının kişisel bilgisini (telefon, adres, sosyal hesap) izinsiz paylaşmak.
          </Madde>
          <Madde>Sahte kanıt, sahte hesap ve sistemi yanıltmaya yönelik her davranış.</Madde>
          <Madde>18 yaşından küçük kullanıcılara yönelik uygunsuz her türlü iletişim.</Madde>
        </Maddeler>
      </Bolum>

      <Bolum no="6" baslik="Şikayet ve yaptırımlar">
        <Paragraf>
          Bir kullanıcıyı ders ekranından şikayet edebilirsin. Şikayetin yalnızca yönetime
          gider; şikayet ettiğin kişi ne şikayeti görür ne de kim olduğunu öğrenir.
        </Paragraf>
        <Paragraf>
          Rahatsız eden biriyle iletişimi kesmek için yönetimi beklemek zorunda değilsin:
          arkadaşlığı Arkadaşlar ekranından tek taraflı sonlandırabilirsin. Sonlandırılan
          arkadaşlıktan sana yeni mesaj gelmez.
        </Paragraf>
        <Paragraf>Yönetimin uygulayabileceği yaptırımlar:</Paragraf>
        <Maddeler>
          <Madde>
            <Kalin>Uyarı</Kalin> — hesap açık kalır, karar kayda geçer.
          </Madde>
          <Madde>
            <Kalin>Süreli askı</Kalin> — belirtilen süre boyunca giriş yapılamaz.
          </Madde>
          <Madde>
            <Kalin>Kalıcı ban</Kalin> — hesap ve kullanıcının bilinen cihazları kapatılır.
            Bu, yeni hesap açarak devam etmeyi de engeller.
          </Madde>
        </Maddeler>
        <Paragraf>
          Ağır ihlallerde (taciz, sahte kanıt, telif ihlali) doğrudan en üst yaptırım
          uygulanabilir.
        </Paragraf>
      </Bolum>

      <Bolum no="7" baslik="Sorumluluk sınırı">
        <Paragraf>
          dersmate, kullanıcıların birbirine anlattığı içeriğin doğruluğundan, derslerin
          gerçekleşmesinden ve kullanıcılar arasındaki anlaşmazlıklardan sorumlu değildir.
          Platform “olduğu gibi” sunulur; kesintisiz çalışacağı garanti edilmez.
        </Paragraf>
        <Paragraf>
          Görüşmeler taraflarca seçilen üçüncü taraf araçlar üzerinden yapılır; o araçların
          kendi koşulları geçerlidir.
        </Paragraf>
      </Bolum>

      <Bolum no="8" baslik="Hesabın kapatılması">
        <Paragraf>
          Bu koşulları ihlal eden hesapları kapatabiliriz. Sen de hesabının silinmesini
          isteyebilirsin — nasıl olacağı Gizlilik metninin 7. bölümünde yazıyor.
        </Paragraf>
        <MetinBaglantisi etiket="Gizlilik metnini aç" onPress={() => router.push('/gizlilik')} />
      </Bolum>

      <Bolum no="9" baslik="Değişiklikler">
        <Paragraf>
          Koşullar değişirse bu sayfadaki tarihi güncelliyoruz. Önemli bir değişiklikte
          kullanıcıları ayrıca bilgilendiriyoruz.
        </Paragraf>
      </Bolum>
    </MetinSayfasi>
  )
}
