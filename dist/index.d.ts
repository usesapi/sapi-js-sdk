declare const init: ({ sapiId, tokenOwner, platform, requireAuth, }: {
    sapiId: string;
    tokenOwner?: string | undefined;
    platform?: string | undefined;
    requireAuth: boolean;
}) => void;
declare const authToken: (auth: {
    type: "captcha";
    value: string;
}) => Promise<void>;
declare const isTokenValid: () => boolean;
export { init, authToken, isTokenValid };
//# sourceMappingURL=index.d.ts.map