import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#0A0A1A" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS PWA Meta Tags - REQUIRED for standalone mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FoodVitals" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        {/* Web App Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Prevent phone number detection */}
        <meta name="format-detection" content="telephone=no" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #0A0A1A;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #0A0A1A;
  }
}

/* iOS PWA Safe Area Handling */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  #root {
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* Ensure tab bar respects safe area */
  [role="tablist"] {
    padding-bottom: env(safe-area-inset-bottom) !important;
  }
}`;
