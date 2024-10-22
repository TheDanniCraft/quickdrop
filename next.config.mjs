/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    experimental: {
        serverActions: {
            bodySizeLimit: '5gb',
        },
    },
};

export default nextConfig;
