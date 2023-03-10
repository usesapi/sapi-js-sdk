import fetchIntercept from 'fetch-intercept';
const SAPI_API_BASE_URL = "https://api.usesapi.com/";
const SAPI_PROXY_HOST = "proxy.usesapi.com";
class Sapi {
    constructor() {
        this.sapiId = null;
        this.proxyHost = null;
        this.tokenOwner = null;
        this.platform = null;
        this.expirationThresholdMs = 60 * 1000;
        this.requireAuth = null;
        this.apiHost = null;
        this.getStorageKey = () => {
            return `__sapi_token_${this.proxyHost}`;
        };
        this.registerFetchIntercept = () => {
            fetchIntercept.register({
                request: async (url, config) => {
                    const host = new URL(url).host;
                    if (host !== this.apiHost) {
                        return [url, config];
                    }
                    if (!isTokenValid()) {
                        await this.fetchToken();
                    }
                    const proxyUrl = new URL(url);
                    proxyUrl.host = this.proxyHost;
                    const headers = {
                        ...(config.headers || {}),
                        Authorization: `Bearer ${this.getLocalSapiTokenData().token}`,
                    };
                    return [
                        proxyUrl.toString(),
                        {
                            ...config,
                            headers,
                        },
                    ];
                },
            });
        };
        this.refreshToken = async () => {
            try {
                const data = await this.fetchToken();
                this.setLocalSapiTokenData(data);
                const toms = new Date(data.expiresAt).getTime() -
                    Date.now() -
                    this.expirationThresholdMs;
                setTimeout(() => {
                    this.refreshToken();
                }, toms);
            }
            catch (e) {
                console.error(e);
            }
        };
        this.fetchToken = async (auth) => {
            const res = await fetch(`${SAPI_API_BASE_URL}v1/token?code=${this.sapiId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(auth ? { auth } : {}),
                    tokenOwner: this.tokenOwner,
                    metadata: {
                        platform: this.platform,
                    },
                }),
            });
            if (res.status >= 400) {
                throw new Error("Error while trying to create a Sapi token.");
            }
            const json = await res.json();
            const token = json["token"];
            const expiresAt = json["expiresAt"];
            return { token, expiresAt };
        };
        this.getLocalSapiTokenData = () => {
            const localData = localStorage.getItem(this.getStorageKey());
            if (!localData) {
                return null;
            }
            return JSON.parse(localData);
        };
        this.setLocalSapiTokenData = (data) => localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
        this.isTokenValid = () => {
            const localData = this.getLocalSapiTokenData();
            if (!localData) {
                return false;
            }
            return (localData.expiresAt >
                new Date(Date.now() + this.expirationThresholdMs).toISOString());
        };
    }
    init({ sapiId, tokenOwner = "anonymous", platform = "app", requireAuth = false, }) {
        this.sapiId = sapiId;
        this.proxyHost = `${sapiId}.${SAPI_PROXY_HOST}`;
        this.tokenOwner = tokenOwner;
        this.platform = platform;
        this.requireAuth = requireAuth;
        this.apiHost = decodeHost(sapiId);
        this.registerFetchIntercept();
        if (this.requireAuth) {
            return;
        }
        if (!this.isTokenValid()) {
            this.refreshToken().catch(console.error);
        }
        else {
            const data = this.getLocalSapiTokenData();
            const ms = new Date(data.expiresAt).getTime() -
                Date.now() -
                this.expirationThresholdMs;
            setTimeout(() => {
                this.refreshToken().catch(console.error);
            }, ms);
        }
    }
    async authToken(auth) {
        const data = await this.fetchToken(auth);
        this.setLocalSapiTokenData(data);
    }
}
const decodeHost = (input) => {
    const host = input.split(".")[0].replace(/--/g, "@@@@@@");
    const parts = host.split("-");
    parts.pop();
    return parts.join(".").replace(/@@@@@@/g, "-");
};
const sapi = new Sapi();
const init = sapi.init.bind(sapi);
const authToken = sapi.authToken.bind(sapi);
const isTokenValid = sapi.isTokenValid.bind(sapi);
export { init, authToken, isTokenValid };
