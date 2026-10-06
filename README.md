# POSHRAW

## Run locally

Install dependencies with `npm install`, then start the API and website with `npm run dev`. The storefront is available at `http://localhost:5173`.

## Admin access

Open `http://localhost:5173/admin` to create the first owner account or sign in. For the initial setup, enter the one-time token from the root `.env` file, your admin email address, and a password of at least 12 characters. The setup token is accepted only until the first admin account is created.

The local `.env` file is ignored by Git. Never commit production credentials.

## Order notifications

Customers can optionally provide an email address when placing an order. Order confirmations, order status changes, and refund records are queued in the same database transaction as their order event. Background workers send messages and retry temporary failures with backoff, then mark messages failed after eight attempts.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, and `SMTP_FROM` in the server environment. If the SMTP provider requires authentication, set both `SMTP_USER` and `SMTP_PASSWORD`. Without SMTP configuration, email notifications remain queued.

Customers may separately opt in at checkout to WhatsApp updates for that order. This consent is optional and distinct from the required order-processing privacy consent; it is recorded with the order and is not marketing consent. The app queues WhatsApp order confirmations, pickup/delivery status changes, shipped updates, and refund notices only when the customer opted in and supplied a valid international phone number. Abandoned carts are not collected or messaged.

To enable WhatsApp delivery, configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_GRAPH_API_VERSION` with Meta WhatsApp Cloud API credentials, then set the approved template names and exact language codes for `WHATSAPP_TEMPLATE_ORDER_RECEIVED`, `WHATSAPP_TEMPLATE_ORDER_STATUS`, `WHATSAPP_TEMPLATE_REFUND`, `WHATSAPP_TEMPLATE_LOCALE_EN`, and `WHATSAPP_TEMPLATE_LOCALE_CKB`. Create approved utility templates with body parameters in this order: order received: order number; order status: order number, localized status; refund: order number, formatted refund amount, localized payment status. A configured template must match the locale code and parameter count. Keep the access token in the hosting secret manager, never in browser configuration. With WhatsApp unconfigured, opted-in messages remain queued; `/api/health/notifications` reports the configured channels' delivery health.

Delivery orders may be moved to **Shipped** in the admin order status control. Pickup orders use **Ready** for pickup-ready notifications. These messages use Meta-approved templates, as WhatsApp business-initiated messages require approved templates outside the customer-service window.

## Analytics and privacy

The admin dashboard's **Analytics** tab reports anonymous storefront page views, order requests, request-to-view ratio, and popular paths for the previous 30 days. It stores only page paths and timestamps, not IP addresses, cookies, or visitor identifiers. Order contact information is used to process requests; email is optional and used for order and refund updates, while WhatsApp updates are sent only with separate opt-in consent.

## Monitoring and alerts

The repository includes a self-hosted Docker Compose monitoring stack: Prometheus collects API/runtime metrics, Grafana provides a provisioned operations dashboard, Alertmanager sends alerts, and Blackbox Exporter checks API and notification readiness. Browser exceptions are reported only as fixed, privacy-safe error categories; no stack traces, user text, URLs, or customer information are submitted.

1. Ensure the root `.env` contains production PostgreSQL, admin setup, SMTP, and `POSHRAW_ALLOWED_ORIGINS=https://poshraw.com,https://www.poshraw.com`. Do not use the development PGlite database for a production deployment.
2. Generate local Grafana and API metrics credentials with `npm run monitoring:setup`. This creates ignored local files and refuses to overwrite existing credentials.
3. Start the full stack with `npm run monitoring:up` (equivalent to `docker compose --env-file .env --env-file .env.monitoring up -d --build`). The storefront/API is available to a host reverse proxy at `http://127.0.0.1:3001`; configure the proxy to provide HTTPS. Grafana is available locally at `http://127.0.0.1:3000`, Alertmanager at `http://127.0.0.1:9093`, and the local alert email inbox at `http://127.0.0.1:8025`. These management ports bind to loopback and must not be exposed publicly.
4. Open Grafana with username `admin` and the generated password in ignored `.env.monitoring`. Check the **POSHRAW / POSHRAW Operations** dashboard, Prometheus targets, and Alertmanager alerts.
5. For real alert delivery, edit `.env.monitoring` and replace the local Mailpit SMTP defaults with your SMTP host, sender, credentials, TLS setting, and operator email. Then apply the changes with `docker compose up -d alertmanager`. Without those settings, alert messages are intentionally captured only in the local Mailpit inbox.

The included alert rules cover unavailable API/health probes, sustained server errors, high p95 API latency, and repeated browser errors. `GET /api/health` checks database readiness; `/api/health/live` checks process liveness; `/api/health/notifications` detects delayed or failed transactional email delivery. Metrics are available only at `/internal/metrics` and require the Docker-mounted bearer-token secret. The API normalizes route labels to prevent high-cardinality metrics, and the browser report endpoint accepts only fixed error categories with rate limiting.

Stop the containers without removing monitoring history using `npm run monitoring:down`. To also delete metrics, dashboards, and alert history, use `docker compose --env-file .env --env-file .env.monitoring down --volumes` only when you intentionally want to erase that data.

Use the hosting and managed database providers' own alerts for host CPU, container limits, disk, database capacity, and connection exhaustion. Keep the Grafana, Prometheus, and Alertmanager data volumes persistent and include them in your operational backup policy. Monitor scheduled database backups separately and periodically test restoring one.

## Store accounting

The admin dashboard's **Accounting** tab tracks operational bookkeeping in IQD:

- Cash and bank-transfer balances are calculated from the recorded ledger entries.
- Record one or more partial payments against a priced order, choosing cash or bank transfer for each receipt. Pickup totals must match the item subtotal; delivery orders can include the confirmed delivery fee. Payments cannot exceed the remaining order total.
- Record partial or full refunds up to the net amount received. Refunds are allocated to original payments, recorded as separate outflows, and reduce the selected account balance. The unpaid remainder of a partially paid order remains payable.
- Record walk-in sales (ledger-only; they do not create customer orders or change inventory), other income, expenses, and one opening balance per cash/bank account.
- Transfer money between cash and bank accounts without changing income or profit.
- Review income less refunds, expenses, net operating profit, cash/bank balances, and transaction history for a chosen date range (maximum 366 days).
- Export the selected report as CSV. Spreadsheet formula-like fields are escaped, and the export requires an authenticated admin session.

Entries are retained in an audit-friendly ledger and cannot be edited or deleted. Reverse eligible manual entries using the correction action; order payments and refunds must be reconciled through their order workflow. Balances include all entries from the ledger's beginning, while the selected date range controls profit and transaction history. This is basic store bookkeeping—not double-entry accounting, an inventory valuation, a tax report, an accounts-receivable system, or a substitute for an Iraqi accountant. Reconcile recorded balances with the actual till and bank statements regularly.

## Production deployment

The repository includes a multi-stage `Dockerfile` for deployment behind a hosting provider's HTTPS reverse proxy. Configure the provider with:

- `NODE_ENV=production`, `API_HOST=0.0.0.0`, and `API_PORT=3001` (or the provider's assigned port, if its platform supports setting `API_PORT`).
- A managed PostgreSQL `DATABASE_URL`, `DATABASE_SSL=require`, and the public storefront origins in `POSHRAW_ALLOWED_ORIGINS`, set to `https://poshraw.com,https://www.poshraw.com`.
- `TRUST_PROXY_HOPS` matching the number of trusted HTTPS proxy hops in front of the app.
- A unique, randomly generated `POSHRAW_ADMIN_SETUP_TOKEN` of at least 32 bytes only if initial admin setup is still required. Remove it after setup.
- The SMTP settings above if email notifications should be sent.
- The Meta WhatsApp Cloud API credentials and approved template settings above if opted-in customers should receive WhatsApp updates.

The production server refuses plain HTTP and local PGlite databases. The canonical storefront URL is `https://www.poshraw.com/`; `https://poshraw.com` should redirect to it. Both hostnames are allowed as storefront origins. The domain currently resolves and the apex redirects to `www`; verify both hostnames have valid, automatically renewed TLS certificates and keep that redirect at the hosting/DNS provider. Point DNS at the hosting target supplied by that provider.

## PostgreSQL backups

Install PostgreSQL client tools (`pg_dump` and `pg_restore`) on the machine or scheduled-job runner that will create or restore backups. Set `DATABASE_URL` and `BACKUP_ENCRYPTION_KEY`, then run:

```sh
npm run backup
```

Generate a key with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"` and store it separately from both the application and backup files. The command streams a PostgreSQL custom-format dump into AES-256-GCM encryption and writes a `.dump.enc` file under `backups/` (or `BACKUP_DIR`); it never prints the database URL. Schedule it regularly, copy encrypted backups to storage separate from the database host, define a retention period, and enable the managed database provider's automated backups.

To test recovery, set `DATABASE_URL` to a new, empty PostgreSQL database and use the same encryption key:

```sh
npm run restore -- backups/poshraw-<timestamp>.dump.enc
```

The restore command authenticates and decrypts the backup before applying it, then removes its temporary plaintext dump. Keep the encryption key safe: backups cannot be recovered without it.

Before launch, verify the custom domain over HTTPS, test an order and its email notifications end to end, confirm a backup can be restored, and check that page-view and order-request counts appear in the admin analytics tab.
#
#   p o s h r a w - f o u n d e r  
 #   p o s h r a w - f o u n d e r  
 