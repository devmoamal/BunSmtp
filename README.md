# Bun SMTP Relay Gateway

A high-performance SMTP relay server built with Bun, featuring full STARTTLS support and Traefik integration.

## 🚀 Setup Steps

### 1. Configure Envs
Create a `.env` file with these keys:

```bash
SMTP_PORT=587
SMTP_USER=myuser
SMTP_PASS=mypassword
SMTP_DOMAIN=mail.moamal.space

# TLS Certificates (required for STARTTLS)
TLS_CERT=/certs/fullchain.pem
TLS_KEY=/certs/privkey.pem

# Optional: Extra Users
# SMTP_USERS_JSON='[{"user":"u1","pass":"p1"}]'
```

### 2. Configure DNS
Follow these steps for best deliverability:

1.  **PTR**: Set a Reverse DNS record for your IP to your hostname (`mail.moamal.space`).
2.  **SPF**: Add a TXT record `v=spf1 ip4:<YOUR_IP> ~all`.
3.  **MX**: Point your domain's MX record to your server:
    `example.com. IN MX 10 mail.moamal.space.`

### 3. Start Relay with Docker
Deploy using Docker Compose (integrates with Traefik):
```bash
docker compose up -d
```

### 4. Verify Protocol
Verify the SMTP protocol is responding and advertising STARTTLS:
```bash
bun check
```

## 🛠 Features
- **STARTTLS Secure**: Full support for upgrading plain-text connections to TLS using local certificates.
- **MX Resolution**: Dynamic target lookup with automatic MX priority sorting.
- **Queue**: Persistent mail queue with exponential backoff retries for transient errors.
- **Multi-Auth**: Secondary credential support via JSON registry.
- **Traefik Ready**: Built-in labels for TCP routing and automated certificate resolution.

MIT.
