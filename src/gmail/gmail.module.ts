import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GmailCentralizedService } from './gmail-centralized.service';
import { GmailController } from './gmail.controller';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule],
  controllers: [GmailController],
  providers: [GmailCentralizedService],
  exports: [GmailCentralizedService],
})
export class GmailModule {}
