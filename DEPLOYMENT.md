# Production deployment

LIVE WEBSITE: https://prana-flow-iko103.vercel.app

Successfully deployed on Vercel on 2026-11-10. This stable production HTTPS domain is publicly accessible without visitor login.

- Project: prana-flow-iko103
- Personal scope: suryansh11
- Deployment ID: dpl_BMxrSLj4Xx9mQpHKiANqb9RdkYx6
- Status: READY / production
- Dashboard: https://vercel.com/suryansh11/prana-flow-iko103

## Build and configuration

React 19, TypeScript and Vite 7 static SPA. Local and Vercel Linux production builds pass; all 24 automated tests pass. Node 24.x is configured. vercel.json selects Vite, npm ci, npm run build, dist, and an SPA rewrite for direct route refreshes. No application environment variables or API keys are required.

No UI, styling, audio synthesis or camera-processing code was changed for deployment. All 35 local asset paths passed existence and case checks. React Router's two internal localhost URL-parsing fallback constants are not app-configured network endpoints.

Environment files and Vercel project/account state are ignored by Git and excluded from deployment uploads. Vercel linking generated an ignored local environment file after deployment; it must never be committed or shared.

## Production verification

- Anonymous requests returned the actual app with HTTP 200 at /, /library, /progress and /settings.
- Public JavaScript, CSS, worker, model, WASM and both font-family assets downloaded and matched local build bytes.
- Browser navigation, direct refreshes, four posture cards and six breathing-practice cards worked.
- Started a guided practice, observed changing ring phases, paused/resumed, stopped and saved it. Local history persisted after refresh.
- Ambient audio initialized after explicit interaction. Tested mute/unmute, volume, profiles and phase integration. Refresh preserved preferences without autoplaying audio.
- Camera setup and continuing without camera worked. Physical webcam inference on the production origin was not tested; deployed model/WASM bytes were verified.
- Responsive viewports at 390x844, 820x1180 and 1512x982 showed no horizontal document overflow. These are browser viewport tests, not physical mobile-device or Safari tests.
- Public browser console contained no warning/error entries during these checks.

HTTP/asset evidence: artifacts/production-verification.json. Screenshots: artifacts/production-desktop.jpg and artifacts/production-mobile.jpg. Test history is stored only in this test browser's local storage, not shared with visitors.

## GitHub repository

Source repository: https://github.com/suryansh71234567/pranaflow

The complete eligible project has been committed and pushed to main. Environment files and Vercel account/project state remain excluded. The repository is not yet connected to Vercel for automatic Git-push deployments; the existing production deployment was uploaded directly through the CLI.

To collaborate, invite your friend's GitHub username through repository Settings > Collaborators. Have them clone the repository, create a branch, run npm ci and npm run dev, and submit a pull request. They do not need your Vercel credentials to edit or test the app.

## Future updates

The local folder is linked to the production Vercel project. After editing and testing, run from C:\Saksham Website:

```powershell
npm test
npm run build
npx --yes vercel@latest deploy --prod
```

The same production URL will serve the new deployment. After GitHub is connected, pushes to the configured production branch can publish automatically. Use the stable production domain for academic submission.

## Custom domain

Open the project's Settings → Domains, add a domain you own, and apply the exact DNS records Vercel provides at your registrar. HTTPS follows domain verification. No domain purchase is needed for the current public URL.
