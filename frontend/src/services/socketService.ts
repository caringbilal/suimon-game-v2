import { Socket } from 'socket.io-client';

export class SocketService {
    private static instance: SocketService;
    private socket: Socket | null = null;

    private constructor() {}

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public setSocket(socket: Socket) {
        this.socket = socket;
    }

    public emitWalletEvent(eventType: string, data: any) {
        if (!this.socket) {
            console.error('Socket not initialized');
            return;
        }

        const eventData = {
            type: eventType,
            data: data,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            clientInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform
            }
        };

        // Enhanced console logging
        console.group(`Wallet Event: ${eventType}`);
        console.log('Event Data:', eventData);
        console.log('Client State:', {
            networkStatus: navigator.onLine ? 'online' : 'offline',
            timestamp: new Date().toLocaleString()
        });
        if (data.error) {
            console.error('Error Details:', data.error);
        }
        console.groupEnd();

        // Emit to backend
        this.socket.emit('walletEvent', eventData);
    }
}

export const socketService = SocketService.getInstance();