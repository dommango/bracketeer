// Single source of truth for the app version shown in the footer + release
// notes. Sourced from package.json so a release is just a version bump — the UI
// updates itself. Import only from SERVER components: pulling package.json into
// a client bundle would ship the whole manifest to the browser.
import pkg from "@/package.json";

export const APP_VERSION: string = pkg.version;
