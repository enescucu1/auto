// Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Controller-Klasse für Leseoperationen an der REST-Schnittstelle für Autos.
 * @packageDocumentation
 */

// eslint-disable-next-line max-classes-per-file
import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    NotFoundException,
    Param,
    ParseIntPipe,
    Query,
    Req,
    Res,
    StreamableFile,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { Public } from 'nest-keycloak-connect';
import { paths } from '../../config/paths.js';
import { autoart } from '../../generated/prisma/enums.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    type AutoMitModell,
    AutoMitModellUndBilder,
    AutoService,
} from '../service/auto-service.js';
import { createPageable } from '../service/pageable.js';
import { type Suchparameter } from '../service/suchparameter.js';
import { createPage, Page } from './page.js';

/**
 * Klasse für `AutoQuery`, um Queries in OpenAPI/Swagger zu beschreiben.
 * Entspricht den Suchparametern aus `Suchparameter`, erweitert um Paging.
 */
export class AutoQuery implements Suchparameter {
    @ApiProperty({ required: false })
    declare fgnr?: string;

    @ApiProperty({ required: false, enum: autoart })
    declare art?: autoart;

    @ApiProperty({ required: false })
    declare preis?: number;

    @ApiProperty({ required: false })
    declare rabatt?: number;

    @ApiProperty({ required: false })
    declare lieferbar?: boolean;

    @ApiProperty({ required: false })
    declare datum?: string;

    @ApiProperty({ required: false, description: 'z.B. SPORT oder KOMFORT' })
    declare schlagwort?: string;

    // Convenience-Queryparameter für die Tests:
    //  /rest?sport=true    -> schlagwort = 'SPORT'
    //  /rest?komfort=true  -> schlagwort = 'KOMFORT'
    @ApiProperty({
        required: false,
        description: 'Mindestens 1 Auto mit Schlagwort SPORT (sport=true)',
    })
    declare sport?: string;

    @ApiProperty({
        required: false,
        description: 'Mindestens 1 Auto mit Schlagwort KOMFORT (komfort=true)',
    })
    declare komfort?: string;

    @ApiProperty({ required: false, description: 'z.B. BMW, AUDI, MERCEDES' })
    declare modell?: string;

    @ApiProperty({ required: false })
    declare size?: string;

    @ApiProperty({ required: false })
    declare page?: string;

    @ApiProperty({ required: false, enum: ['count'] })
    declare only?: 'count';
}

export type CountResult = Record<'count', number>;

/**
 * Die Controller-Klasse für die Verwaltung von Autos (nur Lesen).
 */
@Controller(paths.rest)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Auto REST-API')
// @ApiBearerAuth()
export class AutoController {
    readonly #service: AutoService;

    readonly #logger = getLogger(AutoController.name);

    constructor(service: AutoService) {
        this.#service = service;
    }

    /**
     * Ein Auto wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * ETag-/If-None-Match-Handling wie im Buch-Projekt:
     * - Wenn `If-None-Match` der aktuellen Version entspricht: 304 Not Modified
     * - Sonst: 200 OK + Auto als JSON
     */
    // eslint-disable-next-line max-params
    @Get(':id')
    @Public()
    @ApiOperation({ summary: 'Suche mit der Auto-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Das Auto wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Kein Auto zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Das Auto wurde bereits heruntergeladen',
    })
    async getById(
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<AutoMitModellUndBilder>> {
        this.#logger.debug('getById: id=%d, version=%s', id, version ?? '-1');

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('getById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const auto = await this.#service.findById({ id });
        this.#logger.debug('getById(): auto=%o', auto);

        const versionDb = auto.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('getById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        this.#logger.debug('getById: versionDb=%d', versionDb ?? -1);
        res.header('ETag', `"${versionDb}"`);

        this.#logger.debug('getById: auto=%o', auto);
        return res.json(auto);
    }

    /**
     * Autos werden mit Query-Parametern asynchron gesucht.
     *
     * - Ohne Query-Parameter: alle Autos
     * - Mit `only=count`: nur Anzahl zurückgeben
     * - Sonst: Page-Objekt (content + totalElements + page/size)
     */
    @Get()
    @Public()
    @ApiOperation({ summary: 'Suche mit Suchparametern' })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Autos' })
    async get(
        @Query() query: AutoQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<Page<Readonly<AutoMitModell>> | CountResult>> {
        this.#logger.debug('get: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('get: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        // mutable Kopie der Query-Parameter erzeugen
        const q: any = { ...query };

        const { only } = q;
        if (only !== undefined) {
            const count = await this.#service.count();
            this.#logger.debug('get: count=%d', count);
            return res.json({ count });
        }

        const { page, size } = q;
        delete q.page;
        delete q.size;

        // Convenience-Mapping:
        //  ?sport=true    -> schlagwort = 'SPORT'
        //  ?komfort=true  -> schlagwort = 'KOMFORT'
        if (q.sport === 'true') {
            q.schlagwort = 'SPORT';
        }
        if (q.komfort === 'true') {
            q.schlagwort = 'KOMFORT';
        }
        delete q.sport;
        delete q.komfort;

        // undefined-Properties entfernen
        Object.keys(q).forEach((key) => {
            if (q[key] === undefined) {
                delete q[key];
            }
        });

        this.#logger.debug('get: mapped query=%o', q);

        const pageable = createPageable({ number: page, size });
        const autosSlice = await this.#service.find(
            q as unknown as Suchparameter,
            pageable,
        ); // NOSONAR
        const autoPage = createPage(autosSlice, pageable);
        this.#logger.debug('get: autoPage=%o', autoPage);

        return res.json(autoPage).send();
    }

    /**
     * Zu einem Auto mit gegebener ID wird die zugehörige Binärdatei, z.B.
     * ein Bild oder ein Video, heruntergeladen.
     *
     * @param idStr Pfad-Parameter `id`.
     * @param res Response-Objekt von Express.
     */
    @Get('/file/:id')
    @Public()
    @ApiOperation({ description: 'Suche nach Datei mit der Auto-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiNotFoundResponse({ description: 'Keine Datei zur Auto-ID gefunden' })
    @ApiOkResponse({ description: 'Die Datei wurde gefunden' })
    async getFileById(
        @Param('id') idStr: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.#logger.debug('getFileById: autoId:%s', idStr);

        const id = Number(idStr);
        if (!Number.isInteger(id)) {
            this.#logger.debug('getFileById: not isInteger()');
            throw new NotFoundException(`Die Auto-ID ${idStr} ist ungueltig.`);
        }

        const autoFile = await this.#service.findFileByAutoId(id);
        if (autoFile?.data === undefined) {
            throw new NotFoundException('Keine Datei gefunden.');
        }

        res.contentType(autoFile.mimetype ?? 'image/png').set({
            'Content-Disposition': `inline; filename="${autoFile.filename}"`, // eslint-disable-line @typescript-eslint/naming-convention
        });
        return new StreamableFile(autoFile.data);
    }
}
