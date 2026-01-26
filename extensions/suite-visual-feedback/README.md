# SUITE Visual Feedback

A Chrome extension for efficient agentic coding. Quickly select any element on a webpage and describe changes you want made.

## Features

- **Alt+X** to activate element selection mode
- Click any element to select it
- Describe your changes in the popup
- Copy to clipboard or send directly to your coding agent
- WebSocket integration for direct agent communication

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)

1. Download or clone this extension folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `suite-visual-feedback` folder
6. The extension is now installed!

## Usage

1. Press **Alt+X** on any webpage to enter selection mode
2. Your cursor will change to a crosshair
3. Hover over elements to highlight them
4. Click an element to select it
5. A popup will appear with the element info
6. Type your feedback/changes in the text area
7. Click "Copy to Clipboard" or "Send to Agent"

## Agent Connection

To send feedback directly to your coding agent:

1. Click the extension icon in Chrome toolbar
2. Enter your agent's WebSocket endpoint (default: `ws://localhost:9999`)
3. Click "Save Settings"

Your agent should listen for JSON messages with this format:
```json
{
  "type": "visual-feedback",
  "message": "...",
  "url": "https://...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Keyboard Shortcuts

- **Alt+X** - Toggle selection mode
- **Escape** - Cancel selection / close popup

## Icons

To generate the required PNG icons from the SVG:

```bash
# Using ImageMagick
convert icons/icon.svg -resize 16x16 icons/icon16.png
convert icons/icon.svg -resize 48x48 icons/icon48.png
convert icons/icon.svg -resize 128x128 icons/icon128.png
```

Or use any online SVG to PNG converter.

## License

MIT - Part of the SUITE ecosystem
