@echo off
echo Creating video...

set FFMPEG=C:\ffmpeg\bin\ffmpeg.exe
set OUT=marketing\processed

REM Step 1: Merge all audio files
echo Merging audio tracks...
%FFMPEG% -y ^
    -i marketing\audio\01-hook.mp3 ^
    -i marketing\audio\02-vision.mp3 ^
    -i marketing\audio\03-treasury.mp3 ^
    -i marketing\audio\04-giving.mp3 ^
    -i marketing\audio\05-apps.mp3 ^
    -i marketing\audio\06-automation.mp3 ^
    -i marketing\audio\07-discord-cta.mp3 ^
    -i marketing\audio\08-video-system.mp3 ^
    -i marketing\audio\09-final-cta.mp3 ^
    -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a]concat=n=9:v=0:a=1[outa]" ^
    -map "[outa]" %OUT%\full-audio.mp3

if errorlevel 1 (
    echo Audio merge failed
    exit /b 1
)

echo Audio merged successfully

REM Step 2: Create video slideshow from images
echo Creating slideshow...
%FFMPEG% -y -r 0.125 -pattern_type glob -i "marketing/raw/photo_*_2026-01-05_08-39-59.jpg" ^
    -i %OUT%\full-audio.mp3 ^
    -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" ^
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p ^
    -c:a aac -b:a 320k -shortest -movflags +faststart ^
    %OUT%\video-1-what-im-building.mp4

if errorlevel 1 (
    echo Video creation failed
    del %OUT%\full-audio.mp3
    exit /b 1
)

del %OUT%\full-audio.mp3

echo.
echo SUCCESS! Video created
dir %OUT%\video-1-what-im-building.mp4
