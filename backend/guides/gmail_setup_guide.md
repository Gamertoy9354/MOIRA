# Gmail — Setup Guide

> Gmail is an email service that allows users to send and receive emails, and with the Gmail API, you can integrate it into your application to automate email sending and receiving.

**Estimated setup time:** 10 minutes

---

## Credential Steps

### Step 1: Create a Gmail Account and Enable Security

Go to google.com and log in to your account, then navigate to the Security settings page.

🔗 **URL:** [https://myaccount.google.com/security](https://myaccount.google.com/security)

*What you'll see: You should see the Google Account settings page with a navigation menu on the left.*

✅ **Expected result:** You are logged into the Google Account settings page.

### Step 2: Generate a Gmail Token

Click on the Generate token button under the Security settings page.

🔗 **URL:** [https://myaccount.google.com/security](https://myaccount.google.com/security)

*What you'll see: You should see a prompt to generate a token.*

✅ **Expected result:** You have generated a Gmail token.

### Step 3: Save the Gmail Token as an Environment Variable

Save the generated token as an environment variable named GMAIL_TOKEN.

*What you'll see: You should see the token saved as an environment variable.*

✅ **Expected result:** The GMAIL_TOKEN environment variable is set.

---

## Add to Your `.env` File

```env
GMAIL_TOKEN=your_generated_token_here
```

---

## Test Your Setup

```bash
curl -X POST https://www.googleapis.com/gmail/v1/users/me/messages/send -H 'Authorization: Bearer $GMAIL_TOKEN' -H 'Content-Type: application/json' -d '{"raw":"Your email content here"}'
```

---

## Common Errors

**Error:** `401 Unauthorized`
**Fix:** Your Gmail token is invalid or has been revoked. Generate a new one from the Security settings page.

**Error:** `403 Forbidden`
**Fix:** Your Gmail token does not have the required permissions. Make sure to enable the Gmail API and grant the necessary permissions.

---

> 💡 **Pricing:** Gmail API usage is free up to a certain quota, but excessive usage may require a paid Google Workspace account.
