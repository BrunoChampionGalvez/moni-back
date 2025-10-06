import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { SeederService } from './seeder/seeder.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly seederService: SeederService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('seed')
  async seed() {
    return await this.seederService.seed();
  }

  @Post('reseed')
  async reseed() {
    return await this.seederService.reseed();
  }
}
