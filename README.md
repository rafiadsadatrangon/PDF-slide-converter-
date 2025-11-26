<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI PDF Slide Converter

This contains everything you need to run your app locally and deploy it.

View your app in AI Studio: https://ai.studio/apps/temp/3

## Run Locally

**Prerequisites:**  Node.js

1.  Install dependencies:
    `npm install`
2.  Create a `.env` file in the root of the project.
3.  Add your Gemini API key to the `.env` file:
    `GEMINI_API_KEY=YOUR_API_KEY_HERE`
4.  Run the app:
    `npm run dev`

## Deploy to Netlify

This project is now configured for easy deployment to Netlify using the included `netlify.toml` file.

1.  **Push to GitHub:** Push your project code to a GitHub repository.
2.  **Connect to Netlify:**
    *   Log in to your Netlify account.
    *   Click "Add new site" > "Import an existing project".
    *   Connect to your GitHub account and choose the repository for this project.
3.  **Configure Environment Variable (Crucial Step!):**
    *   Netlify should automatically detect your build settings (`npm run build`) and publish directory (`dist`) from the `netlify.toml` file.
    *   The most important step is to add your Gemini API key as an environment variable.
    *   In your Netlify site dashboard, go to `Site configuration` > `Build & deploy` > `Environment`.
    *   Under **Environment variables**, click **Edit variables**.
    *   Add a new variable with the following details:
        *   **Key:** `GEMINI_API_KEY`
        *   **Value:** Paste your actual Gemini API key here.

    > **গুরুত্বপূর্ণ (Important):** এই ধাপটি ছাড়া আপনার অ্যাপটি কাজ করবে না। আপনাকে অবশ্যই Netlify-তে `GEMINI_API_KEY` সঠিকভাবে সেট করতে হবে। (Your app will not work without this step. You must set the `GEMINI_API_KEY` correctly in Netlify.)

4.  **Deploy:**
    *   Go back to the `Deploys` section and trigger a new deploy if one hasn't started automatically.
    *   Netlify will build and deploy your application. Once finished, your site will be live!
