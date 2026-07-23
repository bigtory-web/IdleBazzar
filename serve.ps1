param(
    [int]$Port = 4173
)

$rootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host "바자르 키우기 프로토타입: http://127.0.0.1:$Port/"

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            $relativePath = "index.html"
        }

        $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $rootPath $relativePath))
        if (-not $candidatePath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
            $context.Response.StatusCode = 404
            $context.Response.Close()
            continue
        }

        $bytes = [System.IO.File]::ReadAllBytes($candidatePath)
        $extension = [System.IO.Path]::GetExtension($candidatePath).ToLowerInvariant()
        $context.Response.ContentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $context.Response.Close()
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
