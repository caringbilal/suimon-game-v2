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

        console.log(`Emitting wallet event: ${eventType}`, data);
        this.socket.emit('walletEvent', {
            type: eventType,
            data: data,
            timestamp: new Date().toISOString()
        });
    }
}

export const socketService = SocketService.getInstance();