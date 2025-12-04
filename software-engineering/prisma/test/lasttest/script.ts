// Copyright (C) 2024 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import http from 'k6/http';
// @ts-expect-error https://github.com/grafana/k6-jslib-testing
import { expect } from 'https://jslib.k6.io/k6-testing/0.5.0/index.js';
import { sleep } from 'k6';
import { type Options } from 'k6/options';
import { generateFGNR } from './fgnr_generate.js';

const baseUrl = 'https://localhost:3000';
const restUrl = `${baseUrl}/rest`;
const graphqlUrl = `${baseUrl}/graphql`;
const tokenUrl = `${baseUrl}/auth/token`;
const dbPopulateUrl = `${baseUrl}/dev/db_populate`;

// -----------------------------------------------------------------------------
// Testdaten – an dein Auto-Projekt angepasst
// -----------------------------------------------------------------------------
const ids = [1, 20, 30, 40, 50, 60, 70, 80, 90];

// Teilstrings, die in BMW / AUDI / MERCEDES / PORSCHE vorkommen
const modellTeile = ['a', 'o', 'e'];
const modellNichtVorhanden = ['qqq', 'xxx', 'yyy', 'zzz'];

// FGNRs aus deiner auto.csv
const fgnrs = [
    '1-0001-6',
    '1-0020-6',
    '1-0030-6',
    '1-0040-6',
    '1-0050-6',
    '1-0060-6',
];

// Schlagwörter aus deiner CSV (im DB-Inhalt als UPPERCASE)
const schlagwoerter = ['sport', 'komfort'];

const tlsDir = '../../src/config/resources/tls';
const cert = open(`${tlsDir}/certificate.crt`);
const key = open(`${tlsDir}/key.pem`);

// https://grafana.com/docs/k6/latest/using-k6/test-lifecycle
export function setup() {
    const tokenHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = 'username=admin&password=p';
    const tokenResponse = http.post<'text'>(tokenUrl, body, {
        headers: tokenHeaders,
    });
    let token: string;
    if (tokenResponse.status === 200) {
        token = JSON.parse(tokenResponse.body).access_token;
        console.log(`token=${token}`);
    } else {
        throw new Error(
            `setup fuer adminToken: status=${tokenResponse.status}, body=${tokenResponse.body}`,
        );
    }

    const headers = { Authorization: `Bearer ${token}` };
    const res = http.post(dbPopulateUrl, undefined, { headers });
    if (res.status === 200) {
        console.log('DB neu geladen');
    } else {
        throw new Error(
            `setup fuer db_populate: status=${res.status}, body=${res.body}`,
        );
    }
}

const rampUpDuration = '5s';
const steadyDuration = '22s';
const rampDownDuration = '3s';

export const options: Options = {
    batchPerHost: 50,
    // httpDebug: 'headers',

    scenarios: {
        get_id: {
            exec: 'getById',
            executor: 'ramping-vus',
            stages: [
                { target: 2, duration: rampUpDuration },
                { target: 2, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_id_not_modified: {
            exec: 'getByIdNotModified',
            executor: 'ramping-vus',
            stages: [
                { target: 5, duration: rampUpDuration },
                { target: 5, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_modell: {
            // jetzt: Suche nach Modell-Teilstring
            exec: 'getByModell',
            executor: 'ramping-vus',
            stages: [
                { target: 20, duration: rampUpDuration },
                { target: 20, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_fgnr: {
            // jetzt: Suche nach FGNR
            exec: 'getByFGNR',
            executor: 'ramping-vus',
            stages: [
                { target: 10, duration: rampUpDuration },
                { target: 10, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        get_schlagwort: {
            exec: 'getBySchlagwort',
            executor: 'ramping-vus',
            stages: [
                { target: 15, duration: rampUpDuration },
                { target: 15, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        post_auto: {
            // jetzt: POST Auto
            exec: 'postAuto',
            executor: 'ramping-vus',
            stages: [
                { target: 3, duration: rampUpDuration },
                { target: 3, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        query_auto: {
            // jetzt: GraphQL Auto
            exec: 'queryAuto',
            executor: 'ramping-vus',
            stages: [
                { target: 3, duration: rampUpDuration },
                { target: 3, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        query_autos: {
            // jetzt: GraphQL autos(...)
            exec: 'queryAutos',
            executor: 'ramping-vus',
            stages: [
                { target: 5, duration: rampUpDuration },
                { target: 5, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
        query_autos_nicht_vorhanden: {
            exec: 'queryAutosNichtVorhanden',
            executor: 'ramping-vus',
            stages: [
                { target: 2, duration: rampUpDuration },
                { target: 2, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },

        // Scenarios mit 404 NOT_FOUND -> http_req_failed
        get_modell_nicht_vorhanden: {
            exec: 'getByModellNichtVorhanden',
            executor: 'ramping-vus',
            stages: [
                { target: 3, duration: rampUpDuration },
                { target: 3, duration: steadyDuration },
                { target: 0, duration: rampDownDuration },
            ],
        },
    },

    tlsAuth: [
        {
            cert,
            key,
        },
    ],
    tlsVersion: http.TLS_1_3, // DevSkim: ignore DS440000
    insecureSkipTLSVerify: true,
};

// -----------------------------------------------------------------------------
// HTTP-Requests mit Ueberpruefungen
// -----------------------------------------------------------------------------
// GET /rest/<id>
export function getById() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const response = http.get(`${restUrl}/${id}`);

    const { status, headers } = response;
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    sleep(1);
}

// GET /rest/<id> mit If-None-Match
export function getByIdNotModified() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const headers: Record<string, string> = {
        'If-None-Match': '"0"',
    };
    const response = http.get(`${restUrl}/${id}`, { headers });

    expect(response.status).toBe(304);
    sleep(1);
}

// GET /rest?modell=<value>  (ehemals Titel)
export function getByModell() {
    const teil = modellTeile[Math.floor(Math.random() * modellTeile.length)];
    const response = http.get(`${restUrl}?modell=${teil}`);

    const { status, headers } = response;
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    sleep(1);
}

// 404 GET /rest?modell=<value> (nicht vorhanden)
export function getByModellNichtVorhanden() {
    const teil =
        modellNichtVorhanden[
            Math.floor(Math.random() * modellNichtVorhanden.length)
        ];
    const response = http.get(`${restUrl}?modell=${teil}`);

    expect(response.status).toBe(404);
    sleep(1);
}

// GET /rest?fgnr=<value> (ehemals ISBN)
export function getByFGNR() {
    const fgnr = fgnrs[Math.floor(Math.random() * fgnrs.length)];
    const response = http.get(`${restUrl}?fgnr=${fgnr}`);

    const { status, headers } = response;
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    sleep(1);
}

// GET /rest?<schlagwort>=true
export function getBySchlagwort() {
    const schlagwort =
        schlagwoerter[Math.floor(Math.random() * schlagwoerter.length)];
    const response = http.get(`${restUrl}?${schlagwort}=true`);

    const { status, headers } = response;
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    sleep(1);
}

// POST /rest  (neues Auto)
export function postAuto() {
    const schlagwort =
        schlagwoerter[Math.floor(Math.random() * schlagwoerter.length)];

    // 🔁 Statt { ...neuesAuto } bauen wir das Auto direkt,
    // genau wie beim erfolgreichen REST-Integrationstest
    const auto = {
        fgnr: generateFGNR(),                         // eindeutige FGNR
        art: 'LIMO',                                  // gültiger Enum-Wert
        preis: 1999.99,                               // positiv
        rabatt: 10,                                   // 0–100
        lieferbar: true,
        datum: '2025-02-28',                          // ISO-Datum (nur Datum)
        schlagwoerter: [schlagwort?.toUpperCase() ?? 'N/A'],
        // KEIN modell
        // KEINE bilder
    };

    // Token holen wie gehabt
    const tokenHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const body = 'username=admin&password=p';
    const tokenResponse = http.post<'text'>(tokenUrl, body, {
        headers: tokenHeaders,
    });
    expect(tokenResponse.status).toBe(200);
    const token = JSON.parse(tokenResponse.body).access_token;

    const requestHeaders = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    const response = http.post(restUrl, JSON.stringify(auto), {
        headers: requestHeaders,
    });

    const { status, headers } = response;
    expect(status).toBe(201);
    expect(headers['Location']).toContain(restUrl);

    sleep(1);
}


// POST /graphql query "auto"
export function queryAuto() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const body = {
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
                }
            }
        `,
    };
    const requestHeaders = { 'Content-Type': 'application/json' };

    const response = http.post(graphqlUrl, JSON.stringify(body), {
        headers: requestHeaders,
    });

    const { status, headers } = response;
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    sleep(1);
}

// POST /graphql query "autos"
export function queryAutos() {
    const teil = modellTeile[Math.floor(Math.random() * modellTeile.length)];
    const body = {
        query: `
            {
                autos(suchparameter: {
                    modell: "${teil}"
                }) {
                    art
                    schlagwoerter
                    modell {
                        modell
                    }
                }
            }
        `,
    };
    const requestHeaders = { 'Content-Type': 'application/json' };

    const response = http.post(graphqlUrl, JSON.stringify(body), {
        headers: requestHeaders,
    });

    const { status, headers } = response;
    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    sleep(1);
}

// POST /graphql query "autos" nicht gefunden
export function queryAutosNichtVorhanden() {
    const body = {
        query: `
            {
                autos(suchparameter: {
                    modell: "NICHT_VORHANDEN"
                }) {
                    schlagwoerter
                }
            }
        `,
    };
    const headers = { 'Content-Type': 'application/json' };

    const response = http.post(graphqlUrl, JSON.stringify(body), { headers });

    // Fachlich: BAD_USER_INPUT, technisch bleibt 200
    expect(response.status).toBe(200);
    sleep(1);
}
