import { findAll, findByProps } from "@vendetta/metro";
import { before, instead } from "@vendetta/patcher";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const unpatches: (() => boolean)[] = [];

// Deep extractor that finds URLs regardless of how Discord passes them (string, object, or JSON)
function extractUrl(args: any[]): string | null {
    if (!args || !args.length) return null;
    for (const arg of args) {
        if (typeof arg === "string" && /^https?:\/\//i.test(arg)) {
            return arg;
        }
        if (arg && typeof arg === "object") {
            if (typeof arg.url === "string" && /^https?:\/\//i.test(arg.url)) return arg.url;
            if (typeof arg.href === "string" && /^https?:\/\//i.test(arg.href)) return arg.href;
            if (typeof arg.link === "string" && /^https?:\/\//i.test(arg.link)) return arg.link;
            try {
                const str = JSON.stringify(arg);
                const match = str.match(/https?:\/\/[^"\s\\]+/i);
                if (match) return match[0];
            } catch {}
        }
    }
    return null;
}

function copyUrl(url: string) {
    clipboard.setString(url);
    showToast("Link copied to clipboard!", getAssetIDByName("toast_copy_link"));
}

export default {
    onLoad: () => {
        showToast("CopyLinkButton Active!", getAssetIDByName("ic_message_copy"));

        // 1. Intercept all Discord JS URL & Deeplink handlers
        const targetProps = ["openURL", "openUrl", "openDeeplink", "openDeepLink", "handleClick", "handleOpenURL"];
        const urlModules = findAll((m: any) => m && targetProps.some(p => typeof m[p] === "function"));

        for (const mod of urlModules) {
            for (const prop of targetProps) {
                if (typeof mod[prop] === "function") {
                    unpatches.push(
                        before(prop, mod, (args) => {
                            const url = extractUrl(args);
                            if (url) copyUrl(url);
                        })
                    );
                }
            }
        }

        // 2. Intercept Discord's Alert/Modal system (catches the "Leaving Discord" dialog instantly)
        const alertProps = ["openAlert", "openModal", "openLazy", "pushModal"];
        const alertModules = findAll((m: any) => m && alertProps.some(p => typeof m[p] === "function"));

        for (const mod of alertModules) {
            for (const prop of alertProps) {
                if (typeof mod[prop] === "function") {
                    unpatches.push(
                        before(prop, mod, (args) => {
                            const url = extractUrl(args);
                            if (url) copyUrl(url);
                        })
                    );
                }
            }
        }

        // 3. Block Native Browser Modules (Chrome Custom Tabs & Linking)
        const NativeModules = findByProps("NativeModules")?.NativeModules || {};
        const nativeCandidates = [
            NativeModules.DCDInAppBrowser,
            NativeModules.InAppBrowser,
            NativeModules.CustomTabsAndroid,
            NativeModules.CustomTabs,
            NativeModules.LinkingManager
        ].filter(Boolean);

        for (const nMod of nativeCandidates) {
            const methods = ["open", "openURL", "openUrl"];
            for (const method of methods) {
                if (typeof nMod[method] === "function") {
                    unpatches.push(
                        instead(method, nMod, (args, orig) => {
                            const url = extractUrl(args);
                            if (url) {
                                copyUrl(url);
                                // Intentionally do NOT call orig() -> blocks browser completely
                            } else {
                                return orig(...args);
                            }
                        })
                    );
                }
            }
        }
    },

    onUnload: () => {
        for (const unpatch of unpatches) {
            try {
                unpatch();
            } catch {}
        }
    }
};
