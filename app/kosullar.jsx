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
import { SOZLESME_TARIHI } from '../src/lib/yasalMetinler'

/*
  KULLANIM KOŞULLARI — web'deki pages/Kosullar.jsx'in portu. Metin neredeyse birebir:
  kurallar backend'de yaşıyor ve backend iki istemci için de aynı.

  Metin ürünün GERÇEK kurallarını anlatıyor, genel bir şablon değil:
    • Ders almak ücretsiz, puan yalnızca ANLATANA basılıyor ve harcanmıyor
      (CreditLedgerService — tek bacaklı işlem, escrow yok)
    • Puan 30 gün sonra yanıyor (EconomyOptions.EarnedCreditValidityDays)
    • Ders kanıtla kapanıyor, 48 saatte otomatik onaylanıyor (AutoApproveHours)
    • Yaptırım ölçeği: uyarı / süreli askı / kalıcı ban + cihaz banı
      (ApplySanction, BanUser)

  ⚠️ TUTULAMAYACAK SÖZ VERME KURALI: bu sayfada anlatılan her mekanizmanın kodda
  karşılığı var. Bir maddeyi değiştirmeden önce kodun hâlâ öyle davrandığını doğrula.

  MOBİLE ÖZGÜ TEK EKLEME §6'da: eşleşmeyi tek taraflı sonlandırma. Web metninde yok ama
  kodda VAR (closeMatch — app/eslesmeler.jsx) ve mağaza incelemesinin kullanıcı üretimli
  içerik için aradığı "rahatsız eden kişiyle iletişimi kesebilme" şartının karşılığı bu.
  Var olan bir yeteneği yazmak vaat değil, tarif.
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
          dersmate, öğrencilerin birbirine ders anlattığı bir akran öğrenme platformudur.
          Burada öğretmen değil akran vardır: anlatan da öğrenen de öğrencidir. Platform,
          dersin içeriğinden veya kalitesinden sorumlu değildir; yalnızca insanları
          buluşturur ve kayıt tutar.
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
            Puan <Kalin>yalnızca ders anlatana</Kalin> yazılır: her 30 dakikalık blok için
            50 puan.
          </Madde>
          <Madde>
            Puan <Kalin>harcanmaz</Kalin>. Ders almak için puana ihtiyacın yok; puan yalnızca
            seviyeni ve profilindeki görünürlüğünü belirler.
          </Madde>
          <Madde>
            Kazanılan puanın geçerlilik süresi <Kalin>30 gündür</Kalin>; süresi dolan puan
            yanar.
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
          eşleşmeyi Eşleşmeler ekranından tek taraflı sonlandırabilirsin. Sonlandırılan
          eşleşmeden sana yeni mesaj gelmez.
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
