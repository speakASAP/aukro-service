/**
 * Gateway Module
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '@aukro/shared';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import * as http from 'http';
import * as https from 'https';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Create HTTP and HTTPS agents with aggressive keep-alive settings
        // These settings ensure connections are maintained and reused immediately
        // maxFreeSockets: Keep more idle connections ready for instant reuse
        // keepAliveMsecs: How long to keep connections alive (1 second)
        // timeout: Socket timeout (60 seconds)
        const httpAgent = new http.Agent({
          keepAlive: true,
          keepAliveMsecs: 1000,
          maxSockets: 50,
          maxFreeSockets: 20, // Increased from 10 to 20 - keep more connections ready
          timeout: 60000,
          // Scheduling: 'fifo' ensures oldest connections are reused first
          scheduling: 'fifo',
        });
        
        const httpsAgent = new https.Agent({
          keepAlive: true,
          keepAliveMsecs: 1000,
          maxSockets: 50,
          maxFreeSockets: 20, // Increased from 10 to 20 - keep more connections ready
          timeout: 60000,
          scheduling: 'fifo',
        });

        const timeout = configService.get<string>('HTTP_TIMEOUT') || '30000';
        
        return {
          timeout: parseInt(timeout),
          maxRedirects: 5,
          httpAgent,
          httpsAgent,
          // Set default headers for keep-alive
          headers: {
            'Connection': 'keep-alive',
          },
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule,
    AuthModule,
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}

