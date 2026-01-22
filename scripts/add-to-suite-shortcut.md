# Add to SUITE - iOS Shortcut

This shortcut allows you to quickly add tasks and groceries from your iPhone home screen.

## Setup Instructions

### Method 1: Manual Creation

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Add the following actions:

#### Action 1: Ask for Input
- Type: `Text`
- Prompt: `What do you want to add?`
- Save to variable: `UserInput`

#### Action 2: Get Contents of URL
- URL: `https://rdsmdywbdiskxknluiym.supabase.co/functions/v1/widget-quick-add`
- Method: `POST`
- Headers:
  - `Content-Type`: `application/json`
- Request Body (JSON):
```json
{
  "text": "[UserInput variable]",
  "telegram_id": "[Your Telegram ID]"
}
```

#### Action 3: Get Dictionary Value
- Key: `message`
- From: `Contents of URL`

#### Action 4: Show Result
- Show: `Dictionary Value`

4. Name the shortcut **Add to SUITE**
5. Set an icon (suggested: checkmark or shopping cart emoji)
6. Add to Home Screen for quick access

### Method 2: Siri Integration

After creating the shortcut:
1. Go to Shortcuts > Your shortcut > ... > Details
2. Add a Siri phrase like "Add to SUITE"
3. Now say "Hey Siri, add to SUITE" to trigger it

## Usage

1. Tap the shortcut or say "Hey Siri, add to SUITE"
2. Enter what you want to add, e.g.:
   - "milk, eggs, bread" (goes to Groceries)
   - "call mom" (goes to Tasks)
   - "buy milk, call dentist, eggs" (auto-categorized to appropriate lists)
3. The shortcut confirms what was added

## API Details

**Endpoint:** `https://rdsmdywbdiskxknluiym.supabase.co/functions/v1/widget-quick-add`

**Request:**
```json
{
  "text": "milk, eggs, call mom",
  "telegram_id": "123456789"
}
```

**Response:**
```json
{
  "success": true,
  "added": [
    { "list": "Groceries", "item": "milk", "id": "..." },
    { "list": "Groceries", "item": "eggs", "id": "..." },
    { "list": "Today", "item": "call mom", "id": "..." }
  ],
  "message": "Added 3 items"
}
```

## Troubleshooting

**"User not found" error:**
- Make sure you've logged in at getsuite.app with Telegram
- Use the correct Telegram ID (find it at getsuite.app/profile)

**Items going to wrong list:**
- The AI auto-categorizes based on content
- Food/household items go to Groceries
- Actions/appointments go to Tasks
- You can force a specific list by specifying `list_id` in the request
