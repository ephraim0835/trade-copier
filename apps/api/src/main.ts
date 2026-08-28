import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(helmet());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = configService.get<string>('LOG_LEVEL') || 'debug';

  if (logLevel === 'warn') {
    app.useLogger(['error', 'warn']);
  } else if (logLevel === 'error') {
    app.useLogger(['error']);
  } else {
    app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  }
  
  const frontendUrlsStr = configService.get<string>('FRONTEND_URLS') || configService.get<string>('FRONTEND_URL');
  if (isProduction && !frontendUrlsStr) {
    throw new Error('FRONTEND_URLS must be defined in production');
  }

  const allowedOrigins = frontendUrlsStr
    ? frontendUrlsStr.split(',').map(u => u.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://127.0.0.1:${port}`);
}
bootstrap();
