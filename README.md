# Bun SMTP Relay Gateway

A high-performance, asynchronous SMTP Mail Transfer Agent (MTA) built on the Bun runtime. Designed for secure, authenticated relaying with a focus on low-latency delivery and comprehensive protocol compliance.

## Technical Architecture

The gateway is implemented using a custom asynchronous state machine built directly on Bun's TCP primitives (`Bun.listen` and `Bun.connect`). This architecture eliminates the overhead of high-level libraries while providing granular control over the SMTP handshake.

### Protocol Flow
1. **Ingress**: Authenticated SMTP submission via standard PLAIN/LOGIN mechanisms.
2. **Persistence**: Inbound transactions are committed to a persistent local queue (`data/mail_queue.json`).
3. **Resolution**: Dynamic DNS resolution of MX records for recipient domains.
4. **Encryption**: Intelligent STARTTLS negotiation for secure transit to destination MTAs.
5. **Egress**: Manual SMTP handshake and transaction commitment at the destination.

## Production Configuration

### DNS Requirements
For reliable delivery, the following DNS records must be configured for the relay's outbound IP:

- **PTR (Reverse DNS)**: The IP address must resolve back to the relay's hostname. Most major providers (Gmail, Outlook) reject mail from IPs without a valid PTR.
- **SPF (Sender Policy Framework)**: Include the relay's IP in your domain's SPF record: `v=spf1 ip4:your_ip_here ~all`.
- **DKIM (DomainKeys Identified Mail)**: While this relay currently handles transit, it is recommended to sign messages at the application layer before submission.

### Environment Specification

| Variable | Specification | Default |
| :--- | :--- | :--- |
| `SMTP_PORT` | Listening socket for inbound submission | `587` |
| `SMTP_USER` | Primary authentication principal | **Required** |
| `SMTP_PASS` | Primary authentication secret | **Required** |
| `SMTP_DOMAIN` | HELO/EHLO identity string | `localhost` |
| `SMTP_USERS_JSON` | Extended user registry (JSON array) | `[]` |

## MX Resolution Guide

The relay dynamically discovers the target MTA for any given recipient. To configure your domain to use this relay as its outbound gateway:

1. **Self-Hosting**: If you are using this relay for your own apps, simply point your SMTP client to the relay's IP on port 587.
2. **Inbound Routing**: To receive mail through this relay, set your domain's MX record to point to this server's hostname:
   ```text
   example.com.  IN  MX  10  relay.example.com.
   ```

## Development & Operations

### Service Initialization
```bash
bun install
bun run src/index.ts
```

### Deployment Strategy
A standard `docker-compose.yml` is provided for containerized environments. The service is optimized for deployment behind reverse proxies or as a standalone MTA in Coolify/Hetzner environments.

## Maintenance & Monitoring
The system logs structured tactical diagnostics to `stdout`. Persistence is maintained in the `./data` directory, which should be mounted as a volume in containerized deployments to ensure queue integrity across restarts.

## License
MIT. Engineered for reliability.
