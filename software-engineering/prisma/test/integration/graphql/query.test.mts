/* eslint-disable @typescript-eslint/no-non-null-assertion */
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

import { type GraphQLRequest } from '@apollo/server';
import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import {
    ACCEPT,
    APPLICATION_JSON,
    CONTENT_TYPE,
    GRAPHQL_RESPONSE_JSON,
    POST,
    graphqlURL,
} from '../constants.mjs';
import { autoart, type Prisma } from '../../../src/generated/prisma/client.js';

// DTO-Typ für die GraphQL-Rückgabe eines Autos
export type AutoDTO = Omit<
    Prisma.autoGetPayload<{
        include: {
            modell: true;
        };
    }>,
    'aktualisiert' | 'erzeugt' | 'rabatt'
>;

type AutoSuccessType = { data: { auto: AutoDTO }; errors?: undefined };
type AutosSuccessType = { data: { autos: AutoDTO[] }; errors?: undefined };

export type ErrorsType = {
    message: string;
    path: string[];
    extensions: { code: string };
}[];
type AutoErrorsType = { data: { auto: null }; errors: ErrorsType };
type AutosErrorsType = { data: { autos: null }; errors: ErrorsType };

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
// IDs müssen zu deinen Seed-Daten passen
const ids = [1, 20];

const fgnrTeilstuecke = ['1-', '2-', '3-'];
const fgnrNichtVorhanden = ['xxx', 'yyy', 'zzz'];

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('GraphQL Queries (Auto)', () => {
    let headers: Headers;

    beforeAll(() => {
        headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
    });

    test.concurrent.each(ids)('Auto zu ID %i', async (id) => {
        // given
        const query: GraphQLRequest = {
            query: `
                {
                    auto(id: "${id}") {
                        version
                        fgnr
                        art
                        preis
                        lieferbar
                        datum
                        schlagwoerter
                        modell {
                            modell
                        }
                        rabatt(short: true)
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutoSuccessType;

        expect(errors).toBeUndefined();
        expect(data).toBeDefined();

        const { auto } = data;

        expect(auto.modell?.modell).toMatch(/^\w/u);
        expect(auto.version).toBeGreaterThanOrEqual(0);
        // ID wurde nicht abgefragt, daher undefined
        expect((auto as any).id).toBeUndefined();
    });

    test.concurrent('Auto zu nicht-vorhandener ID', async () => {
        // given
        const id = '999999';
        const query: GraphQLRequest = {
            query: `
                {
                    auto(id: "${id}") {
                        modell {
                            modell
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutoErrorsType;

        expect(data.auto).toBeNull();
        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { message, path, extensions } = error!;

        expect(message).toBe(`Es gibt kein Auto mit der ID ${id}.`);
        expect(path).toBeDefined();
        expect(path![0]).toBe('auto');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    test.concurrent.each(fgnrTeilstuecke)(
        'Autos zu Teil-Fahrgestellnummer %s',
        async (teil) => {
            // given
            const query: GraphQLRequest = {
                query: `
                    {
                        autos(suchparameter: {
                            fgnr: "${teil}"
                        }) {
                            fgnr
                            modell {
                                modell
                            }
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(response.headers.get(CONTENT_TYPE)).toMatch(
                /application\/graphql-response\+json/iu,
            );

            const { data, errors } =
                (await response.json()) as AutosSuccessType;

            expect(errors).toBeUndefined();
            expect(data).toBeDefined();

            const { autos } = data;

            expect(autos).not.toHaveLength(0);

            autos.forEach((auto) => {
                expect(auto.fgnr.toLowerCase()).toStrictEqual(
                    expect.stringContaining(teil.toLowerCase()),
                );
            });
        },
    );

    test.concurrent.each(fgnrNichtVorhanden)(
        'Kein Auto zu nicht vorhandener Fahrgestellnummer %s',
        async (teil) => {
            // given
            const query: GraphQLRequest = {
                query: `
                    {
                        autos(suchparameter: {
                            fgnr: "${teil}"
                        }) {
                            fgnr
                            modell {
                                modell
                            }
                        }
                    }
                `,
            };

            // when
            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            // then
            const { status } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(response.headers.get(CONTENT_TYPE)).toMatch(
                /application\/graphql-response\+json/iu,
            );

            const { data, errors } =
                (await response.json()) as AutosErrorsType;

            expect(data.autos).toBeNull();
            expect(errors).toHaveLength(1);

            const [error] = errors!;
            const { message, path, extensions } = error!;

            expect(message).toMatch(/^Keine Autos gefunden:/u);
            expect(path).toBeDefined();
            expect(path![0]).toBe('autos');
            expect(extensions).toBeDefined();
            expect(extensions!.code).toBe('BAD_USER_INPUT');
        },
    );

    test.concurrent('Autos zur Art "COUPE"', async () => {
        // given
        const autoArt: autoart = 'COUPE';
        const query: GraphQLRequest = {
            query: `
                {
                    autos(suchparameter: {
                        art: ${autoArt}
                    }) {
                        art
                        modell {
                            modell
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutosSuccessType;

        expect(errors).toBeUndefined();
        expect(data).toBeDefined();

        const { autos }: { autos: AutoDTO[] } = data;

        expect(autos).not.toHaveLength(0);

        autos.forEach((auto) => {
            const { art, modell } = auto;

            expect(art).toBe(autoArt);
            expect(modell?.modell).toBeDefined();
        });
    });

    test.concurrent('Autos zu einer ungueltigen Art', async () => {
        // given
        const autoArt = 'UNGUELTIG';
        const query: GraphQLRequest = {
            query: `
                {
                    autos(suchparameter: {
                        art: ${autoArt}
                    }) {
                        modell {
                            modell
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutosErrorsType;

        expect(data).toBeUndefined();
        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { extensions } = error!;

        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('GRAPHQL_VALIDATION_FAILED');
    });

    test.concurrent('Autos mit lieferbar=true', async () => {
        // given
        const query: GraphQLRequest = {
            query: `
                {
                    autos(suchparameter: {
                        lieferbar: true
                    }) {
                        lieferbar
                        modell {
                            modell
                        }
                    }
                }
            `,
        };

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as AutosSuccessType;

        expect(errors).toBeUndefined();
        expect(data).toBeDefined();

        const { autos }: { autos: AutoDTO[] } = data;

        expect(autos).not.toHaveLength(0);

        autos.forEach((auto) => {
            const { lieferbar, modell } = auto;

            expect(lieferbar).toBe(true);
            expect(modell?.modell).toBeDefined();
        });
    });
});

/* eslint-enable @typescript-eslint/no-non-null-assertion */
