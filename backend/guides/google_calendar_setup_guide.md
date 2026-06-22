# Google_Calendar — Setup Guide

> Google Calendar is a time management and scheduling service that allows users to create and manage events

**Estimated setup time:** 10 minutes

---

## Credential Steps

### Step 1: Create a Google Cloud Project

Go to console.cloud.google.com and create a new project

🔗 **URL:** [https://console.cloud.google.com/](https://console.cloud.google.com/)

*What you'll see: You should see the Google Cloud Console dashboard with your newly created project*

✅ **Expected result:** You have created a new Google Cloud project

### Step 2: Enable Google Calendar API

Search for Google Calendar API in the marketplace and click on the result, then click on the Enable button

🔗 **URL:** [https://console.cloud.google.com/apis/library/calendar-json.googleapis.com](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)

*What you'll see: You should see the Google Calendar API page with the Enable button*

✅ **Expected result:** Google Calendar API is enabled for your project

### Step 3: Create Credentials for Your Project

Go to the Navigation menu and click on APIs & Services > Credentials, then click on Create Credentials > OAuth client ID

🔗 **URL:** [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

*What you'll see: You should see the Create credentials page with the OAuth client ID option*

✅ **Expected result:** You have created credentials for your project

### Step 4: Create a Service Account and Generate a Private Key

Go to the Navigation menu and click on IAM & Admin > Service accounts, then click on Create Service Account and follow the prompts to generate a private key

🔗 **URL:** [https://console.cloud.google.com/iam-admin/serviceaccounts](https://console.cloud.google.com/iam-admin/serviceaccounts)

*What you'll see: You should see the Service accounts page with the Create Service Account button*

✅ **Expected result:** You have created a service account and generated a private key

### Step 5: Create a Google Calendar Token

Use the private key to authenticate with the Google Calendar API and obtain a token

🔗 **URL:** [https://developers.google.com/calendar/api/quickstart/java](https://developers.google.com/calendar/api/quickstart/java)

*What you'll see: You should see the authentication prompt to obtain a token*

✅ **Expected result:** You have obtained a Google Calendar token

---

## Add to Your `.env` File

```env
GOOGLE_CALENDAR_TOKEN=your_token_here
```

---

## Test Your Setup

```bash
curl -X POST https://www.googleapis.com/calendar/v3/calendars/primary/events -H 'Authorization: Bearer $GOOGLE_CALENDAR_TOKEN' -H 'Content-Type: application/json' -d '{"summary":"Test Event","description":"Test Event","start":{"date":"2024-01-01"},"end":{"date":"2024-01-01"}}'
```

---

## Common Errors

**Error:** `401 Unauthorized`
**Fix:** Your API token is invalid or has been revoked. Generate a new one from the Google Cloud Console

**Error:** `403 Forbidden`
**Fix:** Your API token does not have the required permissions. Set it to have the correct permissions in the Google Cloud Console

---

> 💡 **Pricing:** Google Calendar API is free for most use cases, but may incur costs for large-scale or commercial use. See the Google Cloud Pricing page for more information
