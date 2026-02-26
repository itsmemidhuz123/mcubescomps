const nextConfig = {
    output: 'standalone',
    images: {
        unoptimized: true,
    },
    serverExternalPackages: ['mongodb', 'cubing'],
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
            worker: false,
        };

        // Mark cubing as external so it's not bundled
        if (!isServer) {
            config.externals = [...(config.externals || []), 'cubing'];
        }

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