# push.ps1
# 이 스크립트는 index.html 파일의 버전을 자동으로 올리고 Git에 커밋 & 푸시해줍니다.
# 사용법: .\push.ps1 ["커밋 메시지"]

param (
    [string]$CommitMessage = ""
)

$htmlPath = Join-Path $PSScriptRoot "index.html"

if (!(Test-Path $htmlPath)) {
    Write-Error "index.html 파일을 찾을 수 없습니다."
    exit 1
}

# index.html의 내용 읽기
$content = Get-Content $htmlPath -Raw -Encoding utf8

# 버전 태그 찾기 (<!-- Version: X.Y.Z -->)
if ($content -match '<!-- Version:\s*(\d+)\.(\d+)\.(\d+)\s*-->') {
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]
    
    $oldVersion = "$major.$minor.$patch"
    
    # 패치 버전 1 증가
    $patch++
    $newVersion = "$major.$minor.$patch"
    
    # 1. HTML 내 버전 주석 업데이트
    $content = $content -replace "<!-- Version:\s*$oldVersion\s*-->", "<!-- Version: $newVersion -->"
    
    # 2. UI 하단 시각적 버전 표시 업데이트 (id="app-version">v1.0.0</span>)
    $content = $content -replace 'id="app-version">v\d+\.\d+\.\d+<', "id=`"app-version`">v$newVersion<"
    
    # 파일 저장 (UTF-8)
    [System.IO.File]::WriteAllText($htmlPath, $content, [System.Text.Encoding]::UTF8)
    
    Write-Host "--------------------------------------------------" -ForegroundColor Cyan
    Write-Host "🚀 버전 업그레이드 완료: v$oldVersion -> v$newVersion" -ForegroundColor Green
    
    # 3. Git 작업 수행
    Write-Host "📦 Git Staging 및 Committing 진행 중..." -ForegroundColor Cyan
    git add .
    
    # 커밋 메시지 생성
    $finalMsg = "release: v$newVersion"
    if ($CommitMessage -ne "") {
        $finalMsg = "$finalMsg - $CommitMessage"
    } else {
        $finalMsg = "$finalMsg (자동 버전 관리 푸시 🎰)"
    }
    
    git commit -m "$finalMsg"
    
    Write-Host "📤 GitHub로 푸시 중..." -ForegroundColor Cyan
    git push origin main
    
    Write-Host "✨ 완료되었습니다! 버전 v$newVersion이 GitHub에 정상 업로드되었습니다." -ForegroundColor Green
    Write-Host "--------------------------------------------------" -ForegroundColor Cyan
} else {
    Write-Warning "index.html에서 버전 정보(<!-- Version: X.Y.Z -->)를 찾을 수 없습니다."
    Write-Host "버전을 v1.0.0으로 초기화합니다..."
    
    # 파일 맨 위에 버전 삽입
    $newContent = "<!-- Version: 1.0.0 -->`r`n" + $content
    [System.IO.File]::WriteAllText($htmlPath, $newContent, [System.Text.Encoding]::UTF8)
    
    git add .
    git commit -m "release: v1.0.0 (버전 초기화 🎰)"
    git push origin main
}
