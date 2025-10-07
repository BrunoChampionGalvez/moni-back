import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailCronService } from './email-cron.service';
import { User } from '../entities/user.entity';
import { TransactionModule } from '../transactions/transaction.module';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), TransactionModule, GmailModule],
  providers: [EmailCronService],
})
export class CronModule {}
