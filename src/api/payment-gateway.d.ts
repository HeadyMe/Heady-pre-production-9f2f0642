declare class PaymentGateway_1 {
    stripe: any;
    plans: {
        pro: string;
        enterprise: string;
    };
    createCheckoutSession(userId: any, planType: any, successUrl: any, cancelUrl: any): Promise<{
        url: any;
    }>;
    verifyWebhookSignature(payload: any, signature: any): Promise<any>;
}
export class AuthMiddleware {
    static requireProPlan(req: any, res: any, next: any): void;
}
export declare let PaymentGateway: PaymentGateway;
export {};
//# sourceMappingURL=payment-gateway.d.ts.map