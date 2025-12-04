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
 * Typdefinitionen für die Suche im AutoService.
 * @packageDocumentation
 */

import { type autoart } from '../../generated/prisma/enums.js';

// Typdefinition für `find`
export type Suchparameter = {
    readonly fgnr?: string;
    readonly art?: autoart;
    readonly preis?: number | string;
    readonly rabatt?: number | string;
    readonly lieferbar?: boolean | string;
    readonly datum?: string;
    readonly schlagwort?: string;       // Einzelnes Schlagwort suchen
    readonly modell?: string;           // Modellname (BMW, AUDI ...)
};

// gültige Namen für die Suchparameter
export const suchparameterNamen = [
    'fgnr',
    'art',
    'preis',
    'rabatt',
    'lieferbar',
    'datum',
    'schlagwort',
    'modell',
];
