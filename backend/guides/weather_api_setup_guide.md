# Weather_Api — Setup Guide

> OpenWeatherMap provides weather data and forecasts through a REST API.

**Estimated setup time:** 5 minutes

---

## Credential Steps

### Step 1: Create an OpenWeatherMap Account

Go to the OpenWeatherMap website and sign up for a free account.

🔗 **URL:** [https://home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up)

*What you'll see: You should see the OpenWeatherMap homepage with a blue header and sign up form.*

✅ **Expected result:** You have created an account and are logged in.

### Step 2: Navigate to API Keys Section

After logging in, go to the API keys section to generate your key.

🔗 **URL:** [https://home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)

*What you'll see: Look for the 'API keys' link in your account dashboard navigation menu.*

✅ **Expected result:** You are on the API keys management page.

### Step 3: Generate Your API Key

Click the 'Generate' button to create a new API key for your application.

🔗 **URL:** [https://home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)

*What you'll see: You should see a form with a 'Generate' button and fields for key name and permissions.*

✅ **Expected result:** Your new API key is displayed and ready to use.

---

## Add to Your `.env` File

```env
OPENWEATHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Test Your Setup

```bash
curl -X GET 'https://api.openweathermap.org/data/2.5/weather?q=London&appid=$OPENWEATHER_API_KEY'
```

---

## Common Errors

**Error:** `401 Unauthorized`
**Fix:** Your API key is invalid or missing. Verify that you're using the correct API key from your OpenWeatherMap account.

**Error:** `403 Forbidden`
**Fix:** Your API key doesn't have permission to access the requested resource. Check that you're using a valid key with appropriate permissions.

**Error:** `429 Too Many Requests`
**Fix:** You've exceeded the rate limit for your subscription plan. Consider upgrading your plan or implementing request throttling.

---

> 💡 **Pricing:** OpenWeatherMap free tier: 1,000 API calls/day. Paid plans start at $40/month for 10,000 calls.
