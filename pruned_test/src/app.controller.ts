import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Controller('api')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth(): string {
    // Lightweight liveness check
    return 'OK';
  }

  @Get('ready')
  async getReady(): Promise<string> {
    try {
      // Lightweight database readiness check
      await this.prisma.$queryRaw`SELECT 1`;
      return 'OK';
    } catch (error) {
      throw new ServiceUnavailableException('Database is unreachable');
    }
  }
}
