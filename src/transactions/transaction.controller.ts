import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Post,
  ParseIntPipe,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionCategory } from '../entities/transaction.entity';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Get()
  async getTransactions(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('categories') categories?: string,
  ) {
    const categoryArray = categories
      ? (categories.split(',') as TransactionCategory[])
      : undefined;

    return this.transactionService.getUserTransactions(
      req.user.userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      categoryArray,
    );
  }

  @Get('dashboard')
  async getDashboardStats(
    @Req() req: any,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    return this.transactionService.getDashboardStats(
      req.user.userId,
      days || 30,
    );
  }

  @Get('trend')
  async getSpendingTrend(
    @Req() req: any,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    return this.transactionService.getSpendingTrend(
      req.user.userId,
      days || 30,
    );
  }

  @Get('category-trend')
  async getCategoryTrend(
    @Req() req: any,
    @Query('category') category: string,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    return this.transactionService.getCategoryTrend(
      req.user.userId,
      category as TransactionCategory,
      days || 30,
    );
  }

  @Post('process-emails')
  async processEmails(@Req() req: any) {
    return this.transactionService.processEmailsForUser(req.user.userId);
  }
}
