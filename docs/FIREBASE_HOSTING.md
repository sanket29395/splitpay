# Deploy SplitPay to Firebase Hosting

SplitPay is a static React application. Firebase Hosting serves the compiled `dist/` directory over HTTPS. No Firebase client SDK, API key, database, authentication service, or backend is needed.

The live instance is at **[splitpay-cbf11.web.app](https://splitpay-cbf11.web.app)**. Follow this guide to deploy your own copy.

## 1. Choose a Firebase project

Create or select a project in the [Firebase console](https://console.firebase.google.com/). Use the **Spark** plan if you want to stay within Firebase's no-cost Hosting quotas. This project uses **Hosting**, not the separate **App Hosting** product.

Hosting has storage and transfer limits even on Spark. If a quota is exceeded, service or deployment can be limited; a paid plan has different billing behavior. Check the [current official quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing) and the project's Hosting usage dashboard. Visitors do not pay a SplitPay access fee.

Copy the **project ID** from Project settings. A project ID is different from the display name or project number.

## 2. Install tools and sign in

From the repository root, with Node.js 22.12+ installed:

```sh
npm ci
npm install -g firebase-tools
firebase login
firebase projects:list
```

On Windows PowerShell, use `npm.cmd` and `firebase.cmd` if `.ps1` scripts are blocked. Keep Google credentials and service-account files out of the repository.

## 3. Check Hosting locally

```sh
npm run hosting:local
```

Open **http://127.0.0.1:5000**. This command builds the app and starts only the Hosting emulator using `demo-splitpay`, a local demo project ID. It does not deploy a site or create cloud resources. Stop it with Ctrl+C.

The emulator reads the static files and rewrites from `firebase.json`. Also check response headers on the deployed site: the Windows Firebase CLI 15.4.0 used during setup omitted custom headers locally because its emulator normalized URL patterns to Windows paths.

## 4. Deploy

```sh
npm run deploy -- --project YOUR_FIREBASE_PROJECT_ID
```

Replace the placeholder with the actual project ID. `firebase.json` runs `npm test` and `npm run build` before deployment, so stale build output is not published.

Only Hosting is deployed. A successful deployment prints the public URL, normally:

```text
https://YOUR_FIREBASE_PROJECT_ID.web.app
https://YOUR_FIREBASE_PROJECT_ID.firebaseapp.com
```

Choose an empty or dedicated Hosting site: deploying updates the selected site's live content. This configuration targets the selected project's default Hosting site. For projects with multiple sites, use [Firebase deploy targets](https://firebase.google.com/docs/hosting/multisites).

### Optional: remember your project locally

Copy `.firebaserc.example` to `.firebaserc` and replace `your-firebase-project-id`:

```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

Then deploy with `npm run deploy`. `.firebaserc` is ignored by Git so people cloning the public repository choose their own project. Project IDs are not secret credentials; omitting this local alias helps avoid accidental deployment to the original project's site.

## What the configuration does

| Configuration                | Behavior                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `public: dist`               | Publishes only the built app, not source files, documentation, or test output |
| `predeploy`                  | Runs calculation tests and builds before an upload                            |
| SPA rewrite                  | Falls back to `index.html` for application URLs                               |
| `Cache-Control: no-cache`    | Lets HTML updates be revalidated                                              |
| `/assets/**` immutable cache | Caches Vite's versioned scripts, styles, and fonts for one year               |
| `X-Content-Type-Options`     | Disables MIME type sniffing                                                   |
| `X-Frame-Options`            | Prevents embedding the merchant workspace in another site's frame             |
| `Referrer-Policy`            | Restricts referrer information on cross-origin navigation                     |

See [Firebase's Hosting configuration reference](https://firebase.google.com/docs/hosting/full-config).

## Check the public site

- Open the HTTPS URL on a desktop and a phone.
- Create a small example bill and check that each generated amount stays within the cap.
- Confirm the real merchant account name in the target UPI app before approving any payment.
- Remember that payment status is manual and saved only in that browser.
- Refresh the page and reopen the bill from history.

Localhost history and live-site history are separate. Switching between the `web.app`, `firebaseapp.com`, and a custom domain also creates separate storage origins; share one preferred URL with users.

## Updates

After making changes:

```sh
npm test
npm run test:e2e
npm run deploy -- --project YOUR_FIREBASE_PROJECT_ID
```

Run browser tests when payment or UI behavior changes. Deployment itself always reruns the calculation tests and build.

## Publish the source on GitHub

The main [README](../README.md) uses relative screenshot paths so images render in the repository and in forks.

Include source files, `package.json`, `package-lock.json`, configuration files, `docs/images/`, and the Markdown documentation. `.gitignore` excludes dependencies, builds, local bill-testing artifacts, Firebase caches, local project aliases, environment files, and common credential filenames.

Use an empty GitHub repository, then run the following from this project directory, replacing the repository URL:

```sh
git init -b main
git add .
git status
git commit -m "Initial SplitPay release"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Review `git status` before committing. Never add real bill exports, UPI PINs, credentials, or private test data. Add the deployed URL to the repository's About section and README when the site is live. Choose an explicit source-code license before describing the repository as open source.

Deployment credentials are not needed in GitHub for this manual deployment flow. If you add automated deployment later, configure it in the repository settings rather than committing credentials.
