# Video Creator - Python/MoviePy Version (Bulletproof)
# Install: pip install moviepy

from moviepy.editor import *
import glob
import os

print("🎬 Creating video...")

# Settings
audio_dir = "marketing/audio"
images_dir = "marketing/raw"
output_file = "marketing/processed/video-1-what-im-building.mp4"

# Get all audio files in order
audio_files = [
    f"{audio_dir}/01-hook.mp3",
    f"{audio_dir}/02-vision.mp3",
    f"{audio_dir}/03-treasury.mp3",
    f"{audio_dir}/04-giving.mp3",
    f"{audio_dir}/05-apps.mp3",
    f"{audio_dir}/06-automation.mp3",
    f"{audio_dir}/07-discord-cta.mp3",
    f"{audio_dir}/08-video-system.mp3",
    f"{audio_dir}/09-final-cta.mp3"
]

# Combine all audio
print("Merging audio tracks...")
audio_clips = [AudioFileClip(f) for f in audio_files]
final_audio = concatenate_audioclips(audio_clips)
total_duration = final_audio.duration

# Get all image files
image_files = sorted(glob.glob(f"{images_dir}/photo_*_2026-01-05_08-39-59.jpg"))
image_files.append(f"{images_dir}/photo_2026-01-05_08-42-31.jpg")

print(f"Found {len(image_files)} images")
print(f"Total audio duration: {total_duration:.1f} seconds")

# Calculate duration per image
duration_per_image = total_duration / len(image_files)

# Create video clips from images
print("Creating slideshow...")
video_clips = []
for img_path in image_files:
    clip = (ImageClip(img_path)
            .set_duration(duration_per_image)
            .resize(height=1920)  # Vertical video
            .on_color(size=(1080, 1920), color=(0,0,0), pos='center'))
    video_clips.append(clip)

# Concatenate all video clips
final_video = concatenate_videoclips(video_clips, method="compose")

# Add audio to video
final_video = final_video.set_audio(final_audio)

# Export
print("Exporting final video...")
final_video.write_videofile(
    output_file,
    fps=30,
    codec='libx264',
    audio_codec='aac',
    audio_bitrate='320k',
    preset='slow',
    ffmpeg_params=['-crf', '18']
)

# Cleanup
for clip in audio_clips + video_clips:
    clip.close()
final_audio.close()
final_video.close()

print(f"\n✅ Done! Video saved to: {output_file}")
print(f"Size: {os.path.getsize(output_file) / 1024 / 1024:.1f} MB")
