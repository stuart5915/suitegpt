# SUITE App Boilerplate

Minimal template for creating SUITE ecosystem apps with Telegram auth and credit monetization.

## Quick Start

1. **Copy this folder** to create a new app:
   ```bash
   cp -r boilerplate your-app-name
   cd your-app-name
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Customize** `config/features.ts`:
   - Change `APP_ID` to your app's slug
   - Change `APP_NAME` to your app's display name
   - Define your free and paid features

4. **Customize** `app.json`:
   - Update `name`, `slug`, `scheme`
   - Update bundle identifiers

5. **Run locally**:
   ```bash
   npm run web
   ```

6. **Build for production**:
   ```bash
   npm run build:web
   ```

7. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

## File Structure

```
your-app/
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout with providers
│   ├── login.tsx          # Auto-login from SUITE Shell
│   ├── +html.tsx          # Web PWA config
│   └── (tabs)/            # Tab navigation
│       ├── _layout.tsx    # Tab bar config
│       └── index.tsx      # Home screen
├── contexts/
│   └── TelegramAuthContext.tsx  # Auth + credits (don't modify)
├── components/
│   └── PaymentGate.tsx    # Credit payment modal (don't modify)
├── config/
│   ├── features.ts        # YOUR FEATURES HERE
│   └── keys.ts            # API keys
└── services/              # Your app's business logic
```

## Using Credits

```tsx
import { usePaymentGate } from '../components/PaymentGate';
import { APP_ID } from '../config/features';

function MyComponent() {
  const { requestPayment, PaymentGateModal } = usePaymentGate();

  const handlePremiumAction = async () => {
    const success = await requestPayment({
      featureName: 'AI Analysis',
      creditCost: 10,
      appId: APP_ID,
    });

    if (success) {
      // User paid, do the thing
    }
  };

  return (
    <>
      <Button onPress={handlePremiumAction}>Use AI</Button>
      <PaymentGateModal />
    </>
  );
}
```

## Add to SUITE Shell

After deploying, add your app to the `apps` table in Supabase:

```sql
INSERT INTO apps (name, slug, description, icon_url, app_url, category, status)
VALUES (
  'Your App Name',
  'your-app-slug',
  'Your app description',
  'https://your-domain.com/icon.png',
  'https://your-domain.com',
  'utilities',
  'live'
);
```
