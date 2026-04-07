# Bun SMTP Relay Gateway

A high-performance SMTP relay server built with Bun for modern email delivery.

## 🚀 Setup Steps

### 1. Configure Envs

Create a `.env` file with these keys:

```bash
SMTP_PORT=587
SMTP_USER=myuser
SMTP_PASS=mypassword
SMTP_DOMAIN=mail.moamal.space

# TLS Certificates (auto-generated on startup if missing)
TLS_CERT=/certs/fullchain.pem
TLS_KEY=/certs/privkey.pem
```

### 2. Configure DNS

Follow these steps for best deliverability:

1.  **PTR**: Set a Reverse DNS record for your IP to your hostname (`mail.moamal.space`).
2.  **SPF**: Add a TXT record `v=spf1 ip4:<YOUR_IP> ~all`.
3.  **MX**: Point your domain's MX record to your server:
    `example.com. IN MX 10 mail.moamal.space.`

### 3. Start Relay with Docker

```bash
docker compose up -d
```

### 4. Verify Protocol

Verify the SMTP protocol is responding:

```bash
bun apply scripts/check.ts
```

## 🛠 Features

- **STARTTLS Secure**: Automatically generates self-signed certificates if none are provided.
- **MX Resolution**: Dynamic target lookup with priority sorting.
- **Queue**: Persistent mail queue with exponential backoff for 4xx errors.
- **Multi-Auth**: Secondary credential support via JSON registry.
- **Modern Architecture**: Clean, type-safe, and modular codebase.
