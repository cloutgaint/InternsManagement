// A single-label hostname such as "biometric" only resolves inside a private network (for example a
// Docker Compose network), so plain HTTP to it never leaves the host. Anything with a dot or an IP
// address is treated as external and must use HTTPS.
export function isInternalServiceHost(hostname) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(hostname) && !/^\d+$/.test(hostname) && hostname.toLowerCase() !== "localhost";
}
