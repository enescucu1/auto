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

// https://github.com/tc39/proposal-type-annotations

import process from 'node:process';
import {
    type INestApplication,
    type NestApplicationOptions,
    ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
    DocumentBuilder,
    type SwaggerCustomOptions,
    SwaggerModule,
} from '@nestjs/swagger';
import compression from 'compression';
import { corsOptions } from './config/cors.js';
import { logLevel } from './config/logger.js';
import { nodeConfig } from './config/node.js';
import { paths } from './config/paths.js';
import { AppModule } from './module.js';
import { helmetHandlers } from './security/http/helmet.js';

// Destructuring ab ES 2015
const { httpsOptions, port } = nodeConfig;

// "Arrow Function" ab ES 2015
const setupSwagger = (app: INestApplication) => {
    const config = new DocumentBuilder()
        .setTitle('Auto')
        .setDescription('Beispiel mit Nest und Auto-Domäne')
        .setVersion('2025.10.1')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    const options: SwaggerCustomOptions = {
        customSiteTitle: 'Auto 2025.10.1',
    };
    SwaggerModule.setup(paths.swagger, app, document, options);
};

// async/await ab ES 2017
const bootstrap = async () => {
    // Der Keycloak-Server verwendet ein selbstsigniertes Zertifikat
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'; // eslint-disable-line n/no-process-env

    const options: NestApplicationOptions =
        logLevel === 'debug'
            ? { httpsOptions }
            : { httpsOptions, logger: false };
    const app = await NestFactory.create(AppModule, options);

    app.use(helmetHandlers, compression());

    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    setupSwagger(app);

    app.enableCors(corsOptions);

    await app.listen(port);
};

// Top-level await ab ES 2020
await bootstrap();

// IIFE  = Immediately Invoked Function Expression
// IIAFE = Immediately Invoked Asynchronous Function Expression
// (async () => {
//     await bootstrap(); // ab ES 2017
// })();

// Promise mit then() ab ES 2015
// bootstrap()
//     .then(() => console.log(`Server gestartet auf Port ${port}`)) // eslint-disable-line security-node/detect-crlf
//     .catch((err) => console.error('Fehler bei bootstrap():', err));
