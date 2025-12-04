/* eslint-disable n/no-process-env */
// Aufruf: pnpm i
//         pnpx prisma generate
//         node --env-file=.env src/beispiele.mts

import { PrismaPg } from '@prisma/adapter-pg';
import process from 'node:process';
import {
    PrismaClient,
    type auto,
    type Prisma,
} from './generated/prisma/client.js';
import {
    type autoInclude,
    type autoWhereInput,
} from './generated/prisma/models/auto.js';

console.log(`process.env['DATABASE_URL']=${process.env['DATABASE_URL']}`);
console.log('');

// Prisma Adapter (DATABASE_URL)
const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
});

// Logging-Konfiguration
const log: (Prisma.LogLevel | Prisma.LogDefinition)[] = [
    { emit: 'event', level: 'query' },
    'info',
    'warn',
    'error',
];

// PrismaClient für DB "auto"
const prisma = new PrismaClient({
    adapter,
    errorFormat: 'pretty',
    log,
});

// Query-Logging
prisma.$on('query', (e) => {
    console.log(`Query: ${e.query}`);
    console.log(`Duration: ${e.duration} ms`);
});

/**
 * WHERE:
 * SELECT *
 * FROM auto
 * JOIN modell ON auto.id = modell.auto_id
 * WHERE modell.modell LIKE "%n%"
 */
const where: autoWhereInput = {
    modell: {
        modell: {
            contains: 'n',
            mode: 'insensitive',
        },
    },
};

/**
 * Fetch-Joins:
 * model → modell (1:1)
 * bild → bild[] (1:N)
 */
const includeModellBilder: autoInclude = {
    modell: true,
    bild: true,
};

export type AutoMitModellUndBilder = Prisma.autoGetPayload<{
    include: {
        modell: true;
        bild: true;
    };
}>;

try {
    await prisma.$connect();

    // Einzelnes Auto
    const autoEinzeln: auto | null = await prisma.auto.findUnique({
        where: { id: 1 },
    });
    console.log(`auto=${JSON.stringify(autoEinzeln)}`);
    console.log('');

    // Autos mit Modell + Bilder
    const autos: AutoMitModellUndBilder[] = await prisma.auto.findMany({
        where,
        include: includeModellBilder,
    });
    console.log(`autosMitBildern=${JSON.stringify(autos)}`);
    console.log('');

    // Schlagwoerter aus allen Autos
    const schlagwoerter = autos.map((a) => a.schlagwoerter);
    console.log(`schlagwoerter=${JSON.stringify(schlagwoerter)}`);
    console.log('');

    // Modelle extrahieren
    const modelle = autos.map((a) => a.modell?.modell);
    console.log(`modelle=${JSON.stringify(modelle)}`);
    console.log('');

    // Pagination Beispiel (Page 2)
    const autosPage2: auto[] = await prisma.auto.findMany({
        skip: 5,
        take: 5,
    });
    console.log(`autosPage2=${JSON.stringify(autosPage2)}`);
    console.log('');
} finally {
    await prisma.$disconnect();
}

/**
 * ADMIN-Zugriff
 * PrismaClient mit PostgreSQL-User "postgres"
 */
const adapterAdmin = new PrismaPg({
    connectionString: process.env['DATABASE_URL_ADMIN'],
});
const prismaAdmin = new PrismaClient({ adapter: adapterAdmin });

try {
    const autosAdmin: auto[] = await prismaAdmin.auto.findMany({ where });
    console.log(`autosAdmin=${JSON.stringify(autosAdmin)}`);
} finally {
    await prismaAdmin.$disconnect();
}

/* eslint-enable n/no-process-env */
