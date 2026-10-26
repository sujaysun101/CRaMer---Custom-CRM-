# Cloudflare for SaaS: Reselling CRaMer to the Public

This blueprint explains how to use **Cloudflare for SaaS (SSL for SaaS)** to sell CRaMer to other companies with white-label custom domains, automatic SSL, and enterprise DDoS protection.

---

## Architecture Overview

```
Customer's Domain                   Your Cloudflare Edge                   Your Server (Docker/VPS)
crm.clientcompany.com   ─────►   [Cloudflare for SaaS]   ─────►   [Next.js App + PostgreSQL]
                                  - Automatic SSL                  - Multi-tenant data isolation
                                  - DDoS / WAF                     - Automatic workspace routing
                                  - Global CDN Cache
```

When a customer subscribes to your CRM:
1. They create a CNAME record on their domain: `crm.theirdomain.com CNAME cname.yourcrmdomain.com`.
2. Cloudflare intercepts the request, provisions a free SSL certificate automatically, and terminates HTTPS.
3. Your CRaMer server receives the request, identifies their workspace by domain or session, and renders their private CRM.

---

## Step 1: Enable Cloudflare for SaaS

1. In your Cloudflare Dashboard, select your primary domain (e.g. `yourcrmdomain.com`).
2. Navigate to **SSL/TLS > Custom Hostnames**.
3. Click **Enable Cloudflare for SaaS** (the first **100 custom hostnames are 100% free**).
4. Enter your fallback origin (e.g. `app.yourcrmdomain.com`). This is the subdomain that points to your VPS or Cloudflare Tunnel.

---

## Step 2: Customer Custom Domain Flow

When a customer wants their own branded domain (e.g. `crm.acmecorp.com`):

### 1. Register the Custom Hostname
You can add it in the Cloudflare Dashboard under **Custom Hostnames**, or automatically via Cloudflare's REST API:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/custom_hostnames" \
     -H "Authorization: Bearer {your_api_token}" \
     -H "Content-Type: application/json" \
     -d '{
       "hostname": "crm.acmecorp.com",
       "ssl": { "method": "http", "type": "dv" }
     }'
```

### 2. Give the Customer DNS Instructions
Ask the customer to add one CNAME record in their DNS provider (GoDaddy, Namecheap, Route 53):
* **Type**: `CNAME`
* **Name**: `crm`
* **Target / Value**: `cname.yourcrmdomain.com`

*Cloudflare validates ownership and provisions the SSL certificate within minutes. Zero configuration on your server required.*

---

## Step 3: Multi-Tenant Database Isolation

CRaMer now has full multi-tenant isolation built in:
* Every organization has a unique `org_id` in `public.organizations`.
* All contacts, deals, messages, and meetings are strictly filtered by `org_id`.
* New customers can immediately create their workspace at `/signup`.
* Team members can be invited to an organization with roles (`owner`, `admin`, `member`, `viewer`).

---

## Step 4: Adding Subscriptions & Billing (Stripe)

To monetize the platform:
1. Create a Stripe account at [stripe.com](https://stripe.com).
2. Create two recurring products in the Stripe Dashboard:
   * **Starter**: $29/month (up to 3 team members)
   * **Pro**: $79/month (unlimited team members + auto-sync)
3. Direct customers to a Stripe Checkout Session upon signup.
4. Use Stripe Webhooks (`customer.subscription.created`, `customer.subscription.deleted`) to automatically update `subscription_status` in `public.organizations`.
