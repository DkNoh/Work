import { createLibraryConfig } from "../../../scripts/library-config.mjs";

export default createLibraryConfig(import.meta.url, { vueComponents: true, ui: true });
