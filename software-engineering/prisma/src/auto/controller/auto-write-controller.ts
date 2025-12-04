/* eslint-disable max-lines */
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
 * Controller-Klasse für Schreiboperationen der Auto-REST-Schnittstelle.
 * @packageDocumentation
 */

import {
    Body,
    Controller,
    Delete,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Req,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { type MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiHeader,
    ApiNoContentResponse,
    ApiOperation,
    ApiParam,
    ApiPreconditionFailedResponse,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { AuthGuard, Public, Roles } from 'nest-keycloak-connect';
import { paths } from '../../config/paths.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    AutoCreate,
    type AutoFileCreated,
    AutoUpdate,
    AutoWriteService,
} from '../service/auto-write-service.js';
import { AutoDTO, AutoDtoOhneRef } from './auto-dto.js';
import { createBaseUri } from './create-base-uri.js';
import { InvalidMimeTypeException } from './exceptions.js';

const MSG_FORBIDDEN = 'Kein Token mit ausreichender Berechtigung vorhanden';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'video/mp4',
    'video/webm',
    'video/quicktime',
]);
// https://github.com/expressjs/multer#multeropts
const MULTER_OPTIONS: MulterOptions = {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_: any, file: any, cb: any) => {
        if (!MIME_TYPES.has(file.mimetype)) {
            return cb(new InvalidMimeTypeException(file.mimetype), false);
        }
        cb(null, true);
    },
};

/**
 * Die Controller-Klasse für die Verwaltung von Autos.
 */
@Controller(paths.rest)
@UseGuards(AuthGuard)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Auto REST-API')
@ApiBearerAuth()
export class AutoWriteController {
    readonly #service: AutoWriteService;

    readonly #logger = getLogger(AutoWriteController.name);

    constructor(service: AutoWriteService) {
        this.#service = service;
    }

    /**
     * Ein neues Auto wird asynchron angelegt. Die Daten für das neue Auto
     * sind als JSON-Datensatz im Request-Body enthalten.
     *
     * Bei erfolgreicher Anlage wird Statuscode `201` (`Created`) gesetzt und
     * im Header `Location` die URI zum neuen Auto zurückgegeben.
     *
     * @param autoDTO JSON-Daten für ein Auto im Request-Body.
     * @param req Request-Objekt von Express für den Location-Header.
     * @param res Response-Objekt von Express.
     */
    @Post()
    @Roles('admin', 'user')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Ein neues Auto anlegen' })
    @ApiCreatedResponse({ description: 'Erfolgreich neu angelegt' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Autodaten' })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async post(
        @Body() autoDTO: AutoDTO,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response> {
        this.#logger.debug('post: autoDTO=%o', autoDTO);

        const auto = this.#autoDtoToAutoCreateInput(autoDTO);
        const id = await this.#service.create(auto);

        const location = `${createBaseUri(req)}/${id}`;
        this.#logger.debug('post: location=%s', location);
        return res.status(HttpStatus.CREATED).location(location).send();
    }

    /**
     * Zu einem gegebenen Auto wird eine Binärdatei, z.B. ein Bild, hochgeladen.
     * Nest realisiert File-Upload mit POST.
     * https://docs.nestjs.com/techniques/file-upload.
     * Postman: Body mit "form-data", key: "file" und "File" im Dropdown-Menü
     *
     * @param id ID des vorhandenen Autos
     * @param file Binärdatei als `File`-Objekt von _Multer_.
     * @param req Request-Objekt von Express für den Location-Header.
     * @param res Response-Objekt von Express.
     */
    // eslint-disable-next-line max-params
    @Post(':id')
    @Public()
    // @Roles({ roles: ['admin']})
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS))
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Binärdatei mit einem Bild zu einem Auto hochladen' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiCreatedResponse({ description: 'Erfolgreich hinzugefügt' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Datei' })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async addFile(
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response> {
        const { buffer, originalname, size } = file;
        this.#logger.debug(
            'addFile: id: %d, originalname=%s, size=%d, options=%o',
            id,
            originalname,
            size,
            MULTER_OPTIONS,
        );

        const autoFile: AutoFileCreated | undefined =
            await this.#service.addFile(id, buffer, originalname, size);
        this.#logger.debug(
            'addFile: id=%d, byteLength=%d, filename=%s, mimetype=%s',
            autoFile?.id ?? -1,
            autoFile?.data.byteLength ?? -1,
            autoFile?.filename ?? 'undefined',
            autoFile?.mimetype ?? 'null',
        );

        const location = `${createBaseUri(req)}/file/${id}`;
        this.#logger.debug('addFile: location=%s', location);
        return res.location(location).send();
    }

    /**
     * Ein vorhandenes Auto wird asynchron aktualisiert.
     *
     * Im Request-Objekt von Express muss die ID des zu aktualisierenden Autos
     * als Pfad-Parameter enthalten sein. Außerdem muss im Request-Body das zu
     * aktualisierende Auto als JSON-Datensatz enthalten sein. Für die
     * optimistische Synchronisation muss im Header `If-Match` die korrekte
     * Version angegeben sein.
     *
     * @param autoDTO Autodaten im Body des Request-Objekts.
     * @param id Pfad-Parameter für die ID.
     * @param version Versionsnummer aus dem Header _If-Match_.
     * @param res Response-Objekt von Express.
     */
    // eslint-disable-next-line max-params
    @Put(':id')
    @Roles('admin', 'user')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Ein vorhandenes Auto aktualisieren' })
    @ApiHeader({
        name: 'If-Match',
        description: 'Header für optimistische Synchronisation',
        required: false,
    })
    @ApiNoContentResponse({ description: 'Erfolgreich aktualisiert' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Autodaten' })
    @ApiPreconditionFailedResponse({
        description: 'Falsche Version im Header "If-Match"',
    })
    @ApiResponse({
        status: HttpStatus.PRECONDITION_REQUIRED,
        description: 'Header "If-Match" fehlt',
    })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async put(
        @Body() autoDTO: AutoDtoOhneRef,
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @Headers('If-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response> {
        this.#logger.debug(
            'put: id=%d, autoDTO=%o, version=%s',
            id,
            autoDTO,
            version ?? 'undefined',
        );

        if (version === undefined) {
            const msg = 'Header "If-Match" fehlt';
            this.#logger.debug('put: msg=%s', msg);
            return res
                .status(HttpStatus.PRECONDITION_REQUIRED)
                .set('Content-Type', 'application/json')
                .send(msg);
        }

        const auto = this.#autoDtoToAutoUpdate(autoDTO);
        const neueVersion = await this.#service.update({ id, auto, version });
        this.#logger.debug('put: version=%d', neueVersion);
        return res.header('ETag', `"${neueVersion}"`).send();
    }

    /**
     * Ein Auto wird anhand seiner ID gelöscht, die als Pfad-Parameter
     * angegeben ist. Der zurückgelieferte Statuscode ist `204` (`No Content`).
     *
     * @param id Pfad-Parameter für die ID.
     */
    @Delete(':id')
    @Roles('admin')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Auto mit der ID löschen' })
    @ApiNoContentResponse({
        description: 'Das Auto wurde gelöscht oder war nicht vorhanden',
    })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async delete(@Param('id') id: number) {
        this.#logger.debug('delete: id=%d', id);
        await this.#service.delete(id);
    }

    // -----------------------------------------------------------------------
    // Mapping-Funktionen von DTO -> Service-Input
    // -----------------------------------------------------------------------

    #autoDtoToAutoCreateInput(autoDTO: AutoDTO): AutoCreate {
        const bilder =
            autoDTO.bilder?.map((bildDTO) => ({
                beschriftung: bildDTO.beschriftung,
                content_type: bildDTO.contentType,
            })) ?? [];

        const modell =
            autoDTO.modell === undefined
                ? undefined
                : {
                      create: {
                          modell: autoDTO.modell.modell,
                      },
                  };

        const bild =
            bilder.length === 0
                ? undefined
                : {
                      create: bilder,
                  };

        const preis =
            typeof autoDTO.preis === 'number'
                ? autoDTO.preis
                : Number(autoDTO.preis);

        const datumValue =
            autoDTO.datum === undefined || autoDTO.datum === null
                ? null
                : typeof autoDTO.datum === 'string'
                  ? new Date(autoDTO.datum)
                  : autoDTO.datum;

        const auto: AutoCreate = {
            version: 0,
            fgnr: autoDTO.fgnr,
            art: autoDTO.art ?? null,
            preis,
            rabatt: Number(autoDTO.rabatt ?? 0),
            lieferbar: autoDTO.lieferbar ?? false,
            datum: datumValue,
            schlagwoerter: autoDTO.schlagwoerter ?? [],
            modell: modell as any,
            bild: bild as any,
        };
        return auto;
    }

    #autoDtoToAutoUpdate(autoDTO: AutoDtoOhneRef): AutoUpdate {
        const preis =
            typeof autoDTO.preis === 'number'
                ? autoDTO.preis
                : Number(autoDTO.preis);

        const datumValue =
            autoDTO.datum === undefined || autoDTO.datum === null
                ? null
                : typeof autoDTO.datum === 'string'
                  ? new Date(autoDTO.datum)
                  : autoDTO.datum;

        return {
            fgnr: autoDTO.fgnr,
            art: autoDTO.art ?? null,
            preis,
            rabatt: Number(autoDTO.rabatt ?? 0),
            lieferbar: autoDTO.lieferbar ?? false,
            datum: datumValue,
            schlagwoerter: autoDTO.schlagwoerter ?? [],
        };
    }
}
/* eslint-enable max-lines */
