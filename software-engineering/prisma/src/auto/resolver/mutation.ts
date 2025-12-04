// Copyright (C) ...

import { UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { IsInt, IsNumberString, Min } from 'class-validator';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import { AutoDTO } from '../controller/auto-dto.js';
import {
    AutoWriteService,
    AutoCreate,
    AutoUpdate,
} from '../service/auto-write-service.js';
import { type IdInput } from './query.js';
import { HttpExceptionFilter } from './http-exception-filter.js';

export type CreatePayload = { id: number };
export type UpdatePayload = { version: number };
export type DeletePayload = { success: boolean };

export class AutoUpdateDTO extends AutoDTO {
    @IsNumberString()
    readonly id!: string;

    @IsInt()
    @Min(0)
    readonly version!: number;
}

@Resolver('Auto')
@UseGuards(AuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class AutoMutationResolver {
    readonly #service: AutoWriteService;
    readonly #logger = getLogger(AutoMutationResolver.name);

    constructor(service: AutoWriteService) {
        this.#service = service;
    }

    @Mutation('create')
    @Roles('admin', 'user')
    async create(@Args('input') autoDTO: AutoDTO): Promise<CreatePayload> {
        this.#logger.debug('create: autoDTO=%o', autoDTO);

        const auto = this.#autoDtoToAutoCreate(autoDTO);
        const id = await this.#service.create(auto);

        return { id };
    }

    @Mutation('update')
    @Roles('admin', 'user')
    async update(
        @Args('input') autoDTO: AutoUpdateDTO,
    ): Promise<UpdatePayload> {
        this.#logger.debug('update: autoDTO=%o', autoDTO);

        const auto = this.#autoUpdateDtoToAutoUpdate(autoDTO);
        const versionStr = `"${autoDTO.version.toString()}"`;

        const version = await this.#service.update({
            id: Number(autoDTO.id),
            auto,
            version: versionStr,
        });

        return { version };
    }

    @Mutation('delete')
    @Roles('admin')
    async delete(@Args() id: IdInput): Promise<DeletePayload> {
        await this.#service.delete(Number(id.id));
        return { success: true };
    }

    // --------------------------------------------------
    // DTO → Prisma Input
    // --------------------------------------------------

    #autoDtoToAutoCreate(autoDTO: AutoDTO): AutoCreate {
        const bilder =
            autoDTO.bilder?.map((b) => ({
                beschriftung: b.beschriftung,
                content_type: b.contentType,
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

        const preis = autoDTO.preis.toNumber();

        const datumValue =
            autoDTO.datum === undefined || autoDTO.datum === null
                ? null
                : typeof autoDTO.datum === 'string'
                  ? new Date(autoDTO.datum)
                  : autoDTO.datum;

        return {
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
    }

    #autoUpdateDtoToAutoUpdate(autoDTO: AutoUpdateDTO): AutoUpdate {
        const preis = autoDTO.preis.toNumber();

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
