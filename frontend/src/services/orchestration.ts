import { config } from '../config';
import { MockProvider } from './mock-provider';
import { WebSocketProvider } from './ws-provider';
import { OrchestrationProvider, OrchestrationEvent } from './types';

/**
 * Singleton service that automatically chooses between Mock and Live backend
 * based entirely on `src/config.ts`.
 */
class OrchestrationService {
    private provider: OrchestrationProvider;

    constructor() {
        this.provider = config.mode === 'live' 
            ? new WebSocketProvider() 
            : new MockProvider();
            
        console.log(`[OrchestrationService] Initialized in ${config.mode.toUpperCase()} mode.`);
    }

    public connect() {
        this.provider.connect();
    }

    public disconnect() {
        this.provider.disconnect();
    }

    public sendMessage(text: string, imageFile?: File) {
        this.provider.sendMessage(text, imageFile);
    }

    public startNewRun() {
        this.provider.startNewRun();
    }

    public exportAudit(format: 'pdf' | 'sheets') {
        this.provider.exportAudit(format);
    }

    public onEvent(callback: (event: OrchestrationEvent) => void) {
        return this.provider.onEvent(callback);
    }

    public setModel(modelId: string) {
        this.provider.setModel(modelId);
    }
}

export const orchestrationService = new OrchestrationService();
