# TePrestamos Admin Dashboard

Admin dashboard for your loan broker platform. Connects to your Railway backend.

## Deploy to Vercel (Step by Step)

### Step 1: Create a GitHub Account (if you don't have one)
1. Go to **github.com** and click **Sign Up**
2. Follow the steps to create your account
3. Verify your email

### Step 2: Create a New Repository
1. Once logged in, click the **+** button (top right) → **New repository**
2. Name it: `teprestamos-admin`
3. Set it to **Private**
4. Click **Create repository**

### Step 3: Upload the Project Files
1. On your new repository page, click **"uploading an existing file"** link
2. Drag and drop ALL the files and folders from this project
3. Make sure you upload:
   - `package.json`
   - `next.config.js`
   - `middleware.js`
   - `.gitignore`
   - `app/` folder (with all files inside)
4. Click **Commit changes**

### Step 4: Deploy on Vercel
1. Go to **vercel.com** and click **Sign Up**
2. Sign up with your **GitHub account**
3. Click **Add New → Project**
4. Find and select your `teprestamos-admin` repository
5. Before clicking Deploy, go to **Environment Variables** and add:

| Name | Value |
|------|-------|
| `ADMIN_PASSWORD` | Choose a strong password (e.g. `MySecure2024!`) |
| `NEXT_PUBLIC_API_URL` | `https://loan-broker-backend-production.up.railway.app/api` |

6. Click **Deploy**
7. Wait ~2 minutes for it to build

### Step 5: Access Your Dashboard
1. Vercel will give you a URL like: `teprestamos-admin.vercel.app`
2. Go to that URL
3. Enter the password you set in Step 4
4. You're in! 🎉

## Features
- **Overview** — Stats, revenue charts, conversion rates
- **Leads** — Search, filter, export CSV, view full details
- **Lenders** — Add/edit lenders, test connections
- **Analytics** — Customizable time periods, trend charts
- **Settings** — Backend health check, webhook info
- **Login** — Password-protected access

## Changing Your Password
1. Go to **vercel.com** → Your project → **Settings** → **Environment Variables**
2. Edit the `ADMIN_PASSWORD` value
3. Click **Save**
4. Go to **Deployments** tab → click **Redeploy** on the latest deployment

## Custom Domain (Optional)
1. In Vercel, go to your project → **Settings** → **Domains**
2. Add your domain (e.g. `admin.teprestamos.es`)
3. Follow the DNS instructions Vercel provides

## Cost
- **Vercel**: Free (Hobby plan is more than enough)
- **Railway**: Your existing plan (~$5-20/month)
