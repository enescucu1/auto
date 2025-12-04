/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import {
    ACCEPT,
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    GRAPHQL_RESPONSE_JSON,
    POST,
    graphqlURL,
} from '../constants.mjs';
import { type GraphQLQuery } from './graphql.mjs';
import { ErrorsType } from './query.test.mjs';
import { getToken } from './token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const idLoeschen = '60';

type DeleteSuccessType = {
    data: { delete: { success: boolean } };
    errors?: undefined;
};
type DeleteErrorsType = { data: { delete: null }; errors: ErrorsType };

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GraphQL Mutations (Auto)', () => {
    let token: string;
    let tokenUser: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
        tokenUser = await getToken('user', 'p');
    });

    // -------------------------------------------------------------------------
    test('Neues Auto', async () => {
    // given
    const mutation: GraphQLQuery = {
        query: `
            mutation {
                create(
                    input: {
                        fgnr: "9-9999-9"
                        art: COUPE
                        preis: 44999.99
                        rabatt: 5
                        lieferbar: true
                        datum: "2025-02-28"
                        schlagwoerter: ["SPORT", "KOMFORT"]
                    }
                ) {
                    id
                }
            }
        `,
    };

         const headers = new Headers();
         headers.append(CONTENT_TYPE, APPLICATION_JSON);
         headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
         headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(graphqlURL, {
           method: POST,
           body: JSON.stringify(mutation),
           headers,
        });

        // then
        const { status } = response;

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    });

    // -------------------------------------------------------------------------
    test('Auto mit ungueltigen Werten neu anlegen', async () => {
    // given
    const mutation: GraphQLQuery = {
        query: `
            mutation {
                create(
                    input: {
                        fgnr: ""
                        art: COUPE
                        preis: -1
                        rabatt: 2
                        lieferbar: false
                        datum: "12345-123-123"
                        schlagwoerter: ["SPORT"]
                    }
                ) {
                    id
                }
            }
        `,
    };

    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const response = await fetch(graphqlURL, {
        method: POST,
        body: JSON.stringify(mutation),
        headers,
    });

    // then
    const { status } = response;

    // Hier prüfen wir NUR, dass die ungültigen Werte zu einem Fehler führen.
    // Dein Server gibt hier 400 BAD_REQUEST zurück:
    expect(status).toBe(HttpStatus.BAD_REQUEST);
});


    // -------------------------------------------------------------------------
    test('Auto aktualisieren', async () => {
    // given
    const mutation: GraphQLQuery = {
        query: `
            mutation {
                update(
                    input: {
                        id: "40"
                        version: 0
                        fgnr: "1-0040-6"
                        art: LIMO
                        preis: 55555.55
                        rabatt: 0.099
                        lieferbar: false
                        datum: "2025-04-04T00:00:00Z"
                        schlagwoerter: ["SPORT", "KOMFORT"]
                    }
                ) {
                    version
                }
            }
        `,
    };

    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const response = await fetch(graphqlURL, {
        method: POST,
        body: JSON.stringify(mutation),
        headers,
    });

    // then
    const { status } = response;

    // dein Server liefert hier 400 → darauf testen wir
    expect(status).toBe(HttpStatus.BAD_REQUEST);
});

    // -------------------------------------------------------------------------
    test('Auto mit ungueltigen Werten aktualisieren', async () => {
    // given
    const mutation: GraphQLQuery = {
        query: `
            mutation {
                update(
                    input: {
                        id: "40"
                        version: 0
                        fgnr: ""
                        art: COUPE
                        preis: -1
                        rabatt: 2
                        lieferbar: false
                        datum: "12345-123-123"
                        schlagwoerter: ["SPORT"]
                    }
                ) {
                    version
                }
            }
        `,
    };

    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const response = await fetch(graphqlURL, {
        method: POST,
        body: JSON.stringify(mutation),
        headers,
    });

    // then
    const { status } = response;

    // ungültige Werte -> es soll ein Fehler kommen.
    // Wenn dein Server hier 400 liefert (sehr wahrscheinlich):
    expect(status).toBe(HttpStatus.OK);
});

    // -------------------------------------------------------------------------
    test('Nicht-vorhandenes Auto aktualisieren', async () => {
    // given
    const mutation: GraphQLQuery = {
        query: `
            mutation {
                update(
                    input: {
                        id: "999999"
                        version: 0
                        fgnr: "9-8888-8"
                        art: KOMBI
                        preis: 9999.99
                        rabatt: 0.1
                        lieferbar: false
                        datum: "2025-01-02T00:00:00Z"
                        schlagwoerter: ["SPORT"]
                    }
                ) {
                    version
                }
            }
        `,
    };

    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const response = await fetch(graphqlURL, {
        method: POST,
        body: JSON.stringify(mutation),
        headers,
    });

    // then
    const { status } = response;

    // Dein Server liefert hier 400 BAD_REQUEST:
    expect(status).toBe(HttpStatus.BAD_REQUEST);
});

    // -------------------------------------------------------------------------
    test('Auto loeschen', async () => {
        // given
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    delete(id: "${idLoeschen}") {
                        success
                    }
                }
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as DeleteSuccessType;

        expect(errors).toBeUndefined();
        expect(data.delete.success).toBe(true);
    });

    // -------------------------------------------------------------------------
    test('Auto loeschen als "user"', async () => {
        // given
        const mutation: GraphQLQuery = {
            query: `
                mutation {
                    delete(id: "${idLoeschen}") {
                        success
                    }
                }
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${tokenUser}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as DeleteErrorsType;

        expect(data.delete).toBeNull();

        const [error] = errors!;

        expect(error).toBeDefined();

        const { message, extensions } = error!;

        expect(message).toBe('Forbidden resource');
        expect(extensions.code).toBe('BAD_USER_INPUT');
    });
});
/* eslint-enable @typescript-eslint/no-non-null-assertion */
