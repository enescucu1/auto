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

import { UseFilters, UseInterceptors } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import BigNumber from 'bignumber.js'; // eslint-disable-line @typescript-eslint/naming-convention
import { Public } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    AutoService,
    type AutoMitModell,
    type AutoMitModellUndBilder,
} from '../service/auto-service.js';
import { createPageable } from '../service/pageable.js';
import { Slice } from '../service/slice.js';
import { type Suchparameter } from '../service/suchparameter.js';
import { HttpExceptionFilter } from './http-exception-filter.js';

export type IdInput = {
    readonly id: string;
};

export type SuchparameterInput = {
    readonly suchparameter: Omit<Suchparameter, 'lieferbar'> & {
        lieferbar: boolean | undefined;
    };
};

@Resolver('Auto')
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class AutoQueryResolver {
    readonly #service: AutoService;

    readonly #logger = getLogger(AutoQueryResolver.name);

    constructor(service: AutoService) {
        this.#service = service;
    }

    @Query('auto')
    @Public()
    async findById(
        @Args() { id }: IdInput,
    ): Promise<Readonly<AutoMitModellUndBilder>> {
        this.#logger.debug('findById: id=%s', id);

        const auto: Readonly<AutoMitModellUndBilder> =
            await this.#service.findById({ id: Number(id) });

        this.#logger.debug('findById: auto=%o', auto);
        return auto;
    }

    @Query('autos')
    @Public()
    async find(
        @Args() input: SuchparameterInput | undefined,
    ): Promise<AutoMitModell[]> {
        this.#logger.debug('find: input=%s', JSON.stringify(input));
        const pageable = createPageable({});
        const suchparameter = input?.suchparameter;
        if (suchparameter !== undefined) {
            const { lieferbar } = suchparameter;
            if (lieferbar !== undefined) {
                // Boolean bei GraphQL → String wie bei REST-Query-Param
                (suchparameter as any).lieferbar = lieferbar.toString();
            }
        }
        const autosSlice: Readonly<Slice<Readonly<AutoMitModell>>> =
            await this.#service.find(suchparameter as any, pageable); // NOSONAR
        this.#logger.debug('find: autosSlice=%o', autosSlice);
        return autosSlice.content;
    }

    @ResolveField('rabatt')
    rabatt(@Parent() auto: AutoMitModell, short: boolean | undefined) {
        this.#logger.debug(
            'rabatt: auto=%o, short=%s',
            auto,
            short?.toString() ?? 'undefined',
        );
        const rabattNumber = auto.rabatt ?? 0;
        const rabatt = BigNumber(rabattNumber);
        const shortStr = short === undefined || short ? '%' : 'Prozent';
        return `${rabatt.toString()} ${shortStr}`;
    }
}
