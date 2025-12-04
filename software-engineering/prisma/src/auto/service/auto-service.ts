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
 * Das Modul besteht aus der Klasse {@linkcode AutoService}.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
    Prisma,
    PrismaClient,
    AutoFile,
} from '../../generated/prisma/client.js';
import { type autoInclude } from '../../generated/prisma/models/auto.js';
import { getLogger } from '../../logger/logger.js';
import { type Pageable } from './pageable.js';
import { PrismaService } from './prisma-service.js';
import { type Slice } from './slice.js';
import { type Suchparameter, suchparameterNamen } from './suchparameter.js';
import { WhereBuilder } from './where-builder.js';

// Typdefinition für `findById`
type FindByIdParams = {
    // ID des gesuchten Autos
    readonly id: number;
    /** Sollen die Bilder mitgeladen werden? */
    readonly mitBilder?: boolean;
};

export type AutoMitModell = Prisma.autoGetPayload<{
    include: { modell: true };
}>;

export type AutoMitModellUndBilder = Prisma.autoGetPayload<{
    include: {
        modell: true;
        bild: true;
    };
}>;

/**
 * Die Klasse `AutoService` implementiert das Lesen für Autos und greift
 * mit _Prisma_ auf eine relationale DB zu.
 */
@Injectable()
export class AutoService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #prisma: PrismaClient;
    readonly #whereBuilder: WhereBuilder;
    readonly #includeModell: autoInclude = { modell: true };
    readonly #includeModellUndBilder: autoInclude = {
        modell: true,
        bild: true,
    };

    readonly #logger = getLogger(AutoService.name);

    constructor(prisma: PrismaService, whereBuilder: WhereBuilder) {
        this.#prisma = prisma.client;
        this.#whereBuilder = whereBuilder;
    }

    /**
     * Ein Auto asynchron anhand seiner ID suchen.
     * @param id ID des gesuchten Autos
     * @returns Das gefundene Auto in einem Promise aus ES2015.
     * @throws NotFoundException falls kein Auto mit der ID existiert
     */
    async findById({
        id,
        mitBilder = false,
    }: FindByIdParams): Promise<Readonly<AutoMitModellUndBilder>> {
        this.#logger.debug('findById: id=%d', id);

        const include = mitBilder
            ? this.#includeModellUndBilder
            : this.#includeModell;
        const auto: AutoMitModellUndBilder | null =
            await this.#prisma.auto.findUnique({
                where: { id },
                include,
            });
        if (auto === null) {
            this.#logger.debug('Es gibt kein Auto mit der ID %d', id);
            throw new NotFoundException(`Es gibt kein Auto mit der ID ${id}.`);
        }
        // nullish coalescing operator
        auto.schlagwoerter ??= [];

        this.#logger.debug('findById: auto=%o', auto);
        return auto;
    }

    /**
     * Binärdatei zu einem Auto suchen.
     * @param autoId ID des zugehörigen Autos.
     * @returns Binärdatei oder undefined als Promise.
     */
    async findFileByAutoId(
        autoId: number,
    ): Promise<Readonly<AutoFile> | undefined> {
        this.#logger.debug('findFileByAutoId: autoId=%d', autoId);
        const autoFile: AutoFile | null =
            await this.#prisma.autoFile.findUnique({ where: { autoId } });
        if (autoFile === null) {
            this.#logger.debug('findFileByAutoId: Keine Datei gefunden');
            return;
        }

        this.#logger.debug(
            'findFileByAutoId: id=%s, byteLength=%d, filename=%s, mimetype=%s, autoId=%d',
            autoFile.id,
            autoFile.data.byteLength,
            autoFile.filename,
            autoFile.mimetype ?? 'undefined',
            autoFile.autoId,
        );

        return autoFile;
    }

    /**
     * Autos asynchron suchen.
     * @param suchparameter JSON-Objekt mit Suchparametern.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns Ein JSON-Array mit den gefundenen Autos.
     * @throws NotFoundException falls keine Autos gefunden wurden.
     */
    async find(
        suchparameter: Suchparameter | undefined,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<AutoMitModell>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        // Keine Suchparameter?
        if (suchparameter === undefined) {
            return await this.#findAll(pageable);
        }
        const keys = Object.keys(suchparameter);
        if (keys.length === 0) {
            return await this.#findAll(pageable);
        }

        // Falsche Namen fuer Suchparameter?
        if (!this.#checkKeys(keys) || !this.#checkEnums(suchparameter)) {
            this.#logger.debug('Ungueltige Suchparameter');
            throw new NotFoundException('Ungueltige Suchparameter');
        }

        // Lesen: Keine Transaktion erforderlich
        const where = this.#whereBuilder.build(suchparameter);
        const { number, size } = pageable;
        const autos: AutoMitModell[] = await this.#prisma.auto.findMany({
            where,
            skip: number * size,
            take: size,
            include: this.#includeModell,
        });
        if (autos.length === 0) {
            this.#logger.debug('find: Keine Autos gefunden');
            throw new NotFoundException(
                `Keine Autos gefunden: ${JSON.stringify(
                    suchparameter,
                )}, Seite ${pageable.number}}`,
            );
        }
        const totalElements = await this.count();
        return this.#createSlice(autos, totalElements);
    }

    /**
     * Anzahl aller Autos zurückliefern.
     */
    async count() {
        this.#logger.debug('count');
        const count = await this.#prisma.auto.count();
        this.#logger.debug('count: %d', count);
        return count;
    }

    async #findAll(
        pageable: Pageable,
    ): Promise<Readonly<Slice<AutoMitModell>>> {
        const { number, size } = pageable;
        const autos: AutoMitModell[] = await this.#prisma.auto.findMany({
            skip: number * size,
            take: size,
            include: this.#includeModell,
        });
        if (autos.length === 0) {
            this.#logger.debug('#findAll: Keine Autos gefunden');
            throw new NotFoundException(`Ungueltige Seite "${number}"`);
        }
        const totalElements = await this.count();
        return this.#createSlice(autos, totalElements);
    }

    #createSlice(
        autos: AutoMitModell[],
        totalElements: number,
    ): Readonly<Slice<AutoMitModell>> {
        autos.forEach((auto) => {
            auto.schlagwoerter ??= [];
        });
        const autoSlice: Slice<AutoMitModell> = {
            content: autos,
            totalElements,
        };
        this.#logger.debug('createSlice: autoSlice=%o', autoSlice);
        return autoSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        // Ist jeder Suchparameter auch eine Property von auto oder "schlagwoerter"?
        let validKeys = true;
        keys.forEach((key) => {
            if (!suchparameterNamen.includes(key)) {
                this.#logger.debug(
                    '#checkKeys: ungueltiger Suchparameter "%s"',
                    key,
                );
                validKeys = false;
            }
        });

        return validKeys;
    }

    #checkEnums(suchparameter: Suchparameter) {
        const { art } = suchparameter;
        this.#logger.debug(
            '#checkEnums: Suchparameter "art=%s"',
            art ?? 'undefined',
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return (
            art === undefined ||
            art === 'COUPE' ||
            art === 'LIMO' ||
            art === 'KOMBI'
        );
    }
}
