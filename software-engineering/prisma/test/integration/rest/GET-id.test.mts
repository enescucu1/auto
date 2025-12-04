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
// along with this program. If not, see <https://www.gnu.org/licenses/>

import { HttpStatus } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { CONTENT_TYPE, IF_NONE_MATCH, restURL } from '../constants.mjs';

// -----------------------------------------------------------------------------
// Testdaten für Auto
// -----------------------------------------------------------------------------
const ids = [1, 20];
const idNichtVorhanden = 999999;
const idsETag = [1, 20];
const idFalsch = 'xy';

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------
describe('GET /rest/:id (Auto)', () => {
    test.concurrent.each(ids)('Auto zu vorhandener ID %i', async (id) => {
        // given
        const url = `${restURL}/${id}`;

        // when
        const response = await fetch(url);
        const { status, headers } = response;

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

        const body = (await response.json()) as { id: number };

        expect(body.id).toBe(id);
    });

    test.concurrent('Kein Auto zu nicht-vorhandener ID', async () => {
        // given
        const url = `${restURL}/${idNichtVorhanden}`;

        // when
        const { status } = await fetch(url);

        // then
        expect(status).toBe(HttpStatus.NOT_FOUND);
    });

    test.concurrent('Kein Auto zu falscher ID', async () => {
        // given
        const url = `${restURL}/${idFalsch}`;

        // when
        const { status } = await fetch(url);

        // then
        expect(status).toBe(HttpStatus.NOT_FOUND);
    });

    test.concurrent.each(idsETag)(
        'Auto zu ID %i mit If-None-Match',
        async (id) => {
            // given
            const url = `${restURL}/${id}`;
            const headers = new Headers();
            headers.append(IF_NONE_MATCH, '"0"');

            // when
            const response = await fetch(url, { headers });
            const { status } = response;

            // then
            expect(status).toBe(HttpStatus.NOT_MODIFIED);

            const body = await response.text();

            expect(body).toBe('');
        },
    );
});
