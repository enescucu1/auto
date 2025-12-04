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

import { AutoService } from '../../src/auto/service/auto-service.js';
import {
    type AutoCreate,
    AutoWriteService,
} from '../../src/auto/service/auto-write-service.js';
import { PrismaService } from '../../src/auto/service/prisma-service.js';
import { WhereBuilder } from '../../src/auto/service/where-builder.js';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { autoart } from '../../src/generated/prisma/enums.js';
import { MailService } from '../../src/mail/mail-service.js';

describe('AutoWriteService create', () => {
    let service: AutoWriteService;
    let prismaServiceMock: PrismaService;
    let readService: AutoService;
    let mailService: MailService;
    let autoCreateMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        autoCreateMock = vi.fn<any>();

        const transactionMock = vi
            .fn<any>()
            .mockImplementation(async (cb: any) => {
                // Mock-Objekt für die Transaktion
                const tx = {
                    auto: { create: autoCreateMock },
                };
                // Callback mit dem Mock-Objekt für die Transaktion aufrufen
                await cb(tx);
            });

        const countMock = vi.fn<PrismaClient['auto']['count']>();

        prismaServiceMock = {
            client: {
                $transaction: transactionMock,
                auto: {
                    count: countMock,
                },
            } as unknown,
        } as PrismaService;

        const whereBuilder = new WhereBuilder();
        readService = new AutoService(prismaServiceMock, whereBuilder);

        // MailService wie im Buch-Beispiel einfach "echt" verwenden
        mailService = new MailService();

        service = new AutoWriteService(
            prismaServiceMock,
            readService,
            mailService,
        );
    });

    test('Neues Auto', async () => {
        // given
        const idMock = 1;

        const auto: AutoCreate = {
            version: 0,
            fgnr: '1-0100-6',
            art: autoart.COUPE,
            preis: new Prisma.Decimal(44990),
            rabatt: 5,
            lieferbar: true,
            datum: new Date('2025-02-10T00:00:00Z'),
            schlagwoerter: ['SPORT'],
            modell: {
                create: {
                    modell: 'TESTMODELL',
                } as any,
            },
            bild: {
                create: [
                    {
                        id: 1,
                        beschriftung: 'Abb. 1',
                        content_type: 'img/png',
                    },
                ],
            },
        };

        // Das Objekt, das create() "aus der DB" zurückliefert
        const autoMockTemp: any = {
            ...auto,
            id: idMock,
            modell: {
                modell: 'TESTMODELL',
            },
            bild: [
                {
                    id: 1,
                    beschriftung: 'Abb. 1',
                    content_type: 'img/png',
                    auto_id: idMock,
                },
            ],
        };
        autoCreateMock.mockResolvedValue(autoMockTemp);

        // when
        const id = await service.create(auto);

        // then
        expect(id).toBe(idMock);
    });
});
