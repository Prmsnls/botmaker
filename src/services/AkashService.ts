import { getConfig } from '../config.js';
import type { Bot } from '../types/bot.js';

const API_BASE_URL = "https://console-api.akash.network";

interface CreateDeploymentResponse {
    data: {
        dseq: string;
        manifest: string;
    }
}

interface Bid {
    id: {
        owner: string;
        dseq: string;
        gseq: number;
        oseq: number;
        provider: string;
        bseq: number;
    };
    state: string;
    price: {
        denom: string;
        amount: string;
    };
}

interface BidsResponse {
    data: { bid: Bid }[];
}

interface CreateLeaseResponse {
    data: {
        deployment: {
            state: string;
        };
    }
}

export class AkashService {
    private apiKey: string;

    constructor() {
        const config = getConfig();
        // API Key is required for Akash service, but might not be present if feature is not used
        this.apiKey = process.env.CONSOLE_API_KEY || '';
    }

    private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (!this.apiKey) {
            throw new Error("Akash Console API Key is not configured (CONSOLE_API_KEY)");
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Akash API error ${response.status}: ${errorText}`);
        }

        return response.json() as Promise<T>;
    }

    generateSDL(bot: Bot, env: Record<string, string>): string {
        const config = getConfig();
        const envStrings = Object.entries(env).map(([k, v]) => `${k}="${v}"`);

        // Using a standard resilient template
        // Ensure 0.5 CPU, 512Mi RAM, 512Mi Storage as per basic requirements
        // Persistent storage is crucial for bot memory
        return `
version: "2.0"
services:
  bot:
    image: roshanvadassery/prmsnls-openclaw:ui-update-amd64
    command: 
      - "gateway"
    expose:
      - port: 3000
        as: 80
        to:
          - global: true
    env:
${envStrings.map(e => `      - ${e}`).join('\n')}
    params:
      storage:
        data:
          mount: /app/data
profiles:
  compute:
    bot:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 512Mi
          - name: data
            size: 1Gi
            attributes:
              persistent: true
              class: beta2
  placement:
    dcloud:
      pricing:
        bot:
          denom: uakt
          amount: 1000
deployment:
  bot:
    dcloud:
      profile: bot
      count: 1
`;
    }

    async deploy(sdl: string, deposit = 5): Promise<{ dseq: string; provider: string; manifest: string }> {
        // 1. Create Deployment
        console.log('--- GENERATED SDL ---\n', sdl, '\n-----------------------');
        const deployResponse = await this.apiRequest<CreateDeploymentResponse>("/v1/deployments", {
            method: "POST",
            body: JSON.stringify({
                data: {
                    sdl,
                    deposit,
                }
            })
        });

        const { dseq, manifest } = deployResponse.data;

        // 2. Wait for bids
        const bid = await this.waitForBid(dseq);

        // 3. Create Lease
        await this.apiRequest<CreateLeaseResponse>("/v1/leases", {
            method: "POST",
            body: JSON.stringify({
                manifest,
                leases: [{
                    dseq,
                    gseq: bid.id.gseq,
                    oseq: bid.id.oseq,
                    provider: bid.id.provider
                }]
            })
        });

        return { dseq, provider: bid.id.provider, manifest };
    }

    private async waitForBid(dseq: string, maxAttempts = 20): Promise<Bid> {
        for (let i = 0; i < maxAttempts; i++) {
            // Wait 3 seconds
            await new Promise(resolve => setTimeout(resolve, 3000));

            try {
                const response = await this.apiRequest<BidsResponse>(`/v1/bids?dseq=${dseq}`);
                if (response.data && response.data.length > 0) {
                    // Simple strategy: pick the first bid
                    // In future: pick cheapest or specific provider
                    return response.data[0].bid;
                }
            } catch (err) {
                // Ignore errors during polling (might be 404 if no bids yet?)
                console.warn("Error checking bids:", err);
            }
        }
        throw new Error("No bids received for Akash deployment");
    }

    async closeDeployment(dseq: string): Promise<boolean> {
        try {
            await this.apiRequest(`/v1/deployments/${dseq}`, {
                method: "DELETE"
            });
            return true;
        } catch (err) {
            console.error(`Failed to close deployment ${dseq}:`, err);
            return false;
        }
    }

    async getDeploymentDetails(dseq: string): Promise<any> {
        try {
            // Fetch deployment details which normally includes the leases and their status
            const response = await this.apiRequest<any>(`/v1/deployments/${dseq}`);
            return response;
        } catch (err) {
            console.error(`Failed to get deployment details for ${dseq}:`, err);
            return null;
        }
    }
}
