# watch.ps1
# index.html 파일의 변경 사항을 감시하고, 변경 감지 시 자동으로 push.ps1을 실행하여 깃허브에 반영합니다.
# 실행 방법: PowerShell에서 .\watch.ps1 실행

$filePath = Join-Path $PSScriptRoot "index.html"
$pushScript = Join-Path $PSScriptRoot "push.ps1"

if (!(Test-Path $filePath)) {
    Write-Error "index.html 파일을 찾을 수 없습니다."
    exit 1
}

if (!(Test-Path $pushScript)) {
    Write-Error "push.ps1 스크립트를 찾을 수 없습니다."
    exit 1
}

# 초기 수정 시간 기록
$lastWrite = (Get-Item $filePath).LastWriteTime
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "👀 index.html 실시간 감시 시작!" -ForegroundColor Green
Write-Host "👉 이제 파일을 저장(Save)할 때마다 자동으로 버전을 올리고 GitHub에 푸시합니다." -ForegroundColor Yellow
Write-Host "⚠️ 감시를 종료하려면 창을 닫거나 Ctrl + C를 누르세요." -ForegroundColor DarkGray
Write-Host "--------------------------------------------------" -ForegroundColor Cyan

while ($true) {
    Start-Sleep -Seconds 2  # 2초 주기로 확인
    
    if (Test-Path $filePath) {
        $currentWrite = (Get-Item $filePath).LastWriteTime
        
        # 파일 수정 시간이 달라졌을 경우
        if ($currentWrite -gt $lastWrite) {
            Write-Host "`n⚡ 파일 변경 감지! ($currentWrite)" -ForegroundColor Yellow
            Start-Sleep -Milliseconds 500  # 파일 저장 완료 대기
            
            # push.ps1 실행 (자동 버전 업 & Git 푸시)
            & $pushScript "Auto-Watch Save"
            
            # 수정 시간 갱신
            $lastWrite = (Get-Item $filePath).LastWriteTime
        }
    }
}
