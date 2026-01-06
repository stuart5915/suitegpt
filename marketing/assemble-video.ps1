# Video Assembly Script using FFmpeg
# This will create the final video from 9 audio sections + 42 images

$outputDir = "marketing/processed"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host "Assembling Video: What I'm Building"
Write-Host "="*50

# Create a concat file for FFmpeg
$concatFile = "marketing/video-concat-list.txt"
$concatContent = @()

# Map images to each section with durations (in seconds)
$sections = @{
    "01-hook" = @{
        audio = "marketing/audio/01-hook.mp3"
        images = 1..5 | ForEach-Object { "marketing/raw/photo_${_}_2026-01-05_08-39-59.jpg" }
        duration = 6  # seconds per image
    }
    "02-vision" = @{
        audio = "marketing/audio/02-vision.mp3"
        images = 6..14 | ForEach-Object { "marketing/raw/photo_${_}_2026-01-05_08-39-59.jpg" }
        duration = 10
    }
    "03-treasury" = @{
        audio = "marketing/audio/03-treasury.mp3"
        images = 15..23 | ForEach-Object { "marketing/raw/photo_${_}_2026-01-05_08-39-59.jpg" }
        duration = 10
    }
    "04-giving" = @{
        audio = "marketing/audio/04-giving.mp3"
        images = 24..29 | ForEach-Object { "marketing/raw/photo_${_}_2026-01-05_08-39-59.jpg" }
        duration = 10
    }
    "05-apps" = @{
        audio = "marketing/audio/05-apps.mp3"
        images = 30..33 | ForEach-Object { "marketing/raw/photo_${_}_2026-01-05_08-39-59.jpg" }
        duration = 22
    }
    "06-automation" = @{
        audio = "marketing/audio/06-automation.mp3"
        images = 34..37 | ForEach-Object { "marketing/raw/photo_${_}_2026-01-05_08-39-59.jpg" }
        duration = 22
    }
    "07-discord-cta" = @{
        audio = "marketing/audio/07-discord-cta.mp3"
        images = 38..39 | ForEach-Object { "marketing/raw/photo_${_}_2026-01-05_08-39-59.jpg" }
        duration = 25
    }
    "08-video-system" = @{
        audio = "marketing/audio/08-video-system.mp3"
        images = @("marketing/raw/photo_40_2026-01-05_08-39-59.jpg", "marketing/raw/photo_41_2026-01-05_08-39-59.jpg")
        duration = 30
    }
    "09-final-cta" = @{
        audio = "marketing/audio/09-final-cta.mp3"
        images = @("marketing/raw/photo_2026-01-05_08-42-31.jpg")
        duration = 40
    }
}

# Build each section as a video segment
$segmentFiles = @()
$segmentIndex = 0

foreach ($sectionName in $sections.Keys | Sort-Object) {
    $section = $sections[$sectionName]
    $segmentIndex++
    
    Write-Host "`nProcessing section: $sectionName"
    
    # Create a slideshow from images
    $slideshowFile = "$outputDir/segment_${segmentIndex}_slideshow.mp4"
    
    # Build FFmpeg command for image slideshow with crossfade
    $imageInputs = ""
    $filterComplex = ""
    
    for ($i = 0; $i -lt $section.images.Count; $i++) {
        $img = $section.images[$i]
        $imageInputs += "-loop 1 -t $($section.duration) -i `"$img`" "
        
        if ($i -eq 0) {
            $filterComplex = "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0];"
        } else {
            $filterComplex += "[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}];"
        }
    }
    
    # Add crossfade transitions
    if ($section.images.Count -gt 1) {
        $filterComplex += "[v0][v1]xfade=transition=fade:duration=0.5:offset=$($section.duration - 0.5)[vt1];"
        for ($i = 1; $i -lt ($section.images.Count - 1); $i++) {
            $offset = ($i + 1) * $section.duration - 0.5
            $filterComplex += "[vt${i}][v$($i+1)]xfade=transition=fade:duration=0.5:offset=${offset}[vt$($i+1)];"
        }
        $filterComplex += "[vt$($section.images.Count - 1)]format=yuv420p[outv]"
    } else {
        $filterComplex += "[v0]format=yuv420p[outv]"
    }
    
    # Generate slideshow video
    $ffmpegCmd = "ffmpeg -y $imageInputs -filter_complex `"$filterComplex`" -map `"[outv]`" -c:v libx264 -preset fast -crf 23 `"$slideshowFile`""
    
    Write-Host "Creating slideshow..."
    Invoke-Expression $ffmpegCmd 2>&1 | Out-Null
    
    # Add audio to slideshow
    $segmentOutput = "$outputDir/segment_${segmentIndex}_final.mp4"
    ffmpeg -y -i "$slideshowFile" -i "$($section.audio)" -c:v copy -c:a aac -b:a 192k -shortest "$segmentOutput" 2>&1 | Out-Null
    
    $segmentFiles += $segmentOutput
    Remove-Item $slideshowFile -Force
    
    Write-Host "✓ Section $sectionName completed"
}

# Concatenate all segments
Write-Host "`n`nMerging all segments into final video..."

$concatListContent = ($segmentFiles | ForEach-Object { "file '$_'" }) -join "`n"
Set-Content -Path $concatFile -Value $concatListContent

$finalOutput = "$outputDir/video-1-what-im-building.mp4"
ffmpeg -y -f concat -safe 0 -i "$concatFile" -c copy "$finalOutput" 2>&1 | Out-Null

# Cleanup
Remove-Item $concatFile -Force
$segmentFiles | ForEach-Object { Remove-Item $_ -Force }

Write-Host "`n" + "="*50
Write-Host "✅ VIDEO COMPLETE!"
Write-Host "Output: $finalOutput"
Write-Host "Ready for upload to YouTube, TikTok, Twitter"
Write-Host "="*50
