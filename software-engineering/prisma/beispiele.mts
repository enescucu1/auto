/* eslint-disable n/no-process-env */
// Copyright (C) 2025 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

// Aufruf:  pnpm i
//          pnpx prisma generate
//
//          node --env-file=.env src\beispiele.mts

import { PrismaPg } from '@prisma/adapter-pg';
import process from 'node:process';
import {
    PrismaClient,
    type Buch,
    type Prisma,
} from './generated/prisma/client.ts';
import {
    type BuchInclude,
    type BuchWhereInput,
} from './generated/prisma/models/Buch.ts';

console.log(`process.env['DATABASE_URL']=${process.env['DATABASE_URL']}`);
console.log('');

const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
});

const log: (Prisma.LogLevel | Prisma.LogDefinition)[] = [
    {
        emit: 'event',
        level: 'query',
    },
    'info',
    'warn',
    'error',
];

// PrismaClient fuer DB "buch" (siehe Umgebungsvariable DATABASE_URL in ".env")
// d.h. mit PostgreSQL-User "buch" und Schema "buch"
const prisma = new PrismaClient({
    // shorthand property
    adapter,
    errorFormat: 'pretty',
    log,
});
prisma.$on('query', (e) => {
    console.log(`Query: ${e.query}`);
    console.log(`Duration: ${e.duration} ms`);
});

// SELECT *
// FROM   buch
// JOIN   titel ON buch.id = titel.buch_id
// WHERE  titel.titel LIKE "%n%"
const where: BuchWhereInput = {
    titel: {
        // https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#filter-on-relations
        titel: {
            // https://www.prisma.io/docs/orm/reference/prisma-client-reference#filter-conditions-and-operators
            contains: 'n',
        },
    },
};

// Fetch-Joins mit Daten aus "titel" und "abbildung"
const includeTitelAbbildungen: BuchInclude = {
    titel: true,
    abbildungen: true,
};
export type BuchMitTitelUndAbbildungen = Prisma.BuchGetPayload<{
    include: {
        titel: true;
        abbildungen: true;
    };
}>;

// Operationen mit dem Model "Buch"
try {
    await prisma.$connect();

    // Das Resultat ist null, falls kein Datensatz gefunden
    const buch: Buch | null = await prisma.buch.findUnique({
        where: { id: 1 },
    });
    console.log(`buch=${JSON.stringify(buch)}`);
    console.log('');

    // Fetch-Join mit Titel und Abbildungen
    const buecher: BuchMitTitelUndAbbildungen[] = await prisma.buch.findMany({
        // shorthand property
        where,
        include: includeTitelAbbildungen,
    });
    console.log(`buecherMitAbb=${JSON.stringify(buecher)}`);
    console.log('');

    // higher-order function und arrow function
    const schlagwoerter = buecher.map((b) => b.schlagwoerter);
    console.log(`schlagwoerter=${JSON.stringify(schlagwoerter)}`);
    console.log('');

    // union type
    const titel = buecher.map((b) => b.titel?.titel);
    console.log(`titel=${JSON.stringify(titel)}`);
    console.log('');

    // Pagination
    const buecherPage2: Buch[] = await prisma.buch.findMany({
        skip: 5,
        take: 5,
    });
    console.log(`buecherPage2=${JSON.stringify(buecherPage2)}`);
    console.log('');
} finally {
    await prisma.$disconnect();
}

// PrismaClient mit PostgreSQL-User "postgres", d.h. mit Administrationsrechten
const adapterAdmin = new PrismaPg({
    connectionString: process.env['DATABASE_URL_ADMIN'],
});
const prismaAdmin = new PrismaClient({ adapter: adapterAdmin });
try {
    const buecherAdmin: Buch[] = await prismaAdmin.buch.findMany({ where });
    console.log(`buecherAdmin=${JSON.stringify(buecherAdmin)}`);
} finally {
    await prismaAdmin.$disconnect();
}

/* eslint-enable n/no-process-env */
