import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SeederService } from './seeder/seeder.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for mobile app
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Run seeder in development mode
  if (process.env.NODE_ENV === 'development') {
    const seederService = app.get(SeederService);
    try {
      const result = await seederService.seed();
      console.log('🌱 Seeder:', result.message);
    } catch (error) {
      console.error('❌ Seeder error:', error.message);
    }
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
  console.log(`📱 Accesible desde la red en http://192.168.0.5:${port}`);
}
bootstrap();
