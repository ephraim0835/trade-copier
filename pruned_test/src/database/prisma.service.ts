import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    const maxRetries = 5;
    const retryDelay = 3000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully.');
        return;
      } catch (err) {
        this.logger.warn(`DB connect attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelay));
        } else {
          this.logger.error('All DB connect attempts failed. Server starting without DB — requests will fail until DB is available.');
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
