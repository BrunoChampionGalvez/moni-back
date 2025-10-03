import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      country: user.country,
      currency: user.currency,
      monthlyBudget: user.monthlyBudget,
      budgetNotificationThreshold: user.budgetNotificationThreshold,
      hasGmailConnected: !!user.gmailRefreshToken,
    };
  }

  async updateProfile(userId: string, updateData: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    Object.assign(user, updateData);
    await this.userRepository.save(user);

    return {
      message: 'Perfil actualizado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        country: user.country,
        currency: user.currency,
        monthlyBudget: user.monthlyBudget,
        budgetNotificationThreshold: user.budgetNotificationThreshold,
      },
    };
  }
}
