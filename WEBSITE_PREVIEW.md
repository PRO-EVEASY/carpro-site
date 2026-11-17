# CockpitPro premium website preview

This development branch redesigns the existing marketing homepage in the charcoal and red visual language of CockpitPro Toolbox. It retains the COCKPITPRO wordmark, the existing domain, application offering and ADB Studio routes.

The owner requested and supplied the following commercial copy: 500 ILS once for life, free reinstallation after accidental deletion, four years of experience and more than 100 installations. The owner confirmed 050-653-0471 as the contact number. Driver settings are described only for Chery, Omoda and Jaecoo, subject to model support. ADBAUTH pricing remains $20 for one key and $50 for ten keys.

## Media included so far

| Source | What is visible | Use |
| --- | --- | --- |
| `eveasynew.mp4`, existing site, 17.23 s | An in-car application grid and the business's contact overlay. The exact vehicle model is not established by the footage. | Application gallery and selectable hero video. |
| `eveasy.mp4`, existing site, 23.68 s | An in-car home interface with gauge styling and the business's contact overlay. The exact vehicle model is not established by the footage. | Home interface gallery. |
| Owner VOYAH brand film, 3.20 s | CockpitPro / VOYAH branding, a white MPV, an app-installation promotion and the 500 ILS price. No operating software is demonstrated. | Clearly labelled brand advertisement, remuxed with fast-start metadata while preserving the video and audio streams. |
| `amazing.mp4`, existing site, 2.08 s | A fictional sports-car animation. | Retained original file; excluded from installation evidence. |

The owner requested analysis of ten newly attached videos. Only one new local video was available during preparation. The shared ChatGPT Library URL required sign-in in the available browser. The remaining nine new videos still need accessible files or download links before this part of the request can be completed. The preview does not claim that all ten have been reviewed.

## Preview and validation

Serve this directory using a local static server. The homepage uses only relative asset and navigation paths, so it supports the existing domain and the repository's GitHub Pages path. No Node dependencies or build step are required.

The gallery loads video data only after a user chooses a clip. Native controls preserve each clip's aspect ratio. Poster images are lazy-loaded in the gallery; the hero image is compressed from the supplied original and preloaded. The original user image is retained outside the deployment assets. The contact form composes a WhatsApp message with the vehicle's brand, model, year and city; it does not transmit or store leads on a new server.

Local Chrome QA covers viewport widths 320, 390, 768, 1024 and 1440; all three videos actually decode and advance; the filters; dialog cleanup; correct driver-settings brand logic; WhatsApp message content with navigation intercepted; missing assets; and existing ADB Studio links. No WhatsApp message was sent during testing.

Only the marketing homepage and `assets/premium/` are changed, plus this documentation. Authentication, credit accounting, the ADB Studio application, provider processes and customer pages are retained from the repository's current main branch. No production deployment has been performed.
