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

/**
 * Das Modul besteht aus der Klasse {@linkcode WhereBuilder} für Autos.
 * @packageDocumentation
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { type autoWhereInput } from '../../generated/prisma/models/auto.js';
import { getLogger } from '../../logger/logger.js';
import { type Suchparameter } from './suchparameter.js';

/**
 * Die Klasse `WhereBuilder` baut die WHERE-Klausel für DB-Anfragen mit _Prisma_
 * für die Entity `auto`.
 */
@Injectable()
export class WhereBuilder {
    readonly #logger = getLogger(WhereBuilder.name);

    /**
     * WHERE-Klausel für die flexible Suche nach Autos bauen.
     *
     * @param suchparameter JSON-Objekt mit Suchparametern.
     *  - `modell`: Teilstring des Modellnamens (BMW, AUDI, ...)
     *  - `fgnr`: exakte Fahrgestellnummer
     *  - `preis`: Obergrenze für den Preis (<=)
     *  - `rabatt`: Mindest-Rabatt (>=)
     *  - `lieferbar`: true/false
     *  - `datum`: frühestes Datum (>=)
     *  - `schlagwort`: muss im JSON-Array `schlagwoerter` enthalten sein
     *
     * @returns autoWhereInput
     */
    // eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity
    build(
        { schlagwort, ...restProps }: Suchparameter & { schlagwort?: string },
    ) {
        this.#logger.debug(
            'build: schlagwort=%s, restProps=%o',
            schlagwort ?? 'undefined',
            restProps,
        );

        const where: autoWhereInput = {};

        // Properties vom Typ string, number, enum, boolean, Date
        Object.entries(restProps).forEach(([key, value]) => {
            switch (key) {
                case 'modell':
                    where.modell = {
                        modell: {
                            contains: value as string,
                            mode: Prisma.QueryMode.insensitive,
                        },
                    };
                    break;
                case 'fgnr':
                    where.fgnr = {
                        startsWith: value as string,
                    };
                    break;
                case 'preis': {
                    const preisNumber = Number.parseFloat(value as string);
                    if (!Number.isNaN(preisNumber)) {
                        where.preis = { lte: preisNumber };
                    }
                    break;
                }
                case 'rabatt': {
                    const rabattNumber = Number.parseInt(value as string, 10);
                    if (!Number.isNaN(rabattNumber)) {
                        // Mindest-Rabatt
                        where.rabatt = { gte: rabattNumber };
                    }
                    break;
                }
                case 'art':
                    // enum autoart
                    where.art = { equals: value as any };
                    break;
                case 'lieferbar': {
                    let boolValue: boolean;
                    if (typeof value === 'string') {
                        boolValue = value.toLowerCase() === 'true';
                    } else {
                        boolValue = Boolean(value);
                    }
                    where.lieferbar = { equals: boolValue };
                    break;
                }
                case 'datum':
                    // frühestes Datum
                    where.datum = { gte: new Date(value as string) };
                    break;
            }
        });

        const schlagwoerter = this.#buildSchlagwoerter(schlagwort);
        if (schlagwoerter !== undefined) {
            where.schlagwoerter = { has: schlagwoerter };
        }

        this.#logger.debug('build: where=%o', where);
        return where;
    }

    #buildSchlagwoerter(schlagwort?: string): string | undefined {
        if (schlagwort === undefined || schlagwort.trim() === '') {
            return undefined;
        }
        return schlagwort.toUpperCase();
    }
}
