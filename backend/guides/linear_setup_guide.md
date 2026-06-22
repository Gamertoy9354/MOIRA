# Linear — Setup Guide

> Linear is a project management tool that helps teams organize and prioritize their work, and the get_latest_tickets API endpoint retrieves the most recent tickets from Linear.

**Estimated setup time:** 3 minutes

---

## Credential Steps

### Step 1: Create a Linear Account and API Key

Log in to linear.app, go to Settings > API Keys, and click Create API Key to generate a new API key.

🔗 **URL:** [https://linear.app/settings/api-keys](https://linear.app/settings/api-keys)

*What you'll see: You should see the API Keys settings page with a list of existing keys and a button to create a new one.*

✅ **Expected result:** You have created a new Linear API key and have its value ready to use.

---

## Add to Your `.env` File

```env
LINEAR_API_KEY=xxxxxxxxxxxxxxxxxxxxxxx
```

---

## Test Your Setup

```bash
curl -X GET https://api.linear.app/graphql -H 'Authorization: Bearer $LINEAR_API_KEY' -H 'Content-Type: application/json' -d '{"query": "query { issues(limit: 10, sortBy: { direction: DESC, field: CREATED_AT }) { id, title } }"}'
```

---

## Common Errors

**Error:** `401 Unauthorized`
**Fix:** Your API key is invalid or has been revoked. Generate a new one from the API Keys settings page.

**Error:** `403 Forbidden`
**Fix:** Your API key does not have the required permissions. Ensure it has the necessary access rights.

---

> 💡 **Pricing:** Linear offers a free plan with limited features, as well as several paid plans starting at $15/user/month.
