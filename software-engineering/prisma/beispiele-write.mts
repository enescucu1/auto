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

// Aufruf:   pnpm i
//           pnpx prisma generate
//
//           node --env-file=.env src\beispiele-write.mts

import { PrismaPg } from '@prisma/adapter-pg';
import process from 'node:process';
import { PrismaClient, type Prisma } from './generated/prisma/client.ts';

console.log(`process.env['DATABASE_URL']=${process.env['DATABASE_URL']}`);
console.log('');

const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL_ADMIN'],
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
    adapter,
    errorFormat: 'pretty',
    log,
});
prisma.$on('query', (e) => {
    console.log(`Query: ${e.query}`);
    console.log(`Duration: ${e.duration} ms`);
});

const neuesBuch: Prisma.BuchCreateInput = {
    // Spaltentyp "text"
    isbn: '978-0-007-00644-1',
    // Spaltentyp "integer"
    rating: 1,
    // Spaltentyp "enum('HARDCOVER', ...)"
    art: 'HARDCOVER',
    // number -> Spaltentyp "numeric"
    preis: 99.99,
    rabatt: 0.0123,
    // Spaltentyp "boolean"
    lieferbar: true,
    // Datum im Format ISO8601 fuer Spaltentyp "date"
    datum: '2025-02-28T00:00:00Z',
    homepage: 'https://beispiele.prisma',
    // Spaltentyp "jsonb"
    schlagwoerter: ['JAVASCRIPT', 'TYPESCRIPT'],
    // 1:1-Beziehung
    titel: {
        create: {
            titel: 'Beispiel',
            untertitel: 'beispiel',
        },
    },
    // 1:N-Beziehung
    abbildungen: {
        create: [
            {
                beschriftung: 'Abb. 1',
                contentType: 'img/png',
            },
        ],
    },
};
type BuchCreated = Prisma.BuchGetPayload<{
    include: {
        titel: true;
        abbildungen: true;
    };
}>;

const geaendertesBuch: Prisma.BuchUpdateInput = {
    version: { increment: 1 },
    rating: 5,
    art: 'HARDCOVER',
    preis: 3333,
    rabatt: 0.033,
    lieferbar: true,
    // datum: '2025-03-03T00:00:00Z',
    homepage: 'https://geaendert.put.rest',
    schlagwoerter: ['JAVA'],
};
type BuchUpdated = Prisma.BuchGetPayload<{}>; // eslint-disable-line @typescript-eslint/no-empty-object-type

// Schreib-Operationen mit dem Model "Buch"
try {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => {
        // Neuer Datensatz mit generierter ID
        const buchDb: BuchCreated = await tx.buch.create({
            data: neuesBuch,
            include: { titel: true, abbildungen: true },
        });
        console.log(`Generierte ID: ${buchDb.id}`);
        console.log('');

        // Version +1 wegen "Optimistic Locking" bzw. Vermeidung von "Lost Updates"
        const buchUpdated: BuchUpdated = await tx.buch.update({
            data: geaendertesBuch,
            where: { id: 30 },
        });
        console.log(`Aktualisierte Version: ${buchUpdated.version}`);
        console.log('');

        // https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions#referential-action-defaults
        // https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/relation-mode
        const geloescht = await tx.buch.delete({ where: { id: 70 } });
        console.log(`Geloescht: ${geloescht.id}`);
    });
} finally {
    await prisma.$disconnect();
}
/* eslint-enable n/no-process-env */
