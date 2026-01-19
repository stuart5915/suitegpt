// Set Telegram webhook for StuartFactoryBot

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!TELEGRAM_TOKEN || !WEBHOOK_URL) {
  console.error('Missing environment variables!');
  console.log('Usage:');
  console.log('  TELEGRAM_BOT_TOKEN=xxx WEBHOOK_URL=https://your-app.vercel.app/api/webhook node scripts/set-webhook.js');
  process.exit(1);
}

async function setWebhook() {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['message', 'callback_query']
      })
    }
  );

  const result = await response.json();
  console.log('Set webhook result:', result);

  if (result.ok) {
    console.log('✅ Webhook set successfully!');
    console.log(`   URL: ${WEBHOOK_URL}`);
  } else {
    console.error('❌ Failed to set webhook:', result.description);
  }
}

setWebhook().catch(console.error);
