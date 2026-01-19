// Set Telegram webhook to point to your Vercel deployment
// Run: node scripts/set-webhook.js

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g., https://suitehubbot.vercel.app/api/webhook

async function setWebhook() {
  if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set');
    process.exit(1);
  }

  if (!WEBHOOK_URL) {
    console.error('❌ WEBHOOK_URL not set');
    console.log('Set it to your Vercel URL, e.g.: https://suitehubbot.vercel.app/api/webhook');
    process.exit(1);
  }

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

  if (result.ok) {
    console.log('✅ Webhook set successfully!');
    console.log(`   URL: ${WEBHOOK_URL}`);
  } else {
    console.error('❌ Failed to set webhook:', result.description);
  }
}

setWebhook();
