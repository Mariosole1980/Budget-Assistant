# Money Manager (Realbyte Clone) - Setup Guide

A premium, collaborative mobile-first web app clone of Realbyte's Money Manager. This guide will help you run the app, set up your shared cloud database for free, install the app on your phones, and package it for the Google Play Store.

---

## 🚀 1. How to Run Locally on your PC

Since the application is built entirely as a static single-page app (HTML/CSS/JS), you can run it instantly:
1. Double-click the `index.html` file on your PC to open it in your browser.
2. Or run a simple local web server of your choice.

---

## ☁️ 2. How to Setup Cloud Sync (Sync outside Wi-Fi / On the Go)

To allow you and **Vasoula** to input expenses simultaneously on the go (via mobile data), follow these simple steps to set up a **free cloud database** (takes 2 minutes):

### Step A: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign up for a free account.
2. Click **New Project** and name it (e.g., `MoneyManager`). Set a database password of your choice.
3. Choose the region closest to you (e.g., `West Europe`).

### Step B: Create Database Tables (1 Click)
1. In your Supabase Dashboard, click on **SQL Editor** (icon of a tablet with `SQL` on the left sidebar).
2. Click **New Query**.
3. Open the file `supabase-schema.sql` (located in your `money-manager` folder), copy all of its content, and paste it into the Supabase SQL query box.
4. Click the green **Run** button at the top right.
   *This will instantly create your `transactions`, `accounts`, and `categories` tables and populate them with the default items and transactions matching your screenshots.*

### Step C: Link the Web App to Supabase
1. In your Supabase Dashboard, click on **Project Settings** (gear icon at the bottom of the left sidebar).
2. Go to **API**.
3. Under **Project API keys**, find:
   - **Project URL** (e.g. `https://xxxxxxxxxxxxxx.supabase.co`)
   - **anon / public** key (a long string beginning with `eyJ...`)
4. Open the Money Manager app on your PC or mobile, click the **Cloud Settings (Cloud Icon)** in the top right (or go to **More** -> **Sync status**).
5. Paste your **Supabase URL** and **Anon Key**, then click **Σύνδεση & Sync**.
6. The sync badge will turn blue and show **Cloud Sync**. Your data is now securely saved in the cloud in real-time!

---

## 📱 3. How to Install on your Phone (PWA)

Once you host the website (see step 4), you can install it on your phone:
- **Android (Chrome)**: Open the website. A banner will pop up at the bottom: "Προσθήκη στην αρχική οθόνη" (Add to Home Screen) or "Εγκατάσταση Εφαρμογής". Tap it.
- **iOS / iPhone (Safari)**: Open the website, tap the **Share** button, scroll down, and select **Add to Home Screen** (Προσθήκη στην Οθόνη Αφετηρίας).
- *The app will now show as an icon on your launcher and will open in fullscreen mode without address bars, giving a 100% native look.*

---

## 📦 4. How to Package for the Google Play Store (APK/AAB)

To publish it as a real app in the Google Play Store:
1. Host your project folder on a free hosting site (e.g., [Vercel](https://vercel.com) or [GitHub Pages](https://pages.github.com/)). This takes 1 minute and provides you with a permanent web address (e.g., `https://mario-money.vercel.app`).
2. Go to **[PWABuilder.com](https://www.pwabuilder.com/)** (Microsoft's official free packaging tool).
3. Paste your hosted URL (e.g., `https://mario-money.vercel.app`) and click **Start**.
4. The tool will check the manifest and service worker we created and show all checkmarks green.
5. Click **Package for Store** -> **Android** -> **Generate**.
6. Download the generated `.aab` (Android App Bundle) or `.apk` file.
7. You can install the `.apk` directly on your phones, or upload the `.aab` to your Google Play Console developer account to publish it to the Play Store!
