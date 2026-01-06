# Ultra-Simple FFmpeg Video Creator
# Most basic approach possible

$ffmpeg = "C:\ffmpeg\bin\ffmpeg.exe"
$out = "marketing\processed"

Write-Host "Creating video (simple approach)..."

# Step 1: Create text file listing all images
$imageList = @()
1..41 | ForEach-Object {
    $imageList += "marketing/raw/photo_${_}_2026-01-05_08-39-59.jpg"
}
$imageList += "marketing/raw/photo_2026-01-05_08-42-31.jpg"

# Step 2: Merge all audio into one file first
Write-Host "Merging audio..."
$audioMerge = "$out\full-audio.mp3"
& $ffmpeg -y `
    -i "marketing\audio\01-hook.mp3" `
    -i "marketing\audio\02-vision.mp3" `
    -i "marketing\audio\03-treasury.mp3" `
    -i "marketing\audio\04-giving.mp3" `
    -i "marketing\audio\05-apps.mp3" `
    -i "marketing\audio\06-automation.mp3" `
    -i "marketing\audio\07-discord-cta.mp3" `
    -i "marketing\audio\08-video-system.mp3" `
    -i "marketing\audio\09-final-cta.mp3" `
    -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a]concat=n=9:v=0:a=1[outa]" `
    -map "[outa]" $audioMerge 2>&1 | Out-Null

if (Test-Path $audioMerge) {
    Write-Host "✓ Audio merged"
    
    # Step 3: Get audio duration
    $durationOutput = & $ffmpeg -i $audioMerge 2>&1 | Select-String "Duration"
    $duration = $durationOutput.ToString()
    Write-Host "Audio duration: $duration"
    
    # Step 4: Create slideshow with exact duration to match audio
    # Using pattern matching for images
    Write-Host "Creating slideshow..."
    $finalVideo = "$out\video-1-what-im-building.mp4"
    
    & $ffmpeg -y -r 1/8 -pattern_type glob -i "marketing/raw/photo_*_2026-01-05_08-39-59.jpg" `
        -i $audioMerge `
        -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" `
        -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p `
        -c:a aac -b:a 320k -shortest -movflags +faststart `
        $finalVideo 2>&1 | Out-Null
    
    Remove-Item $audioMerge -Force -ErrorAction SilentlyContinue
    
    if (Test-Path $finalVideo) {
        $size = [math]::Round((Get-Item $finalVideo).Length/1MB, 2)
        Write-Host "`n✅ SUCCESS! Video created: $size MB" -ForegroundColor Green
        Write-Host "Location: $finalVideo"
    } else {
        Write-Host "`n❌ Failed" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Audio merge failed" -ForegroundColor Red
}
