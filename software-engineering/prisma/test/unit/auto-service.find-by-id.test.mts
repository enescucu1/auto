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
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
    type AutoMitModell,
    AutoService,
} from '../../src/auto/service/auto-service.js';
import { PrismaService } from '../../src/auto/service/prisma-service.js';
import { WhereBuilder } from '../../src/auto/service/where-builder.js';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { autoart } from '../../src/generated/prisma/enums.js';

describe('AutoService findById', () => {
    let service: AutoService;
    let prismaServiceMock: PrismaService;

    beforeEach(() => {
        const findUniqueMock = vi.fn<PrismaClient['auto']['findUnique']>();
        prismaServiceMock = {
            client: {
                auto: {
                    findUnique: findUniqueMock,
                },
            },
        } as any; // cast, weil wir nicht den vollen PrismaService brauchen

        const whereBuilder = new WhereBuilder();

        service = new AutoService(prismaServiceMock, whereBuilder);
    });

    test('id vorhanden', async () => {
        // given
        const id = 1;
        const autoMock: AutoMitModell = {
            id,
            version: 0,
            fgnr: '1-0001-6',
            art: autoart.COUPE,
            preis: new Prisma.Decimal(44990),
            rabatt: 5,
            lieferbar: true,
            datum: new Date('2025-02-01T00:00:00Z'),
            schlagwoerter: ['SPORT'],
            erzeugt: new Date('2025-02-01T00:00:00Z'),
            aktualisiert: new Date('2025-02-01T00:00:00Z'),
            modell: {
                id: 1,
                modell: 'BMW',
                auto_id: id,
            },
        };

        (prismaServiceMock.client.auto.findUnique as any).mockResolvedValueOnce(
            autoMock,
        );

        // when
        const auto = await service.findById({ id });

        // then
        expect(auto).toStrictEqual(autoMock);
    });

    test('id nicht vorhanden', async () => {
        // given
        const id = 999;
        (prismaServiceMock.client.auto.findUnique as any).mockResolvedValue(
            null,
        );

        // when / then
        await expect(service.findById({ id })).rejects.toThrow(
            `Es gibt kein Auto mit der ID ${id}.`,
        );
    });
});
