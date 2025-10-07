import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Transaction, TransactionCategory } from '../entities/transaction.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeederService {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async seed() {
    this.logger.log('Starting database seeding...');

    // Check if seeding has already been done
    const existingUser = await this.userRepository.findOne({
      where: { email: 'bruno@mail.com' },
    });

    if (existingUser) {
      const transactionCount = await this.transactionRepository.count({
        where: { userId: existingUser.id },
      });

      if (transactionCount > 0) {
        this.logger.log('Database already seeded. Skipping...');
        return {
          message: 'Database already seeded',
          user: existingUser.email,
          transactionCount,
        };
      }
    }

    // Create or get user
    let user: User;
    if (existingUser) {
      user = existingUser;
      this.logger.log(`Using existing user: ${user.email}`);
    } else {
      const hashedPassword = await bcrypt.hash('Test*1234!', 10);
      user = this.userRepository.create({
        email: 'bruno@mail.com',
        password: hashedPassword,
        country: 'Peru',
        currency: 'PEN',
        monthlyBudget: 3500,
        budgetNotificationThreshold: 80,
        isActive: true,
      });
      user = await this.userRepository.save(user);
      this.logger.log(`Created user: ${user.email}`);
    }

    // Create sample transactions for the last 365 days (full year)
    const transactions = this.generateSampleTransactions(user.id);
    await this.transactionRepository.save(transactions);

    this.logger.log(`Seeded ${transactions.length} transactions for user ${user.email}`);

    return {
      message: 'Database seeded successfully',
      user: user.email,
      transactionCount: transactions.length,
    };
  }

  async reseed() {
    this.logger.log('Starting database reseeding (clearing existing transactions)...');

    // Find user
    const existingUser = await this.userRepository.findOne({
      where: { email: 'bruno@mail.com' },
    });

    if (!existingUser) {
      this.logger.error('User not found for reseeding');
      return {
        message: 'User not found',
      };
    }

    // Delete all existing transactions for this user
    await this.transactionRepository.delete({ userId: existingUser.id });
    this.logger.log('Deleted all existing transactions');

    // Generate new transactions
    const transactions = this.generateSampleTransactions(existingUser.id);
    await this.transactionRepository.save(transactions);

    this.logger.log(`Reseeded ${transactions.length} transactions for user ${existingUser.email}`);

    return {
      message: 'Database reseeded successfully',
      user: existingUser.email,
      transactionCount: transactions.length,
    };
  }

  private generateSampleTransactions(userId: string): Partial<Transaction>[] {
    const transactions: Partial<Transaction>[] = [];
    const today = new Date();

    // Sample data for different categories
    const sampleData = [
      // Salud
      { local: 'FARMACIA INKAFARMA', actualLocal: 'InkaFarma', category: TransactionCategory.SALUD, bank: 'BCP', amount: 45.50, paymentMethod: 'Tarjeta de Débito' },
      { local: 'CLINICA SAN FELIPE', actualLocal: 'Clínica San Felipe', category: TransactionCategory.SALUD, bank: 'Interbank', amount: 150.00, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'BOTICA BTL', actualLocal: 'Boticas BTL', category: TransactionCategory.SALUD, bank: 'BCP', amount: 32.80, paymentMethod: 'Tarjeta de Débito' },
      
      // Comida & Restaurantes
      { local: 'WONG SUPERMERCADO', actualLocal: 'Wong', category: TransactionCategory.COMIDA, bank: 'BCP', amount: 156.40, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'PLAZA VEA', actualLocal: 'Plaza Vea', category: TransactionCategory.COMIDA, bank: 'Interbank', amount: 98.75, paymentMethod: 'Tarjeta de Débito' },
      { local: 'REST LA ROSA NAUTICA', actualLocal: 'La Rosa Náutica', category: TransactionCategory.COMIDA, bank: 'BCP', amount: 185.00, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'TANTA RESTAURANTE', actualLocal: 'Tanta', category: TransactionCategory.COMIDA, bank: 'Interbank', amount: 76.50, paymentMethod: 'Tarjeta de Débito' },
      { local: 'STARBUCKS COFFEE', actualLocal: 'Starbucks', category: TransactionCategory.COMIDA, bank: 'BCP', amount: 18.90, paymentMethod: 'Tarjeta de Débito' },
      { local: 'BEMBOS', actualLocal: 'Bembos', category: TransactionCategory.COMIDA, bank: 'BCP', amount: 35.50, paymentMethod: 'Tarjeta de Débito' },
      
      // Transporte
      { local: 'UBER TRIP', actualLocal: 'Uber', category: TransactionCategory.TRANSPORTE, bank: 'BCP', amount: 12.50, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'UBER EATS', actualLocal: 'Uber', category: TransactionCategory.TRANSPORTE, bank: 'Interbank', amount: 25.80, paymentMethod: 'Tarjeta de Débito' },
      { local: 'PRIMAX GASOLINA', actualLocal: 'Primax', category: TransactionCategory.TRANSPORTE, bank: 'BCP', amount: 120.00, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'REPSOL GAS', actualLocal: 'Repsol', category: TransactionCategory.TRANSPORTE, bank: 'BCP', amount: 95.30, paymentMethod: 'Tarjeta de Crédito' },
      
      // Entretenimiento
      { local: 'NETFLIX COM', actualLocal: 'Netflix', category: TransactionCategory.ENTRETENIMIENTO, bank: 'Interbank', amount: 44.90, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'SPOTIFY PREMIUM', actualLocal: 'Spotify', category: TransactionCategory.ENTRETENIMIENTO, bank: 'BCP', amount: 19.90, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'CINEPLANET', actualLocal: 'Cineplanet', category: TransactionCategory.ENTRETENIMIENTO, bank: 'Interbank', amount: 68.00, paymentMethod: 'Tarjeta de Débito' },
      { local: 'STEAM PURCHASE', actualLocal: 'Steam', category: TransactionCategory.ENTRETENIMIENTO, bank: 'BCP', amount: 89.90, paymentMethod: 'Tarjeta de Crédito' },
      
      // Compras
      { local: 'SAGA FALABELLA', actualLocal: 'Saga Falabella', category: TransactionCategory.COMPRAS, bank: 'BCP', amount: 245.60, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'RIPLEY TIENDA', actualLocal: 'Ripley', category: TransactionCategory.COMPRAS, bank: 'Interbank', amount: 189.90, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'AMAZON PRIME', actualLocal: 'Amazon', category: TransactionCategory.COMPRAS, bank: 'BCP', amount: 125.50, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'MERCADO LIBRE', actualLocal: 'Mercado Libre', category: TransactionCategory.COMPRAS, bank: 'Interbank', amount: 87.40, paymentMethod: 'Tarjeta de Débito' },
      
      // Servicios
      { local: 'CLARO TELECOMUNICACIONES', actualLocal: 'Claro', category: TransactionCategory.SERVICIOS, bank: 'BCP', amount: 79.90, paymentMethod: 'Cargo Automático' },
      { local: 'LUZ DEL SUR', actualLocal: 'Luz del Sur', category: TransactionCategory.SERVICIOS, bank: 'Interbank', amount: 156.30, paymentMethod: 'Cargo Automático' },
      { local: 'SEDAPAL', actualLocal: 'Sedapal', category: TransactionCategory.SERVICIOS, bank: 'BCP', amount: 45.20, paymentMethod: 'Cargo Automático' },
      
      // Educación
      { local: 'UDEMY COURSE', actualLocal: 'Udemy', category: TransactionCategory.EDUCACION, bank: 'BCP', amount: 54.90, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'LIBRERIA CRISOL', actualLocal: 'Crisol', category: TransactionCategory.EDUCACION, bank: 'Interbank', amount: 98.50, paymentMethod: 'Tarjeta de Débito' },
      
      // Hogar
      { local: 'SODIMAC HOMECENTER', actualLocal: 'Sodimac', category: TransactionCategory.HOGAR, bank: 'BCP', amount: 234.80, paymentMethod: 'Tarjeta de Crédito' },
      { local: 'MAESTRO HOME CENTER', actualLocal: 'Maestro', category: TransactionCategory.HOGAR, bank: 'Interbank', amount: 167.40, paymentMethod: 'Tarjeta de Crédito' },
    ];

    // Generate transactions over the last 365 days (full year)
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Random 1-3 transactions per day
      const transactionsPerDay = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < transactionsPerDay; j++) {
        const sample = sampleData[Math.floor(Math.random() * sampleData.length)];
        
        transactions.push({
          userId,
          amount: sample.amount + (Math.random() * 20 - 10), // Add some variance
          local: sample.local,
          actualLocal: sample.actualLocal,
          category: sample.category,
          bank: sample.bank,
          paymentMethod: sample.paymentMethod,
          date: date,
          emailSubject: `Compra realizada en ${sample.actualLocal}`,
        });
      }
    }

    return transactions;
  }
}
