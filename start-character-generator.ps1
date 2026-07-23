$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundledNode = 'C:\Users\kogus\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodePath = $node.Source
} elseif (Test-Path -LiteralPath $bundledNode) {
    $nodePath = $bundledNode
} else {
    throw 'Node.js 18 이상이 필요합니다. Node.js를 설치한 뒤 다시 실행해주세요.'
}
Write-Host '브라우저에서 http://127.0.0.1:4319 을 여세요.' -ForegroundColor Green
Write-Host '종료하려면 이 창에서 Ctrl+C를 누르세요.' -ForegroundColor DarkGray
& $nodePath (Join-Path $workspace 'character-generator-server.mjs')
