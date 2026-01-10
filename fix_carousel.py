#!/usr/bin/env python3
"""Fix the apps carousel in index.html to loop properly with more app duplications"""

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the app duplication logic
# Current: const duplicatedApps = [...liveApps, ...liveApps];
# New: Duplicate 4x to ensure enough content for seamless looping

old_duplication = "const duplicatedApps = [...liveApps, ...liveApps];"
new_duplication = """// Duplicate apps 4x to ensure seamless infinite loop regardless of app count
                  const duplicatedApps = [...liveApps, ...liveApps, ...liveApps, ...liveApps];"""

content = content.replace(old_duplication, new_duplication)

# Also adjust the animation calculation to work with 4x duplication
# The translateX should be -25% for 4x duplication to loop seamlessly
old_keyframe = """@keyframes carousel-scroll {
            0% {
                transform: translateX(0);
            }

            100% {
                transform: translateX(-50%);
            }
        }"""

new_keyframe = """@keyframes carousel-scroll {
            0% {
                transform: translateX(0);
            }

            100% {
                transform: translateX(-25%);
            }
        }"""

content = content.replace(old_keyframe, new_keyframe)

# Also update animation duration calculation for smoother experience
old_duration = "const animationDuration = Math.max(liveApps.length * 5, 20);"
new_duration = "const animationDuration = Math.max(liveApps.length * 8, 30); // Slower for better readability"

content = content.replace(old_duration, new_duration)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed apps carousel looping!")
print("Changes made:")
print("1. Duplicated apps 4x instead of 2x for more content")
print("2. Changed translateX to -25% for 4x duplication")
print("3. Increased animation duration for smoother scrolling")
