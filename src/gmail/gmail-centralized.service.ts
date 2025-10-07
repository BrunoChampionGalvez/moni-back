import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * GmailCentralizedService
 * 
 * This service manages email reading from a single centralized Gmail account
 * that all users forward their bank emails to. Instead of OAuth per user,
 * the backend uses its own service account or OAuth credentials to access
 * one inbox that receives forwarded emails from all users.
 * 
 * Architecture:
 * 1. Backend controls one Gmail account (e.g., backend@moni-emails.com)
 * 2. All users forward their bank emails to the same address: backend@moni-emails.com
 * 3. Backend reads all emails and matches them to users by checking the sender email (user's personal email)
 * 4. User identification: Forwarded emails have "From: user@gmail.com" which matches user.email in database
 */
@Injectable()
export class GmailCentralizedService {
  private readonly logger = new Logger(GmailCentralizedService.name);
  private oauth2Client;
  private gmail;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    // Initialize OAuth2 client for the centralized backend account
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );

    // Set the refresh token for the centralized account
    // This token should be obtained once manually and stored in .env
    const refreshToken = this.configService.get('GMAIL_BACKEND_REFRESH_TOKEN');
    if (refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    } else {
      this.logger.warn('GMAIL_BACKEND_REFRESH_TOKEN not configured. Gmail functionality will not work.');
    }
  }

  /**
   * Get the OAuth URL for initial setup (admin use only)
   * Run this once to get the refresh token for the backend account
   */
  getBackendAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
      prompt: 'consent',
    });
  }

  /**
   * Handle OAuth callback for backend account setup (admin use only)
   */
  async handleBackendCallback(code: string): Promise<string> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.refresh_token) {
        throw new BadRequestException(
          'No se recibió el token de actualización. Intenta revocar el acceso y volver a autorizar.',
        );
      }

      // Return the refresh token to be added to .env file
      return tokens.refresh_token;
    } catch (error) {
      throw new BadRequestException('Error al conectar con Gmail: ' + error.message);
    }
  }

  /**
   * Fetch emails for a specific user by filtering on their email address as sender
   */
  async getUserEmails(
    userId: string,
    query: string = '',
    maxResults: number = 50
  ): Promise<any[]> {
    if (!this.gmail) {
      throw new BadRequestException('Gmail no está configurado en el backend');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    try {
      // Build query to filter by sender (From: field)
      // When user forwards emails, their email appears in the From field
      const senderFilter = `from:${user.email}`;
      const fullQuery = query ? `${senderFilter} ${query}` : senderFilter;

      this.logger.log(`Fetching emails for user ${userId} with query: ${fullQuery}`);

      // Get list of messages
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: fullQuery,
        maxResults,
      });

      const messages = response.data.messages || [];
      const emails: any[] = [];

      // Fetch each message details
      for (const message of messages) {
        if (!message.id) continue;
        
        const emailDetails = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        const email = this.parseEmail(emailDetails.data);
        emails.push(email);
      }

      this.logger.log(`Found ${emails.length} emails for user ${userId}`);
      return emails;
    } catch (error) {
      this.logger.error(`Error fetching emails for user ${userId}: ${error.message}`);
      throw new BadRequestException('Error al obtener correos: ' + error.message);
    }
  }

  /**
   * Get yesterday's emails for a specific user (for daily cron job)
   * This fetches emails from the last 24 hours (yesterday's transactions)
   */
  async getTodaysUserEmails(userId: string): Promise<any[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); // Ayer
    yesterday.setHours(0, 0, 0, 0); // Medianoche de ayer
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Medianoche de hoy
    
    const timestampStart = Math.floor(yesterday.getTime() / 1000);
    const timestampEnd = Math.floor(today.getTime() / 1000);
    
    // Query for FORWARDED emails from this user (emails sent by the user who is forwarding bank emails)
    // Note: We don't filter by bank email addresses because the email is forwarded,
    // so the "From" field will be the user's email, not the bank's email
    const query = `after:${timestampStart} before:${timestampEnd}`;

    this.logger.log(`Fetching forwarded emails from yesterday for user ${userId}: ${yesterday.toDateString()} to ${today.toDateString()}`);
    
    return this.getUserEmails(userId, query);
  }

  /**
   * Get all unread emails for all active users
   * Used by cron job to process new transactions
   */
  async getAllUsersUnreadEmails(): Promise<Map<string, any[]>> {
    if (!this.gmail) {
      throw new BadRequestException('Gmail no está configurado en el backend');
    }

    const users = await this.userRepository.find({
      where: { isActive: true },
    });

    const userEmailsMap = new Map<string, any[]>();

    for (const user of users) {
      try {
        const emails = await this.getTodaysUserEmails(user.id);
        if (emails.length > 0) {
          userEmailsMap.set(user.id, emails);
        }
      } catch (error) {
        this.logger.error(
          `Error fetching emails for user ${user.id}: ${error.message}`
        );
      }
    }

    return userEmailsMap;
  }

  /**
   * Parse email data from Gmail API response
   */
  private parseEmail(emailData: any) {
    const headers = emailData.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const to = headers.find((h: any) => h.name === 'To')?.value || '';
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
      to,
      date,
      htmlBody,
      attachments,
    };
  }

  /**
   * Get attachment data
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    if (!this.gmail) {
      throw new BadRequestException('Gmail no está configurado en el backend');
    }

    const attachment = await this.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    if (attachment.data.data) {
      return Buffer.from(attachment.data.data, 'base64');
    }
    
    return Buffer.from('');
  }

  /**
   * Get the centralized forwarding email that all users should forward to
   * This is the same for all users: backend@moni-emails.com
   */
  getCentralizedForwardingEmail(): string {
    return 'championgalvezbruno@gmail.com';
  }
}
