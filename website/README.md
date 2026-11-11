# Clove website

Clove's landing page lives in `website/` within
[aniiiiXD/sovaaaaaa](https://github.com/aniiiiXD/sovaaaaaa).
It retains Sova's owl mark, paper palette, dojo artwork, and typography.

## Deployment target

| Setting | Value |
| --- | --- |
| Vercel team | `aniiiixds-projects` |
| Vercel project | `clove-landing` |
| Project ID | `prj_lZWCPdytkjBHPUghppxsGnh9R944` |
| GitHub repository | `aniiiiXD/sovaaaaaa` |
| Production branch | `main` |
| Root directory | `website` |
| Canonical URL | `https://www.cloveos.com` |

Run deployment commands from the repository root after explicitly linking it
to this existing project. Verify the selected project before each deployment.
The original Sova checkout has a separate `sova-native` link inside `website/`;
that link is not the Clove landing deployment target.

The old `aniiiiXD/Clove` repository is retained as it is.

## Contact and product services

The contact form uses `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and optional
`CONTACT_FROM_EMAIL`. It also accepts the existing Clove project's
`NOTIFICATION_EMAIL` as the recipient when `CONTACT_TO_EMAIL` is absent.
Set `NEXT_PUBLIC_CONTACT_EMAIL` to display a public email address.

API examples retain the existing `sova-native.vercel.app` endpoint, model IDs,
and key format. The landing rebrand does not migrate the API or portal's
database, authentication, or AWS access. Configure and verify those services
separately before relying on them in `clove-landing`.

## Compute policy

Builds and deployments run on Vercel. Each run requires explicit approval after
showing its exact command, machine, estimated duration and cost, and output.
Local builds or smoke tests also require approval before running. This landing
change requires no model training, GPU instance, or dedicated serving resources.
Tear down any temporary compute allocated for an approved run when it finishes.
