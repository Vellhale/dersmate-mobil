<#
  ARKA UCU AYAĞA KALDIR — PostgreSQL + API + LAN köprüsü.

  Makine yeniden başladığında üçü de gider: veritabanı Windows hizmeti olarak KAYITLI
  DEĞİL (hizmet kaydı yönetici ister), API ve köprü ise normal süreçler. Bu betik
  üçünü sırayla ve yalnızca gerekiyorsa başlatır; çalışanı yeniden başlatmaz.

  Yollar bu makineye göre varsayılan; başka makinede parametreyle geçilir.

      powershell -ExecutionPolicy Bypass -File araclar/arka-uc-baslat.ps1
#>
param(
  [string]$PgBin    = 'C:\Program Files\PostgreSQL\17\bin',
  [string]$PgData   = 'C:\Users\abdul\pgdata\dersmate',
  [string]$ApiKok   = 'C:\projeler\dersmate',
  [string]$MobilKok = 'C:\projeler\dersmate Mobil',
  [int]   $KopruPort = 5099
)

$ErrorActionPreference = 'Stop'

function Dinleniyor([int]$port) {
  # -State Listen: yalnızca dinleyen soket sayılır; giden bağlantı "çalışıyor" demek değil.
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# 1) PostgreSQL
if (Dinleniyor 5432) {
  Write-Output 'PostgreSQL: zaten çalışıyor (5432)'
} else {
  & "$PgBin\pg_ctl.exe" -D $PgData -l "$PgData-server.log" -o '-p 5432' start | Out-Null
  Write-Output 'PostgreSQL: başlatıldı'
}

# 2) API — Redis YOK: bağlantı dizesi boş bırakılınca süreç içi kilit kullanılır.
if (Dinleniyor 5000) {
  Write-Output 'API: zaten çalışıyor (5000)'
} else {
  $env:ConnectionStrings__Redis = ''
  $env:ASPNETCORE_ENVIRONMENT = 'Development'
  Start-Process -FilePath 'dotnet' `
    -ArgumentList 'run', '--project', 'src/PeerLearn.Api', '--urls', 'http://0.0.0.0:5000' `
    -WorkingDirectory $ApiKok -WindowStyle Hidden `
    -RedirectStandardOutput "$PgData-api.log" -RedirectStandardError "$PgData-api.err" | Out-Null
  Write-Output 'API: başlatılıyor (ilk derleme birkaç saniye sürebilir)'
}

# 3) LAN köprüsü — telefon dotnet'e doğrudan ulaşamıyor (güvenlik duvarı kuralları
#    programa bağlı; node.exe izinli, dotnet.exe değil). Ayrıntı: CLAUDE.md.
if (Dinleniyor $KopruPort) {
  Write-Output "Köprü: zaten çalışıyor ($KopruPort)"
} else {
  Start-Process -FilePath 'node' -ArgumentList 'araclar/lan-koprusu.js' `
    -WorkingDirectory $MobilKok -WindowStyle Hidden `
    -RedirectStandardOutput "$PgData-kopru.log" -RedirectStandardError "$PgData-kopru.err" | Out-Null
  Write-Output "Köprü: başlatıldı ($KopruPort)"
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
       Select-Object -First 1).IPAddress
Write-Output ''
Write-Output "Telefonun bağlanacağı adres: http://${ip}:$KopruPort"
Write-Output 'Bu adres APK icine DERLEME ANINDA gomulur — IP degisirse APK yeniden derlenmeli.'
