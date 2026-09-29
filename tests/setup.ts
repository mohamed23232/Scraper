// The fixture server used by integration tests runs on 127.0.0.1, which the
// SSRF policy (src/core/security/UrlPolicy.ts) blocks by default. Tests that
// specifically verify the policy blocks private addresses override this
// per-call with { allowPrivateNetworks: false }.
process.env["ALLOW_PRIVATE_NETWORKS"] = "true";
