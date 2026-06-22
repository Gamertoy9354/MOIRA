# Openweathermap — Setup Guide

> OpenWeatherMap provides current and forecasted weather data through its API, allowing developers to access weather information for various locations worldwide.

**Estimated setup time:** 5 minutes

---

## Credential Steps

### Step 1: Create an OpenWeatherMap Account

Go to openweathermap.org and sign up for a free account using your work email.

🔗 **URL:** [https://home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up)

*What you'll see: You should see the OpenWeatherMap dashboard with a navigation menu at the top.*

✅ **Expected result:** You are logged into the OpenWeatherMap dashboard.

### Step 2: Generate an API Key

Navigate to the API keys section and generate a new key.

🔗 **URL:** [https://home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)

*What you'll see: You should see a list of your API keys, including the newly generated one.*

✅ **Expected result:** You have a new API key listed in the API keys section.

---

## Add to Your `.env` File

```env
OPENWEATHERMAP_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Test Your Setup

```bash
curl -X GET http://api.openweathermap.org/data/2.5/weather?q=London&appid=$OPENWEATHERMAP_API_KEY
```

---

## Common Errors

**Error:** `401 Unauthorized`
**Fix:** Your API key is invalid or has been revoked. Generate a new one from the API keys settings page.

**Error:** `429 Too Many Requests`
**Fix:** You have exceeded the request limit for your API key. Consider upgrading to a paid plan or optimizing your requests.

---

> 💡 **Pricing:** OpenWeatherMap free tier: 60 calls/minute. Paid plans start at $15/month for 500,000 calls.
