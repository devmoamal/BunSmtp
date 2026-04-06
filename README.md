# Bun SMTP Relay Gateway

A high-performance SMTP relay server built with Bun.

## 🚀 Setup Steps

### 1. Configure Envs
Create a `.env` file with these keys:

```bash
SMTP_PORT=587
SMTP_USER=myuser
SMTP_PASS=mypassword
SMTP_DOMAIN=example.com

# Optional: Extra Users
# SMTP_USERS_JSON='[{"user":"u1","pass":"p1"}]'
```

### 2. Configure DNS
Follow these steps for best deliverability:

1.  **PTR**: Set a Reverse DNS record for your IP to your hostname.
2.  **SPF**: Add a TXT record `v=spf1 ip4:<YOUR_IP> ~all`.
3.  **MX**: Point your domain's MX record to your server:
    `example.com. IN MX 10 relay.example.com.`

### 3. Start Relay
Run the server:
```bash
bun install
bun run src/index.ts
```

### 4. Verify Protocol
Verify the SMTP protocol is responding:
```bash
bun check
```

## 🛠 Features
- **STARTTLS**: Automatic protocol encryption.
- **MX Resolution**: Dynamic target lookup.
- **Queue**: Automatic backoff retries for 4xx errors.
- **Multi-Auth**: Support for multiple account credentials via JSON.

MIT.
