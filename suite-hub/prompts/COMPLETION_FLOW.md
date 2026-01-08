# Post-Processing Instructions

After completing prompt changes, send this command in the IDE:

```
Commit the changes, push to GitHub, and notify Discord that the deployment is complete
```

## Standard Completion Flow

1. Make the requested changes
2. `git add .`
3. `git commit -m "descriptive message"`
4. `git push origin master`
5. Delete the processed prompt file
6. (Optional) `npx expo publish` for OTA updates

## Discord Notification (Manual for now)

To notify Discord when deployment is complete, the IDE should:
1. Read the Discord webhook URL from environment
2. POST a message to the webhook

This will be automated in a future update.
