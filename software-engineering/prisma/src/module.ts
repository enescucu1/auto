// Copyright (C) 2021 - present Juergen Zimmermann,
// Hochschule Karlsruhe
//
// GPL-V3 Header…

import { type ApolloDriverConfig } from '@nestjs/apollo';
import {
    type MiddlewareConsumer,
    Module,
    type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { AdminModule } from './admin/module.js';
import { AutoModule } from './auto/module.js';
import { AutoController } from './auto/controller/auto-controller.js';
import { AutoWriteController } from './auto/controller/auto-write-controller.js';
import { DevModule } from './config/dev/module.js';
import { graphQlModuleOptions } from './config/graphql.js';
import { LoggerModule } from './logger/module.js';
import { RequestLoggerMiddleware } from './logger/request-logger.js';
import { KeycloakModule } from './security/keycloak/module.js';

@Module({
    imports: [
        AdminModule,
        AutoModule,
        ConfigModule,
        DevModule,
        GraphQLModule.forRoot<ApolloDriverConfig>(graphQlModuleOptions),
        LoggerModule,
        KeycloakModule,
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(RequestLoggerMiddleware)
            .forRoutes(
                AutoController,
                AutoWriteController,
                'auth',
                'graphql',
            );
    }
}
