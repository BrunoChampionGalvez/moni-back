import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';

export enum TransactionCategory {
  SALUD = 'Salud',
  EDUCACION = 'Educación',
  ENTRETENIMIENTO = 'Entretenimiento',
  VIAJES = 'Viajes',
  COMIDA = 'Comida & Restaurantes',
  TRANSPORTE = 'Transporte',
  SERVICIOS = 'Servicios',
  COMPRAS = 'Compras',
  HOGAR = 'Hogar',
  OTROS = 'Otros',
}

@Entity('transactions')
@Index(['userId', 'date'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column()
  local: string; // Original local name from email

  @Column({ nullable: true })
  actualLocal: string; // Processed local name by LLM

  @Column({
    type: 'enum',
    enum: TransactionCategory,
    default: TransactionCategory.OTROS,
  })
  category: TransactionCategory;

  @Column()
  bank: string;

  @Column({ nullable: true })
  paymentMethod: string;

  @Column({ type: 'date' })
  date: Date;

  @Column()
  userId: string;

  @Column({ type: 'text', nullable: true })
  emailHtml: string; // Store original email HTML for reference

  @Column({ nullable: true })
  emailSubject: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.transactions)
  user: User;
}
