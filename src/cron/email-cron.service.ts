import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { TransactionService } from '../transactions/transaction.service';
import { GmailCentralizedService } from '../gmail/gmail-centralized.service';

@Injectable()
export class EmailCronService {
  private readonly logger = new Logger(EmailCronService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private transactionService: TransactionService,
    private gmailCentralizedService: GmailCentralizedService,
  ) {}

  // Se ejecuta todos los días a la 1:00 AM para procesar los emails del día anterior
  @Cron('0 1 * * *') // Minuto 0, Hora 1, Todos los días
  async handleDailyEmailFetch() {
    this.logger.log('Iniciando procesamiento diario de correos del día anterior...');

    try {
      // Get all users' emails from the centralized inbox (yesterday's emails)
      const userEmailsMap = await this.gmailCentralizedService.getAllUsersUnreadEmails();

      this.logger.log(`Procesando correos para ${userEmailsMap.size} usuarios`);

      let successCount = 0;
      let errorCount = 0;

      // Process emails for each user
      for (const [userId, emails] of userEmailsMap.entries()) {
        try {
          this.logger.log(`Procesando ${emails.length} correos para usuario ${userId}`);
          // Process emails directly (emails are already fetched)
          await this.transactionService.processEmailsForUser(userId, emails);
          successCount++;
        } catch (error) {
          this.logger.error(
            `Error procesando correos para usuario ${userId}:`,
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

