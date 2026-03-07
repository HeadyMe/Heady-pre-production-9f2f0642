export = AgentProtocolAdapter;
declare class AgentProtocolAdapter {
    constructor(opts?: {});
    protocolVersion: string;
    agentId: any;
    capabilities: any;
    getAgentCard(): {
        name: any;
        description: string;
        url: string;
        version: string;
        capabilities: {
            streaming: boolean;
            pushNotifications: boolean;
            stateTransitionHistory: boolean;
        };
        defaultInputModes: string[];
        defaultOutputModes: string[];
        skills: any;
    };
    fromA2A(task: any): {
        id: any;
        messages: any;
        metadata: any;
    };
    toA2A(result: any): {
        id: any;
        status: {
            state: string;
        };
        artifacts: {
            parts: {
                type: string;
                text: string;
            }[];
        }[];
        history: any;
    };
    toAGUIEvents(result: any): ({
        type: string;
        content: any;
        name?: undefined;
        args?: undefined;
        result?: undefined;
    } | {
        type: string;
        name: any;
        args: any;
        content?: undefined;
        result?: undefined;
    } | {
        type: string;
        name: any;
        result: any;
        content?: undefined;
        args?: undefined;
    } | {
        type: string;
        content?: undefined;
        name?: undefined;
        args?: undefined;
        result?: undefined;
    })[];
    routes(router: any): any;
}
//# sourceMappingURL=agent-protocol.d.ts.map