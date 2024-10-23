import "./globals.css";
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import { createTheme, MantineProvider, ColorSchemeScript } from '@mantine/core';
import { Notifications } from "@mantine/notifications";
import { Suspense } from "react";

export const metadata = {
  title: "Quickdrop",
  description: "Quickly share files with others",
};

const theme = createTheme({

});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
        <link rel="icon" type="image/png" href="/favicon-48x48.png" sizes="48x48" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="QuickDrop" />
      </head>
      <body>
        <Suspense>
          <MantineProvider theme={theme} forceColorScheme="dark">
            <Notifications />
            {children}
          </MantineProvider>
        </Suspense>
      </body>
    </html>
  );
}
