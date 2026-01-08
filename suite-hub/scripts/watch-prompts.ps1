# Auto-Type Prompt Watcher
# Watches prompts folder, types command into Antigravity IDE, and presses Enter
# Run this script while Antigravity IDE is open

$promptsFolder = "C:\Users\info\.gemini\antigravity\scratch\stuart-hollinger-landing\suite-hub\prompts"
$ideCommand = "Process all prompts in the prompts folder"

Add-Type -AssemblyName System.Windows.Forms

# Track known files
$knownFiles = @{}

# Load existing files so we don't process old ones
Get-ChildItem -Path $promptsFolder -Filter "*.txt" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -notlike "README*" -and $_.Name -notlike "COMPLETION*") {
        $knownFiles[$_.Name] = $true
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  🤖 SUITE Auto-Prompt Watcher" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Watching: $promptsFolder" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: Keep Antigravity IDE focused!" -ForegroundColor Yellow
Write-Host "When a new prompt arrives, this script will:" -ForegroundColor White
Write-Host "  1. Type the command into the IDE" -ForegroundColor White
Write-Host "  2. Press Enter to submit" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Function to type text into the active window
function Type-IntoIDE {
    param([string]$text)
    
    # Small delay to ensure window is ready
    Start-Sleep -Milliseconds 500
    
    # Type each character (SendWait is more reliable than Send)
    [System.Windows.Forms.SendKeys]::SendWait($text)
    
    # Press Enter
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
}

# Function to play notification sound
function Play-NotificationSound {
    [System.Console]::Beep(800, 150)
    [System.Console]::Beep(1000, 150)
    [System.Console]::Beep(1200, 200)
}

# Main watch loop
while ($true) {
    $currentFiles = Get-ChildItem -Path $promptsFolder -Filter "*.txt" -ErrorAction SilentlyContinue
    
    $newPromptFound = $false
    
    foreach ($file in $currentFiles) {
        # Skip non-prompt files
        if ($file.Name -like "README*" -or $file.Name -like "COMPLETION*") {
            continue
        }
        
        if (-not $knownFiles.ContainsKey($file.Name)) {
            # New file detected!
            $newPromptFound = $true
            
            Write-Host ""
            Write-Host "═══════════════════════════════════════" -ForegroundColor Green
            Write-Host " 🆕 NEW PROMPT DETECTED!" -ForegroundColor Green
            Write-Host "═══════════════════════════════════════" -ForegroundColor Green
            Write-Host " File: $($file.Name)" -ForegroundColor White
            Write-Host ""
            
            # Mark as known (before typing to prevent re-processing)
            $knownFiles[$file.Name] = $true
        }
    }
    
    # If we found new prompts, type the command
    if ($newPromptFound) {
        Write-Host "⌨️  Typing command into IDE..." -ForegroundColor Yellow
        
        # Play sound to alert
        Play-NotificationSound
        
        # Give user 2 seconds to ensure IDE is focused
        Write-Host "   (Make sure Antigravity is focused!)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
        
        # Type the command
        Type-IntoIDE $ideCommand
        
        Write-Host "✅ Command sent!" -ForegroundColor Green
        Write-Host ""
    }
    
    # Check every 3 seconds
    Start-Sleep -Seconds 3
}
