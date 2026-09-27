# ACDC for iOS

The signed iPhone package will be placed here as `ACDC.ipa` after the native project is built and exported with Xcode signing. An unsigned file is intentionally not included because iPhones cannot install it.

The shared application source is in `../mobile/src`, and the generated native Xcode project is in `../mobile/ios`.

## No-cost development

- Xcode and the project's application artwork and software dependencies are free.
- A free Apple Account can sign and install ACDC on the account owner's connected iPhone through Xcode for personal testing.
- Apple calls this a **Personal Team**. Its development provisioning expires after 7 days, so the app must be rebuilt and reinstalled periodically.
- A reusable IPA for friends, TestFlight, or App Store distribution requires membership in the Apple Developer Program. The source code does not need to be rewritten when that membership is added later.

## Current build requirement

Install the full Xcode application from the Mac App Store, open `../mobile/ios/App/App.xcodeproj`, add an Apple Account under Xcode settings, select its Personal Team under **Signing & Capabilities**, connect the iPhone, and run the `App` scheme. The native project is ready, but this Mac currently has only the Command Line Tools and therefore cannot compile or sign the iOS application yet.
