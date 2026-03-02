let prismaClient = null;

export function getPrismaClient() {
    if (prismaClient) return prismaClient;

    // Dynamic import to avoid build-time initialization
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL
            }
        }
    });
    return prismaClient;
}

export const prisma = {
    get client() {
        return getPrismaClient();
    }
};

export default prisma;