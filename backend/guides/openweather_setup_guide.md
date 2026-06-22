# Openweather — Setup Guide

> OpenWeather provides current and forecasted weather conditions through its API

**Estimated setup time:** 5 minutes

---

## Credential Steps

### Step 1: Create an OpenWeather Account

Go to openweathermap.org and sign up for a free account using your work email.

🔗 **URL:** [https://home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up)

*What you'll see: You should see the OpenWeather dashboard with a navigation menu at the top.*

✅ **Expected result:** You are logged into the OpenWeather dashboard.

### Step 2: Generate an OpenWeather API Key

Go to the API keys section and generate a new key.

🔗 **URL:** [https://home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)

*What you'll see: You should see a list of API keys with a button to generate a new one.*

✅ **Expected result:** You have generated a new API key.

---

## Add to Your `.env` File

```env
OPENWEATHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxx
```

---

## Test Your Setup

```bash
curl -X GET http://api.openweathermap.org/data/2.5/weather?q=London&appid=$OPENWEATHER_API_KEY
```

---

## Common Errors

**Error:** `401 Unauthorized`
**Fix:** Your API key is invalid or has been revoked. Generate a new one from the API keys settings page.

**Error:** `429 Too Many Requests`
**Fix:** You have exceeded the request limit for your API key. Consider upgrading to a paid plan for more requests.

---

> 💡 **Pricing:** OpenWeather free tier: 60 calls/minute. Paid plans start at $15/month for 500,000 calls.
