// Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// ...

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO-Klasse für das Modell eines Autos.
 */
export class ModellDTO {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'POSTMODELL', type: String })
    readonly modell!: string;
}
