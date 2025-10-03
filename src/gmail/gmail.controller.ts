import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('gmail')
@UseGuards(JwtAuthGuard)
export class GmailController {
  constructor(private gmailService: GmailService) {}

  @Get('auth-url')
  getAuthUrl() {
    const url = this.gmailService.getAuthUrl();
    return { url };
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Req() req: any) {
    return this.gmailService.handleCallback(code, req.user.userId);
  }

  @Get('test-fetch')
  async testFetch(@Req() req: any) {
    return this.gmailService.getTodaysEmails(req.user.userId);
  }
}
