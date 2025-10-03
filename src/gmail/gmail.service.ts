import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class GmailService {
  private oauth2Client;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
    );
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });
  }

  async handleCallback(code: string, userId: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.refresh_token) {
        throw new BadRequestException(
          'No se recibió el token de actualización. Intenta revocar el acceso y volver a autorizar.',
        );
      }

      // Store refresh token in database
      await this.userRepository.update(userId, {
        gmailRefreshToken: tokens.refresh_token,
      });

      return { message: 'Gmail conectado exitosamente' };
    } catch (error) {
      throw new BadRequestException('Error al conectar con Gmail: ' + error.message);
    }
  }

  async getEmails(userId: string, query: string = 'category:promotions OR category:updates', maxResults: number = 50) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.gmailRefreshToken) {
      throw new BadRequestException('Gmail no está conectado para este usuario');
    }

    this.oauth2Client.setCredentials({
      refresh_token: user.gmailRefreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    try {
      // Get list of messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = response.data.messages || [];
      const emails: any[] = [];

      // Fetch each message details
      for (const message of messages) {
        if (!message.id) continue;
        
        const emailDetails = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        const email = this.parseEmail(emailDetails.data);
        emails.push(email);
      }

      return emails;
    } catch (error) {
      throw new BadRequestException('Error al obtener correos: ' + error.message);
    }
  }

  async getTodaysEmails(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const timestamp = Math.floor(today.getTime() / 1000);
    const query = `after:${timestamp} (from:notificaciones@bbva.pe OR from:bcp@bcp.com.pe OR from:interbank@interbank.pe OR from:scotiabank@scotiabank.com.pe OR subject:compra OR subject:pago OR subject:transacción)`;

    return this.getEmails(userId, query);
  }

  private parseEmail(emailData: any) {
    const headers = emailData.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const date = headers.find((h: any) => h.name === 'Date')?.value || '';

    let htmlBody = '';
    const attachments: any[] = [];

    // Extract HTML body
    if (emailData.payload?.parts) {
      for (const part of emailData.payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        
        // Extract attachments
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
          });
        }
      }
    } else if (emailData.payload?.body?.data) {
      htmlBody = Buffer.from(emailData.payload.body.data, 'base64').toString('utf-8');
    }

    return {
      id: emailData.id,
      subject,
      from,
      date,
      htmlBody,
      attachments,
    };
  }

  async getAttachment(userId: string, messageId: string, attachmentId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.gmailRefreshToken) {
      throw new BadRequestException('Gmail no está conectado para este usuario');
    }

    this.oauth2Client.setCredentials({
      refresh_token: user.gmailRefreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    if (attachment.data.data) {
      return Buffer.from(attachment.data.data, 'base64');
    }
    
    return Buffer.from('');
  }
}
