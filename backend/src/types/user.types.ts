import type { Document } from 'mongoose';

export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'premium' | 'vip' | 'viip';
export type UserStatus = 'active' | 'suspended';
export type UserGender = 'male' | 'female' | 'other';

export interface IUser {
  email?: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  name: string;
  nameVerified: boolean;
  gender: UserGender;
  avatarUrl?: string;
  role: UserRole;
  plan: UserPlan;
  planExpiresAt?: Date;
  status: UserStatus;
  passwordHash?: string;
  githubId?: string;
  githubAccessToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}
