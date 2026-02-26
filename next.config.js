const nextConfig = {
    output: 'standalone',
    images: {
        unoptimized: true,
    },
    serverExternalPackages: ['mongodb'],
    experimental: {
        webpackBuildWorker: false,
    },
    webpack(config, { dev, isServer }) {
        if (dev) {
            config.watchOptions = {
                poll: 2000,
                aggregateTimeout: 300,
                ignored: ['**/node_modules'],
            };
        }

        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            path: false,
        };

        // Prevent webpack from trying to resolve external CDN URLs
        config.externals = config.externals || [];
        config.externals.push({
            'https://cdn.cubing.net': 'empty',
        });

        return config;
    },
    onDemandEntries: {
        maxInactiveAge: 10000,
        pagesBufferLength: 2,
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "ALLOWALL" },
                    { key: "Access-Control-Allow-Origin", value: "*" },
                    { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
                    { key: "Access-Control-Allow-Headers", value: "*" },
                ],
            },
        ];
    },
};

module.exports = nextConfig;