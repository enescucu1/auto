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
 * DTO-Klassen für Autos.
 * @packageDocumentation
 */

/* eslint-disable max-classes-per-file, @typescript-eslint/no-magic-numbers */

import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsISO8601,
    IsOptional,
    Matches,
    Validate,
    ValidateNested,
    type ValidationArguments,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';
import BigNumber from 'bignumber.js';
import { BildDTO } from './bild-dto.js';
import { ModellDTO } from './modell-dto.js';
import { autoart } from '../../generated/prisma/enums.js';

// https://github.com/typestack/class-transformer?tab=readme-ov-file#basic-usage
const number2Decimal = ({ value }: { value: BigNumber.Value | undefined }) => {
    if (value === undefined) {
        return;
    }

    // Decimal aus decimal.js analog zu BigDecimal von Java
    // precision wie bei SQL beim Spaltentyp DECIMAL bzw. NUMERIC
    BigNumber.set({ DECIMAL_PLACES: 6 });
    return BigNumber(value);
};

const number2Percent = ({ value }: { value: BigNumber.Value | undefined }) => {
    if (value === undefined) {
        return;
    }

    // precision wie bei SQL beim Spaltentyp DECIMAL bzw. NUMERIC
    BigNumber.set({ DECIMAL_PLACES: 4 });
    return BigNumber(value);
};

// https://github.com/typestack/class-validator?tab=readme-ov-file#custom-validation-classes
@ValidatorConstraint({ name: 'decimalMin', async: false })
class DecimalMin implements ValidatorConstraintInterface {
    validate(value: BigNumber | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }
        const [minValue]: BigNumber[] = args.constraints; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        return value.isGreaterThan(minValue!);
    }

    defaultMessage(args: ValidationArguments) {
        return `Der Wert muss groesser oder gleich ${(args.constraints[0] as BigNumber).toNumber()} sein.`;
    }
}

// https://github.com/typestack/class-validator?tab=readme-ov-file#custom-validation-classes
@ValidatorConstraint({ name: 'decimalMax', async: false })
class DecimalMax implements ValidatorConstraintInterface {
    validate(value: BigNumber | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }
        const [maxValue]: BigNumber[] = args.constraints; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        return value.isLessThan(maxValue!);
    }

    defaultMessage(args: ValidationArguments) {
        return `Der Wert muss kleiner oder gleich ${(args.constraints[0] as BigNumber).toNumber()} sein.`;
    }
}

/**
 * DTO-Klasse für Autos ohne Referenzen.
 */
export class AutoDtoOhneRef {
    // Fahrgestellnummer, z.B. "1-0001-6" oder "1-POST1-6"
    //   1. Stelle: Ziffer
    //   Mitte:     beliebige Buchstaben/Ziffern
    //   letzte:    Ziffer
    // Fahrgestellnummer, z.B. "1-0001-6"
    @Matches(/^\d-[A-Z0-9]+-\d$/iu)
    @ApiProperty({ example: '1-0001-6', type: String })
    readonly fgnr!: string;

    @Matches(/^(COUPE|LIMO|KOMBI)$/u)
    @IsOptional()
    @ApiProperty({ example: 'COUPE', type: String })
    readonly art: autoart | undefined;

    @Transform(number2Decimal)
    @Validate(DecimalMin, [BigNumber(0)], {
        message: 'preis muss positiv sein.',
    })
    @ApiProperty({ example: 44990, type: Number })
    readonly preis!: BigNumber;

    @Transform(number2Percent)
    @Validate(DecimalMin, [BigNumber(0)], {
        message: 'rabatt muss positiv sein.',
    })
    @Validate(DecimalMax, [BigNumber(100)], {
        message: 'rabatt muss kleiner oder gleich 100 sein.',
    })
    @IsOptional()
    @ApiProperty({ example: 5, type: Number })
    readonly rabatt: Number | undefined;

    @IsBoolean()
    @IsOptional()
    @ApiProperty({ example: true, type: Boolean })
    readonly lieferbar: boolean | undefined;

    @IsISO8601({ strict: true })
    @IsOptional()
    @ApiProperty({ example: '2025-02-01' })
    readonly datum: Date | string | undefined;

    @IsOptional()
    @ArrayUnique()
    @ApiProperty({ example: ['SPORT', 'KOMFORT'] })
    readonly schlagwoerter: string[] | undefined;
}

/**
 * DTO-Klasse für Autos inkl. Referenzen.
 */
export class AutoDTO extends AutoDtoOhneRef {
    @ValidateNested()
    @Type(() => ModellDTO)
    @ApiProperty({ type: ModellDTO })
    readonly modell!: ModellDTO; // NOSONAR

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BildDTO)
    @ApiProperty({ type: [BildDTO] })
    readonly bilder: BildDTO[] | undefined;
}
/* eslint-enable max-classes-per-file, @typescript-eslint/no-magic-numbers */
