import { IsEmail, IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  monthlyBudget?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  budgetNotificationThreshold?: number;
}
