import { ScriptingAPI as API } from "@busch-jaeger/free-at-home";
export interface UMRConfigurationProperties extends API.Configuration {
    default: {
        items: {
            UMR: string;
            TEMP_ECO: number;
            TEMP_OFF: number;
            RefreshInt: number;
            LogHTTPurl: string;
            Config: string;
        };
    };
}
//# sourceMappingURL=UMR-FreeAtHomeConnector.d.ts.map