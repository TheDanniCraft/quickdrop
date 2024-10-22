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
