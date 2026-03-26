import { IUserDocument } from './user.types';

export interface ServerToClientEvents {
    'chat:message': (message: any) => void;
    'chat:typing': (data: { userId: string; name: string }) => void;
    'presence': (data: { userId: string; status: 'online' | 'offline' }) => void;
    'rtc:user-joined': (data: { roomId: string; participant: { userId: string; name: string } }) => void;
    'rtc:user-left': (data: { roomId: string; userId: string }) => void;
    'rtc:participants': (data: { roomId: string; participants: any[] }) => void;
    'rtc:offer': (data: { from: string; fromName: string; roomId: string; sdp: any }) => void;
    'rtc:answer': (data: { from: string; roomId: string; sdp: any }) => void;
    'rtc:ice-candidate': (data: { from: string; roomId: string; candidate: any }) => void;
    'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
    'chat:send': (data: { groupId: string; content: string }) => void;
    'chat:typing': (data: { groupId: string }) => void;
    'chat:join': (data: { groupId: string }) => void;
    'chat:leave': (data: { groupId: string }) => void;
    'rtc:join-room': (data: { roomId: string }) => void;
    'rtc:leave-room': (data: { roomId: string }) => void;
    'rtc:offer': (data: { to: string; sdp: any; roomId: string }) => void;
    'rtc:answer': (data: { to: string; sdp: any; roomId: string }) => void;
    'rtc:ice-candidate': (data: { to: string; candidate: any; roomId: string }) => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    user: IUserDocument;
}
