import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Transaction, TransactionCategory } from '../entities/transaction.entity';
import { User } from '../entities/user.entity';
import { GmailService } from '../gmail/gmail.service';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private gmailService: GmailService,
    private openaiService: OpenAIService,
  ) {}

  async processEmailsForUser(userId: string) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) return;

      // Fetch today's emails
      const emails: any[] = await this.gmailService.getTodaysEmails(userId);

      let processedCount = 0;

      for (const email of emails) {
        // Extract expense data from email using OpenAI
        const expenseData = await this.openaiService.extractExpenseFromEmail(
          email.htmlBody,
          email.subject,
        );

        if (!expenseData) continue;

        // Check if transaction already exists (prevent duplicates)
        const existingTransaction = await this.transactionRepository.findOne({
          where: {
            userId,
            amount: expenseData.amount,
            local: expenseData.local,
            date: expenseData.date
              ? new Date(expenseData.date)
              : new Date(email.date),
          },
        });

        if (existingTransaction) continue;

        // Categorize the local using second LLM
        const categorized = await this.openaiService.categorizeLocal(
          expenseData.local,
          user.country,
        );

        // Create transaction
        const transaction = this.transactionRepository.create({
          userId,
          amount: expenseData.amount,
          local: expenseData.local,
          actualLocal: categorized.actualLocal,
          category: categorized.category as TransactionCategory,
          bank: expenseData.bank,
          paymentMethod: expenseData.paymentMethod,
          date: expenseData.date ? new Date(expenseData.date) : new Date(email.date),
          emailHtml: email.htmlBody.substring(0, 5000), // Store first 5000 chars
          emailSubject: email.subject,
        });

        await this.transactionRepository.save(transaction);
        processedCount++;
      }

      return {
        message: `Procesados ${processedCount} gastos de ${emails.length} correos`,
        processedCount,
        totalEmails: emails.length,
      };
    } catch (error) {
      console.error(`Error processing emails for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserTransactions(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    categories?: TransactionCategory[],
  ) {
    const where: any = { userId };

    if (startDate && endDate) {
      where.date = Between(startDate, endDate);
    }

    if (categories && categories.length > 0) {
      where.category = In(categories);
    }

    return this.transactionRepository.find({
      where,
      order: { date: 'DESC' },
    });
  }

  async getDashboardStats(userId: string, days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.transactionRepository.find({
      where: {
        userId,
        date: Between(startDate, endDate),
      },
    });

    // Calculate total spent
    const totalSpent = transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );

    // Group by category
    const byCategory: { [key: string]: number } = {};
    transactions.forEach((t) => {
      if (!byCategory[t.category]) {
        byCategory[t.category] = 0;
      }
      byCategory[t.category] += Number(t.amount);
    });

    // Get user's monthly budget
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const monthlyBudget = user ? Number(user.monthlyBudget) : 0;

    // Calculate budget percentage (for current month)
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTransactions = await this.transactionRepository.find({
      where: {
        userId,
        date: Between(firstDayOfMonth, now),
      },
    });

    const monthlySpent = monthTransactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    const budgetPercentage =
      monthlyBudget > 0 ? (monthlySpent / monthlyBudget) * 100 : 0;

    return {
      totalSpent,
      byCategory,
      monthlyBudget,
      monthlySpent,
      budgetPercentage,
      transactionCount: transactions.length,
    };
  }

  async getSpendingTrend(userId: string, days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('DATE(transaction.date)', 'date')
      .addSelect('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.date >= :startDate', { startDate })
      .andWhere('transaction.date <= :endDate', { endDate })
      .groupBy('DATE(transaction.date)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return transactions.map((t) => ({
      date: t.date,
      total: parseFloat(t.total),
    }));
  }

  async getCategoryTrend(
    userId: string,
    category: TransactionCategory,
    days: number = 30,
  ) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('DATE(transaction.date)', 'date')
      .addSelect('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.category = :category', { category })
      .andWhere('transaction.date >= :startDate', { startDate })
      .andWhere('transaction.date <= :endDate', { endDate })
      .groupBy('DATE(transaction.date)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return transactions.map((t) => ({
      date: t.date,
      total: parseFloat(t.total),
    }));
  }
}
