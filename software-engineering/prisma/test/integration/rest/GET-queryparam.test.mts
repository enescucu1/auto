// Copyright…

import { HttpStatus } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { describe, expect, test } from 'vitest';

import { type Page } from '../../../src/auto/controller/page.js';
import { CONTENT_TYPE, restURL } from '../constants.mjs';

import { auto as Auto } from '../../../src/generated/prisma/client.js';
import { AutoMitModell } from '../../../src/auto/service/auto-service.js';

// -----------------------------------------------------------------------------
// Testdaten für AUTO
// -----------------------------------------------------------------------------
const modellTeile = ['a', 'o', 'e'];
const modellNichtVorhanden = ['xxx', 'yyy', 'zzz'];

const fgnrs = ['1-0001-6', '1-0020-6', '1-0030-6'];
const preisMax = [10000, 30000];

const schlagwoerter = ['sport', 'komfort'];
const schlagwoerterNichtVorhanden = ['diesel', 'luxus'];

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------
describe('GET /rest (Auto)', () => {

    // -------------------------------------------------------------------------
    test.concurrent('Alle Autos', async () => {
        const response = await fetch(restURL);
        const { status, headers } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

        const body = (await response.json()) as Page<Auto>;

        body.content.forEach((auto) => {
            expect(auto.id).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    test.concurrent.each(modellTeile)(
        'Autos mit Teilstring im Modell %s',
        async (teil) => {
            const params = new URLSearchParams({ modell: teil });
            const url = `${restURL}?${params}`;

            const response = await fetch(url);
            const { status, headers } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<AutoMitModell>;

            expect(body).toBeDefined();

            body.content
                .map((a) => a.modell)
                .forEach((m) =>
                    expect(m?.modell?.toLowerCase()).toStrictEqual(
                        expect.stringContaining(teil),
                    ),
                );
        },
    );

    // -------------------------------------------------------------------------
    test.concurrent.each(modellNichtVorhanden)(
        'Keine Autos zu nicht-vorhandenem Modell %s',
        async (teil) => {
            const params = new URLSearchParams({ modell: teil });
            const url = `${restURL}?${params}`;

            const { status } = await fetch(url);

            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );

    // -------------------------------------------------------------------------
    test.concurrent.each(fgnrs)(
        'Auto mit FGNR %s',
        async (fgnr) => {
            const params = new URLSearchParams({ fgnr });
            const url = `${restURL}?${params}`;

            const response = await fetch(url);
            const { status, headers } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Auto>;

            expect(body).toBeDefined();

            const autos = body.content;

            expect(autos).toHaveLength(1);
            expect(autos[0]?.fgnr).toBe(fgnr);
        },
    );

    // -------------------------------------------------------------------------
    test.concurrent.each(preisMax)(
        'Autos mit Preis <= %d',
        async (preisLimit) => {
            const params = new URLSearchParams({ preis: preisLimit.toString() });
            const url = `${restURL}?${params}`;

            const response = await fetch(url);
            const { status, headers } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Auto>;

            body.content
                .map((auto) => BigNumber(auto.preis.toString()))
                .forEach((p) =>
                    expect(p.isLessThanOrEqualTo(BigNumber(preisLimit))).toBe(
                        true,
                    ),
                );
        },
    );

    // -------------------------------------------------------------------------
    test.concurrent.each(schlagwoerter)(
        'Mind. 1 Auto mit Schlagwort %s',
        async (wort) => {
            const params = new URLSearchParams({ [wort]: 'true' });
            const url = `${restURL}?${params}`;

            const response = await fetch(url);
            const { status, headers } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Auto>;

            body.content
                .map((a) => a.schlagwoerter)
                .forEach((woerter) =>
                    expect(woerter).toStrictEqual(
                        expect.arrayContaining([wort.toUpperCase()]),
                    ),
                );
        },
    );

    // -------------------------------------------------------------------------
    test.concurrent.each(schlagwoerterNichtVorhanden)(
        'Keine Autos zu Schlagwort %s',
        async (wort) => {
            const params = new URLSearchParams({ [wort]: 'true' });
            const url = `${restURL}?${params}`;

            const { status } = await fetch(url);

            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );

    // -------------------------------------------------------------------------
    test.concurrent('Keine Autos zu einer nicht-vorhandenen Eigenschaft', async () => {
        const params = new URLSearchParams({ foo: 'bar' });
        const url = `${restURL}?${params}`;

        const { status } = await fetch(url);

        expect(status).toBe(HttpStatus.NOT_FOUND);
    });
});
