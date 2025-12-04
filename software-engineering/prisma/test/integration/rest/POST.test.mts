// POST.test.mts – angepasst für Auto

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import { type AutoDTO } from '../../../src/auto/controller/auto-dto.js';
import { AutoService } from '../../../src/auto/service/auto-service.js';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    LOCATION,
    POST,
    restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

// -----------------------------------------------------------------------------
// Testdaten
// -----------------------------------------------------------------------------

// Gültiges neues Auto für erfolgreichen POST
const neuesAuto: Omit<AutoDTO, 'preis' | 'rabatt' | 'modell' | 'bilder'> & {
    preis: number;
    rabatt: number;
} = {
    fgnr: '9-POSTX-9',         // möglichst einmalig, damit FGNR sicher frei ist
    art: 'LIMO',
    preis: 1999.99,            // einfacher Decimal-Wert
    rabatt: 10,
    lieferbar: true,
    datum: '2025-02-28',
    schlagwoerter: ['TEST', 'POST'],
};

// Ungültige Daten → BAD_REQUEST
const neuesAutoInvalid: Record<string, unknown> = {
    fgnr: '',                 // ungültig
    art: 'FLUGZEUG',          // kein Enum
    preis: -1,
    rabatt: -5,
    lieferbar: true,
    datum: '2025-99-99',      // ungültig
    modell: { modell: '' },   // invalid
};

const neuesAutoFgnrExistiert: Omit<
    AutoDTO,
    'preis' | 'rabatt' | 'modell' | 'bilder'
> & {
    preis: number;
    rabatt: number;
} = {
    fgnr: '9-POSTX-9',   // gleiche FGNR wie oben!
    art: 'COUPE',
    preis: 12345.67,
    rabatt: 5,
    lieferbar: true,
    datum: '2025-03-01',
    schlagwoerter: ['ABC'],
};


type MessageType = { message: string };

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe.sequential('POST /rest/auto', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    test('Neues Auto erfolgreich anlegen', async () => {
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAuto),
            headers,
        });

        expect(response.status).toBe(HttpStatus.CREATED);

        const location = response.headers.get(LOCATION);

        expect(location).toBeDefined();

        const idStr = location?.split('/').pop();

        expect(idStr).toBeDefined();
        expect(AutoService.ID_PATTERN.test(idStr ?? '')).toBe(true);
    });

    // ---------------- INVALID -------------------
    test.concurrent('Neues Auto mit ungueltigen Daten', async () => {
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        const expectedMsg = [
            expect.stringMatching(/^fgnr /u),
            expect.stringMatching(/^art /u),
            expect.stringMatching(/^preis /u),
            expect.stringMatching(/^rabatt /u),
            expect.stringMatching(/^datum /u),
            expect.stringMatching(/^modell.modell /u),
        ];

        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutoInvalid),
            headers,
        });

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);

        const body = (await response.json()) as MessageType;
        const messages = body.message;

        expect(messages).toHaveLength(expectedMsg.length);
        expect(messages).toStrictEqual(expect.arrayContaining(expectedMsg));
    });

    // ---------------- EXISTING FGNR -------------------
    test('Neues Auto, aber FGNR existiert bereits', async () => {
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAutoFgnrExistiert),
            headers,
        });

        expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);

        const body = (await response.json()) as MessageType;

        expect(body.message).toContain('Fahrgestellnummer');
        expect(body.message).toContain('existiert bereits');

    });

    // ---------------- MISSING TOKEN -------------------
    test.concurrent('Neues Auto ohne Token', async () => {
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAuto),
        });

        expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    // ---------------- WRONG TOKEN -------------------
    test.concurrent('Neues Auto mit falschem Token', async () => {
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesAuto),
            headers,
        });

        expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test.concurrent.todo('Abgelaufener Token');
});
