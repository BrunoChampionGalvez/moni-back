import { Controller, Get, Post, Query, UseGuards, Req, Param, SetMetadata } from '@nestjs/common';
import { GmailCentralizedService } from './gmail-centralized.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Decorator to make endpoints public (skip auth)
export const Public = () => SetMetadata('isPublic', true);

@Controller('gmail')
@UseGuards(JwtAuthGuard)
export class GmailController {
  constructor(
    private gmailCentralizedService: GmailCentralizedService,
  ) {}

  /**
   * Get the centralized forwarding email address (same for all users)
   */
  @Get('forwarding-email')
  async getForwardingEmail() {
    const forwardingEmail = this.gmailCentralizedService.getCentralizedForwardingEmail();
    return { 
      forwardingEmail,
      instructions: {
        es: [
          `Reenvía tus correos bancarios a: ${forwardingEmail}`,
          'Configura una regla en tu proveedor de email para reenviar automáticamente los correos de bancos a esta dirección.',
          'Ejemplo de remitentes: notificaciones@bbva.pe, bcp@bcp.com.pe, interbank@interbank.pe, yape@yape.com.pe, scotiabank@scotiabank.com.pe',
          'Importante: Usa la misma cuenta de email con la que te registraste en Moni',
        ],
        en: [
          `Forward your bank emails to: ${forwardingEmail}`,
          'Set up a rule in your email provider to automatically forward bank emails to this address.',
          'Example senders: notificaciones@bbva.pe, bcp@bcp.com.pe, interbank@interbank.pe, yape@yape.com.pe',
          'Important: Use the same email account you registered with in Moni',
        ]
      }
    };
  }

  /**
   * Test fetch emails from centralized inbox for current user
   */
  @Get('test-fetch-centralized')
  async testFetchCentralized(@Req() req: any) {
    return this.gmailCentralizedService.getTodaysUserEmails(req.user.userId);
  }

  /**
   * Admin endpoint: Get backend OAuth URL (for initial setup)
   * No authentication required - this is for initial backend setup
   */
  @Public()
  @Get('admin/backend-auth-url')
  getBackendAuthUrl() {
    const url = this.gmailCentralizedService.getBackendAuthUrl();
    return { 
      url,
      message: 'Use this URL to authorize the backend Gmail account. Save the refresh token to GMAIL_BACKEND_REFRESH_TOKEN in .env'
    };
  }

  /**
   * Admin endpoint: Handle backend OAuth callback
   * No authentication required - this is for initial backend setup
   */
  @Public()
  @Get('admin/backend-callback')
  async handleBackendCallback(@Query('code') code: string) {
    const refreshToken = await this.gmailCentralizedService.handleBackendCallback(code);
    return { 
      refreshToken,
      message: 'Add this token to your .env file as GMAIL_BACKEND_REFRESH_TOKEN'
    };
  }
}
