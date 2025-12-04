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
 * Das Modul besteht aus der Klasse {@linkcode AutoWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import {
    AutoFile,
    type Prisma,
    PrismaClient,
} from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { MailService } from '../../mail/mail-service.js';
import { AutoService } from './auto-service.js';
import {
    FgnrExistsException,
    VersionInvalidException,
    VersionOutdatedException,
} from './exceptions.js';
import { PrismaService } from './prisma-service.js';

export type AutoCreate = Prisma.autoCreateInput;
type AutoCreated = Prisma.autoGetPayload<{
    include: {
        modell: true;
        bild: true;
    };
}>;

export type AutoUpdate = Prisma.autoUpdateInput;
/** Typdefinitionen zum Aktualisieren eines Autos mit `update`. */
export type UpdateParams = {
    /** ID des zu aktualisierenden Autos. */
    readonly id: number | undefined;
    /** Auto-Objekt mit den aktualisierten Werten. */
    readonly auto: AutoUpdate;
    /** Versionsnummer für die zu aktualisierenden Werte. */
    readonly version: string;
};

type AutoFileCreate = Prisma.AutoFileUncheckedCreateInput;
export type AutoFileCreated = Prisma.AutoFileGetPayload<{}>;

/**
 * Die Klasse `AutoWriteService` implementiert den Anwendungskern für das
 * Schreiben von Autos und greift mit _Prisma_ auf die DB zu.
 */
@Injectable()
export class AutoWriteService {
    private static readonly VERSION_PATTERN = /^"\d{1,3}"/u;

    readonly #prisma: PrismaClient;

    readonly #readService: AutoService;

    readonly #mailService: MailService;

    readonly #logger = getLogger(AutoWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        prisma: PrismaService,
        readService: AutoService,
        mailService: MailService,
    ) {
        this.#prisma = prisma.client;
        this.#readService = readService;
        this.#mailService = mailService;
    }

    /**
     * Ein neues Auto soll angelegt werden.
     * @param auto Das neu anzulegende Auto.
     * @returns Die ID des neu angelegten Autos.
     * @throws FgnrExistsException falls die Fahrgestellnummer bereits existiert.
     */
    async create(auto: AutoCreate) {
        this.#logger.debug('create: auto=%o', auto);
        await this.#validateCreate(auto);

        // Neuer Datensatz mit generierter ID
        let autoDb: AutoCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            autoDb = await tx.auto.create({
                data: auto,
                include: { modell: true, bild: true },
            });
        });
        await this.#sendmail({
            id: autoDb?.id ?? 'N/A',
            modell: autoDb?.modell?.modell ?? 'N/A',
        });

        this.#logger.debug('create: autoDb.id=%s', autoDb?.id ?? 'N/A');
        return autoDb?.id ?? Number.NaN;
    }

    /**
     * Zu einem vorhandenen Auto eine Binärdatei mit z.B. einem Bild abspeichern.
     * @param autoId ID des vorhandenen Autos.
     * @param data Bytes der Datei als Buffer (Node).
     * @param filename Dateiname.
     * @param size Dateigröße in Bytes.
     * @returns Entity-Objekt für `AutoFile` oder undefined.
     */
    // eslint-disable-next-line max-params
    async addFile(
        autoId: number,
        data: Uint8Array<ArrayBufferLike>,
        filename: string,
        size: number,
    ): Promise<Readonly<AutoFile> | undefined> {
        this.#logger.debug(
            'addFile: autoId=%d, filename=%s, size=%d',
            autoId,
            filename,
            size,
        );

        // TODO Dateigroesse pruefen

        let autoFileCreated: AutoFileCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            // Auto ermitteln, falls vorhanden
            const auto = await tx.auto.findUnique({
                where: { id: autoId },
            });
            if (auto === null) {
                this.#logger.debug('Es gibt kein Auto mit der ID %d', autoId);
                throw new NotFoundException(
                    `Es gibt kein Auto mit der ID ${autoId}.`,
                );
            }

            // evtl. vorhandene Datei löschen
            await tx.autoFile.deleteMany({ where: { autoId } });

            const fileType = await fileTypeFromBuffer(data);
            const mimetype = fileType?.mime ?? null;
            this.#logger.debug('addFile: mimetype=%s', mimetype ?? 'undefined');

            const autoFile: AutoFileCreate = {
                filename,
                data: data as unknown as Uint8Array<ArrayBuffer>,
                mimetype,
                autoId,
            };
            autoFileCreated = await tx.autoFile.create({ data: autoFile });
        });

        this.#logger.debug(
            'addFile: id=%d, byteLength=%d, filename=%s, mimetype=%s',
            autoFileCreated?.id ?? Number.NaN,
            autoFileCreated?.data.byteLength ?? Number.NaN,
            autoFileCreated?.filename ?? 'undefined',
            autoFileCreated?.mimetype ?? 'null',
        );
        return autoFileCreated;
    }

    /**
     * Ein vorhandenes Auto soll aktualisiert werden.
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation.
     * @throws NotFoundException falls kein Auto zur ID vorhanden ist.
     * @throws VersionInvalidException falls die Versionsnummer ungültig ist.
     * @throws VersionOutdatedException falls die Versionsnummer veraltet ist.
     */
    async update({ id, auto, version }: UpdateParams) {
        this.#logger.debug(
            'update: id=%d, auto=%o, version=%s',
            id ?? Number.NaN,
            auto,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            throw new NotFoundException(`Es gibt kein Auto mit der ID ${id}.`);
        }

        await this.#validateUpdate(id, version);

        auto.version = { increment: 1 };
        let autoUpdated: Prisma.autoGetPayload<{}> | undefined;
        await this.#prisma.$transaction(async (tx) => {
            autoUpdated = await tx.auto.update({
                data: auto,
                where: { id },
            });
        });
        this.#logger.debug(
            'update: autoUpdated=%s',
            JSON.stringify(autoUpdated),
        );

        return autoUpdated?.version ?? Number.NaN;
    }

    /**
     * Ein Auto wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Autos.
     * @returns true, falls das Auto vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);

        const auto = await this.#prisma.auto.findUnique({
            where: { id },
        });
        if (auto === null) {
            this.#logger.debug('delete: not found');
            return false;
        }

        await this.#prisma.$transaction(async (tx) => {
            await tx.auto.delete({ where: { id } });
        });

        this.#logger.debug('delete');
        return true;
    }

    // ---------------------------------------------------------------------
    // Private Validierungs- und Hilfsfunktionen
    // ---------------------------------------------------------------------

    async #validateCreate({
        fgnr,
    }: Prisma.autoCreateInput): Promise<undefined> {
        this.#logger.debug('#validateCreate: fgnr=%s', fgnr ?? 'undefined');
        if (fgnr === undefined) {
            this.#logger.debug('#validateCreate: ok (keine fgnr)');
            return;
        }

        const anzahl = await this.#prisma.auto.count({ where: { fgnr } });
        if (anzahl > 0) {
            this.#logger.debug('#validateCreate: fgnr existiert: %s', fgnr);
            throw new FgnrExistsException(fgnr);
        }
        this.#logger.debug('#validateCreate: ok');
    }

    async #sendmail({ id, modell }: { id: number | 'N/A'; modell: string }) {
        const subject = `Neues Auto ${id}`;
        const body = `Das Auto mit dem Modell <strong>${modell}</strong> ist angelegt`;
        await this.#mailService.sendmail({ subject, body });
    }

    async #validateUpdate(id: number, versionStr: string) {
        this.#logger.debug(
            '#validateUpdate: id=%d, versionStr=%s',
            id,
            versionStr,
        );
        if (!AutoWriteService.VERSION_PATTERN.test(versionStr)) {
            throw new VersionInvalidException(versionStr);
        }

        const version = Number.parseInt(versionStr.slice(1, -1), 10);
        const autoDb = await this.#readService.findById({ id });

        if (version < autoDb.version) {
            this.#logger.debug('#validateUpdate: versionDb=%d', version);
            throw new VersionOutdatedException(version);
        }
    }
}
