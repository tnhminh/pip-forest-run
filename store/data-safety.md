# Privacy forms: answers for this build

These answers match the code in this repo (AdMob + RevenueCat, no own backend, no analytics SDK). Re-check them if you add Firebase or any other SDK.

## Google Play: Data safety

**Does your app collect or share any of the required user data types?** Yes (through the AdMob and RevenueCat SDKs).

**Is all of the user data collected by your app encrypted in transit?** Yes.

**Do you provide a way for users to request that their data is deleted?** Yes. Progress is device-only (Settings → Reset progress, or uninstall). For SDK data, the privacy policy links to Google and RevenueCat.

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Device or other IDs (Advertising ID) | Yes | Yes (Google AdMob) | Advertising or marketing, Fraud prevention | Ads personalisation can be refused through the consent form |
| App interactions (ad views/clicks) | Yes | Yes (Google AdMob) | Advertising, Analytics | No |
| Diagnostics (crash logs, performance from the ad SDK) | Yes | Yes (Google AdMob) | Analytics | No |
| Purchase history | Yes | No (RevenueCat acts as a service provider) | App functionality | Only if the user buys something |
| Approximate location (derived from IP by the ad SDK) | Yes | Yes (Google AdMob) | Advertising | No |

Not collected: name, email, phone, contacts, photos, precise location, messages, health, financial info (payments are handled by Google Play).

## Google Play: other declarations

- **Ads**: Yes, the app contains ads.
- **Advertising ID**: Yes, used for advertising (AdMob). The AD_ID permission is merged from the Google Mobile Ads SDK.
- **Target audience**: 13–15, 16–17, 18+. **Do not tick under 13**, otherwise the Families policy applies and the ad setup must change (`tagForChildDirectedTreatment`, Families-certified ad SDK only).
- **Content rating (IARC questionnaire)**: Category "Game". Violence: none (cartoon character falls over, no injury). Fear: no. Sexuality, language, drugs, gambling: no. User interaction / chat: no. Shares location: no. In-app purchases: yes. Expected rating: Everyone / PEGI 3 / ESRB E.
- **Government app / News app / COVID / Financial features**: No.
- **App access**: All features are available without login.

## Apple App Store: App Privacy ("nutrition label")

Data Used to Track You:
- Identifiers → Device ID (only if the user allows tracking in the ATT prompt; used by AdMob)

Data Linked to You: none.

Data Not Linked to You:
- Purchases → Purchase History (RevenueCat, App Functionality)
- Identifiers → Device ID (AdMob, Third-Party Advertising)
- Usage Data → Advertising Data, Product Interaction (AdMob)
- Diagnostics → Crash Data, Performance Data (AdMob)
- Location → Coarse Location (AdMob, Third-Party Advertising)

Also on iOS:
- Add `NSUserTrackingUsageDescription` to `ios/App/App/Info.plist`: "Allow tracking to see ads that are more relevant to you. Pip's Forest Run stays free thanks to ads."
- Add `GADApplicationIdentifier` (your iOS AdMob app ID) and the `SKAdNetworkItems` list from Google's AdMob iOS guide.
- Age rating: 4+. "Unrestricted web access": No. "Gambling": No. In-app purchases: Yes.
