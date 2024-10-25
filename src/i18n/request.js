

import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

const timeZonesByLang = {
    de: ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/Vaduz", "Europe/Luxembourg"]
};

export default getRequestConfig(async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let locale = Object.entries(timeZonesByLang).find(([lang, zones]) =>
        zones.includes(timeZone)
    )?.[0] || "en";

    try {
        // Try to load the messages for the preferred locale
        const messages = (await import(`@/locales/${locale}.json`)).default;
        return {
            locale,
            messages
        };
    } catch (error) {
        // If there's an error (e.g., locale file not found), fallback to 'en'
        if (error.code === 'MODULE_NOT_FOUND') {
            locale = 'en';
            const messages = (await import(`@/locales/en.json`)).default;
            return {
                locale,
                messages
            };
        } else {
            throw error;
        }
    }
});