# CockpitPro premium website preview

This development branch redesigns the existing marketing homepage in the charcoal and red visual language of CockpitPro Toolbox. It retains the COCKPITPRO wordmark, the existing domain, application offering and ADB Studio routes.

The owner requested and supplied the following commercial copy: 500 ILS once for life, free reinstallation after accidental deletion, four years of experience and more than 100 installations. The owner confirmed 050-653-0471 as the contact number. Driver settings are described only for Chery, Omoda and Jaecoo, subject to model support. ADBAUTH pricing, updated at the owner’s request, is $20 for one key, $180 for ten keys and $300 for twenty keys.

## Reviewed video library

All eight USB videos supplied by the owner on 2026-11-17 have been reviewed, copied into the site's gallery, fully decoded and remuxed with fast-start metadata. Encoded audio and video stream hashes match the originals: no re-encoding, scaling, cropping or frame-rate conversion was applied to the videos. The original source files remain untouched.

| Supplied file | Visible content | Gallery grouping |
| --- | --- | --- |
| VID-20261007-WA0003.mp4 | CHERY steering-wheel branding; navigation beside video on the main screen. | Chery / split-screen |
| VID-20261008-WA0017.mp4 | Chery interior at night; map on the instrument cluster and video on the main display. | Chery / cluster navigation |
| VID-20261011-WA0107.mp4 | CHERY branding; main-display video and a later view of navigation on the instrument cluster. | Chery / two displays |
| VID-20261012-WA0033.mp4 | CHERY branding; application grid, touch interaction and video visible on both displays. | Chery / display controls |
| VID-20261107-WA0035.mp4 | Mostly dark night footage; the vehicle display becomes visible near the end. No reliable make/model or application identification. | Additional footage; playback starts at 18.7 s and the complete recording remains available in the player. |
| VID-20261108-WA0006.mp4 | Touch-controlled TV interface, browsing and changing content. Its AIWAYS U5 association is inferred by matching the visibly identical installation in the next edited film. | AIWAYS U5 / TV demonstration |
| VID-20261108-WA0043.mp4 | The same TV interface in an owner-edited CockpitPro film explicitly labelled AIWAYS U5. | AIWAYS U5 / CockpitPro TV |
| VID-20261115-WA0031.mp4 | Owner-edited AIWAYS U5 walkthrough: application grid, navigation and music, CockpitPro TV and video. | AIWAYS U5 / package overview |

The exact Chery model and trim are not asserted. An app icon is not treated as proof that every capability works on every vehicle. The supplied VOYAH advertisement is retained and labelled as a brand film, alongside the two older installation examples already in the repository. The complete gallery contains eleven clips.

The best visible source moments were selected for poster frames. The selectable hero demonstration now opens the real Chery navigation/video example while retaining the owner's OMODA background illustration. The decorative `amazing.mp4` animation remains untouched and is not used as installation proof.

## Preview and validation

Serve this directory using a local static server. The homepage uses only relative asset and navigation paths, so it supports the existing domain and the repository's GitHub Pages path. No Node dependencies or build step are required.

The gallery loads video data only after a user chooses a clip. Native controls preserve each clip's aspect ratio. Poster images are lazy-loaded in the gallery; the hero image is compressed from the supplied original and preloaded. The original user image is retained outside the deployment assets. The contact form composes a WhatsApp message with the vehicle's brand, model, year and city; it does not transmit or store leads on a new server.

Local Chrome QA covers viewport widths 320, 390, 768, 1024 and 1440; all eleven videos actually decode and advance; the filters; dialog cleanup; correct driver-settings brand logic; WhatsApp message content with navigation intercepted; missing assets; and existing ADB Studio links. No WhatsApp message was sent during testing.

Only the marketing homepage and `assets/premium/` are changed, plus this documentation. Authentication, credit accounting, the ADB Studio application, provider processes and customer pages are retained from the repository's current main branch. The owner has requested publication to the existing custom domain after validation; the development work remains isolated on the feature branch until merge.
