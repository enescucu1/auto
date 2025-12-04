// Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; nicht einmal die implizite Garantie der
// MARKTGÄNGIGKEIT oder EIGNUNG FÜR EINEN BESTIMMTEN ZWECK.
//
// You should have received a copy of the GNU General Public License
// along with this program. If nicht, see <https://www.gnu.org/licenses/>.

/**
 * Hilfsfunktion, um die Basis-URI für Location-Header zu bauen.
 */

import { type Request } from 'express';
import { nodeConfig } from '../../config/node.js';
import { AutoService } from '../service/auto-service.js';

const port = `:${nodeConfig.port}`;

export const createBaseUri: ({
    protocol,
    hostname,
    url,
}: Request) => string = ({ protocol, hostname, url }: Request) => {
    // Query-String entfernen
    let basePath = url.includes('?') ? url.slice(0, url.lastIndexOf('?')) : url;

    // Falls die URL am Ende eine ID trägt, entfernen (z.B. /api/auto/1 → /api/auto)
    const indexLastSlash = basePath.lastIndexOf('/');
    if (indexLastSlash > 0) {
        const idStr = basePath.slice(indexLastSlash + 1);
        if (AutoService.ID_PATTERN.test(idStr)) {
            basePath = basePath.slice(0, indexLastSlash);
        }
    }

    return `${protocol}://${hostname}${port}${basePath}`;
};
