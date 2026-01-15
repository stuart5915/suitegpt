# PowerShell script to publish article to Supabase - Debug version
$envPath = "C:\Users\info\Documents\stuart-hollinger-landing\stuart-hollinger-landing\cadence-ai-nextjs\.env.local"

# Read env file
$env = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        $env[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'")
    }
}

$SUPABASE_URL = $env["NEXT_PUBLIC_SUPABASE_URL"]
$SUPABASE_KEY = $env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

# Simple test insert first
$title = "Test Article"
$slug = "test-article"
$body = "This is a test article body."

Write-Host "Testing simple insert..."

$payload = @{
    title   = $title
    slug    = $slug
    content = $body
    status  = "draft"
} | ConvertTo-Json

$headers = @{
    "apikey"        = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type"  = "application/json; charset=utf-8"
    "Prefer"        = "return=representation"
}

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/articles" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($payload))
    Write-Host "SUCCESS! Article ID: $($response.id)"
}
catch {
    Write-Host "FAILED!"
    Write-Host "Exception: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}
