import type { IUserDocument } from './user.types';

export interface ChatMessagePayload {
  _id?: string;
  senderId: string;
  groupId: string;
  content: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface TypingPayload {
  userId: string;
  name: string;
}

export interface PresencePayload {
  userId: string;
  status: 'online' | 'offline';
}

export interface RTCParticipant {
  userId: string;
  name: string;
  socketId?: string;
}

export interface OnlineUser {
  userId: string;
  name: string;
  socketId: string;
  connectedAt: string;
}

export type RTCSessionDescriptionPayload = Record<string, unknown>;
export type RTCIceCandidatePayload = Record<string, unknown>;

export interface ServerToClientEvents {
  'chat:message': (message: ChatMessagePayload) => void;
  'chat:typing': (data: TypingPayload) => void;
  presence: (data: PresencePayload) => void;
  'rtc:user-joined': (data: { roomId: string; participant: RTCParticipant }) => void;
  'rtc:user-left': (data: { roomId: string; userId: string }) => void;
  'rtc:participants': (data: { roomId: string; participants: RTCParticipant[] }) => void;
  'rtc:offer': (data: {
    from: string;
    fromName: string;
    roomId: string;
    sdp: RTCSessionDescriptionPayload;
  }) => void;
  'rtc:answer': (data: { from: string; roomId: string; sdp: RTCSessionDescriptionPayload }) => void;
  'rtc:ice-candidate': (data: {
    from: string;
    roomId: string;
    candidate: RTCIceCandidatePayload;
  }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'chat:send': (data: { groupId: string; content: string }) => void;
  'chat:typing': (data: { groupId: string }) => void;
  'chat:join': (data: { groupId: string }) => void;
  'chat:leave': (data: { groupId: string }) => void;
  'rtc:join-room': (data: { roomId: string }) => void;
  'rtc:leave-room': (data: { roomId: string }) => void;
  'rtc:offer': (data: { to: string; sdp: RTCSessionDescriptionPayload; roomId: string }) => void;
  'rtc:answer': (data: { to: string; sdp: RTCSessionDescriptionPayload; roomId: string }) => void;
  'rtc:ice-candidate': (data: {
    to: string;
    candidate: RTCIceCandidatePayload;
    roomId: string;
  }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: IUserDocument;
}
