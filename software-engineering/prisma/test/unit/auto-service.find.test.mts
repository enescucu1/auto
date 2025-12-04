// Copyright …

import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
    type AutoMitModell,
    AutoService,
} from '../../src/auto/service/auto-service.js';
import { type Pageable } from '../../src/auto/service/pageable.js';
import { PrismaService } from '../../src/auto/service/prisma-service.js';
import { type Suchparameter } from '../../src/auto/service/suchparameter.js';
import { WhereBuilder } from '../../src/auto/service/where-builder.js';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { autoart } from '../../src/generated/prisma/enums.js';

describe('AutoService find', () => {
    let service: AutoService;
    let prismaServiceMock: PrismaService;

    beforeEach(() => {
        const findManyMock = vi.fn<PrismaClient['auto']['findMany']>();
        const countMock = vi.fn<PrismaClient['auto']['count']>();

        prismaServiceMock = {
            client: {
                auto: {
                    findMany: findManyMock,
                    count: countMock,
                },
            },
        } as any;

        const whereBuilder = new WhereBuilder();
        service = new AutoService(prismaServiceMock, whereBuilder);
    });

    // -------------------------------------------------------------
    test('modell-teilstring vorhanden', async () => {
        // given
        const modell = 'bm'; // Beispiel
        const suchparameter: Suchparameter = { modell };
        const pageable: Pageable = { number: 1, size: 5 };

        const autoMock: AutoMitModell = {
            id: 1,
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
                auto_id: 1,
            },
        };

        (prismaServiceMock.client.auto.findMany as any)
            .mockResolvedValueOnce([autoMock]);
        (prismaServiceMock.client.auto.count as any)
            .mockResolvedValueOnce(1);

        // when
        const result = await service.find(suchparameter, pageable);

        // then
        const { content } = result;

        expect(content).toHaveLength(1);
        expect(content[0]).toStrictEqual(autoMock);
    });

    // -------------------------------------------------------------
    test('modell nicht vorhanden', async () => {
        // given
        const modell = 'ZZZ';
        const suchparameter: Suchparameter = { modell };
        const pageable: Pageable = { number: 1, size: 5 };

        (prismaServiceMock.client.auto.findMany as any)
            .mockResolvedValue([]);

        // when & then
        await expect(service.find(suchparameter, pageable)).rejects.toThrow(
            /^Keine Autos gefunden/,
        );
    });
});
