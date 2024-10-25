import "./globals.css";
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import { createTheme, MantineProvider, ColorSchemeScript } from '@mantine/core';
import { Notifications } from "@mantine/notifications";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Suspense } from "react";

export const metadata = {
  title: "Quickdrop",
  description: "Quickly share files with others",
};

const theme = createTheme({

});

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <ColorSchemeScript />
        <link rel="icon" type="image/png" href="/favicon-48x48.png" sizes="48x48" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="QuickDrop" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Suspense>
          <NextIntlClientProvider messages={messages}>
            <MantineProvider theme={theme} forceColorScheme="dark">
              <Notifications />
              {children}
            </MantineProvider>
          </NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
