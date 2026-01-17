/**
 * Web HTML Template
 * Configures PWA meta tags and hides scrollbars for SUITE Shell iframe
 */

import { ScrollViewStyleReset } from 'expo-router/html';

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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <link rel="manifest" href="/manifest.json" />
        <meta name="format-detection" content="telephone=no" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const globalStyles = `
body {
  background-color: #0A0A1A;
}

/* Hide scrollbars for SUITE Shell iframe */
html, body, #root {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
html::-webkit-scrollbar,
body::-webkit-scrollbar,
#root::-webkit-scrollbar,
*::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* iOS PWA Safe Area */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  #root {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
`;
