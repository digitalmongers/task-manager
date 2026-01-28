# Google Instant Indexing API - Setup Guide

Follow these steps exactly to get your "JSON Key" and enable the API.

## Step 1: Create Project & Enable API
1.  Go to the **[Google Cloud Console](https://console.cloud.google.com/)**.
2.  Create a **New Project** (e.g., named "Tasskr-SEO").
3.  Once created, select the project.
4.  Go to **[Google Indexing API page](https://console.cloud.google.com/apis/library/indexing.googleapis.com)**.
5.  Click **ENABLE**.

## Step 2: Create Service Account
1.  Go to the **[Service Accounts page](https://console.cloud.google.com/iam-admin/serviceaccounts)**.
2.  Make sure your project ("Tasskr-SEO") is selected at the top.
3.  Click **+ CREATE SERVICE ACCOUNT**.
4.  **Name**: Enter something like `indexing-bot`.
5.  **Description**: "Bot for Instant Indexing".
6.  Click **CREATE AND CONTINUE**.
7.  **Role**: Select **Owner** (or "Project > Owner" for simplicity, though "Editor" is often enough).
8.  Click **CONTINUE** and then **DONE**.

## Step 3: Download JSON Key
1.  You will see your new service account in the list (e.g., `indexing-bot@tasskr-seo.iam.gserviceaccount.com`).
2.  Click on the **Email** of the service account to open details.
3.  Go to the **KEYS** tab (top menu).
4.  Click **ADD KEY** > **Create new key**.
5.  Select **JSON**.
6.  Click **CREATE**.
7.  A file (e.g., `tasskr-seo-12345.json`) will download to your computer. **Keep this safe!**

## Step 4: Link to Search Console (CRITICAL)
Your bot needs permission to touch your website on Google Search.

1.  Open the JSON file you just downloaded and copy the `client_email` (it looks like `indexing-bot@...`).
2.  Go to **[Google Search Console](https://search.google.com/search-console)**.
3.  Select your property (`https://tasskr.com`).
4.  Go to **Settings** (bottom left) > **Users and permissions**.
5.  Click **ADD USER**.
6.  **Email**: Paste the `client_email` you copied.
7.  **Permission**: Select **Owner** (This is required for Indexing API).
8.  Click **ADD**.

## Step 5: Add to Project
1.  Rename your downloaded JSON file to `service-account.json`.
2.  Move this file into your backend folder: `c:\Task-Manager-Backend\service-account.json`.
3.  Open your `.env` file and add this line:
    ```env
    GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
    ```
    *(Or paste the full absolute path if relative path gives issues)*

## Step 6: Verify
Run the test script I created earlier:
```bash
node test_indexing.js
```
It should now say: `[IndexingService] URL published successfully` (or give a 200 OK status).
