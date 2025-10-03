import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { TransactionService } from '../transactions/transaction.service';

@Injectable()
export class EmailCronService {
  private readonly logger = new Logger(EmailCronService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private transactionService: TransactionService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyEmailFetch() {
    this.logger.log('Iniciando procesamiento diario de correos...');

    try {
      // Get all active users with Gmail connected
      const users = await this.userRepository.find({
        where: { isActive: true },
      });

      const usersWithGmail = users.filter((u) => u.gmailRefreshToken);

      this.logger.log(`Procesando correos para ${usersWithGmail.length} usuarios`);

      let successCount = 0;
      let errorCount = 0;

      for (const user of usersWithGmail) {
        try {
          await this.transactionService.processEmailsForUser(user.id);
          successCount++;
        } catch (error) {
          this.logger.error(
            `Error procesando correos para usuario ${user.email}:`,
            error,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `Procesamiento completado. Exitosos: ${successCount}, Errores: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error('Error en cron job de procesamiento de correos:', error);
    }
  }
}
