$body = '{"message":{"chat":{"id":123},"text":"test idea for FoodVitals dark mode"}}'
$response = Invoke-WebRequest -Uri "https://rdsmdywbdiskxknluiym.supabase.co/functions/v1/capture-idea" -Method POST -Body $body -ContentType "application/json"
Write-Host "Status:" $response.StatusCode
Write-Host "Response:" $response.Content
