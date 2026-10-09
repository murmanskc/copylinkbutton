import { find, findAll, findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const unpatches: (() => boolean)[] = [];

export default {
    onLoad: () => {
        // 1. Visual confirmation that the plugin is running
        showToast("CopyLinkButton Active!", getAssetIDByName("ic_message_copy"));

        // 2. Resolve React Native's Alert dialog
        const RNAlert = find((m: any) => m && typeof m.alert === "function" && typeof m.prompt === "function");

        const handleUrl = (targetUrl: string, orig: Function, args: any[]) => {
            if (!targetUrl || typeof targetUrl !== "string") {
                return orig(...args);
            }

            // Immediately copy to clipboard as guaranteed fallback
            clipboard.setString(targetUrl);
            showToast("Copied link to clipboard!", getAssetIDByName("toast_copy_link"));

            // Prompt user if they still want to open it
            if (RNAlert && typeof RNAlert.alert === "function") {
                RNAlert.alert(
                    "Link Copied!",
                    targetUrl,
                    [
                        {
                            text: "Open in Browser",
                            onPress: () => orig(...args)
                        },
                        {
                            text: "Done",
                            style: "cancel"
                        }
                    ]
                );
            }
        };

        // 3. Hook all JavaScript modules that open URLs
        const urlModules = findAll((m: any) => m && (typeof m.openURL === "function" || typeof m.openDeeplink === "function"));

        for (const mod of urlModules) {
            const func = typeof mod.openURL === "function" ? "openURL" : "openDeeplink";
            unpatches.push(
                instead(func, mod, (args, orig) => {
                    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
                    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                        handleUrl(url, orig, args);
                    } else {
                        return orig(...args);
                    }
                })
            );
        }

        // 4. Hook NativeModules (blocks Chrome Custom Tabs & native browser)
        const NativeModules = findByProps("NativeModules")?.NativeModules || {};
        const nativeMods = [
            NativeModules.DCDInAppBrowser,
            NativeModules.InAppBrowser,
            NativeModules.CustomTabsAndroid,
            NativeModules.LinkingManager
        ].filter(Boolean);

        for (const nMod of nativeMods) {
            const func = nMod.open ? "open" : nMod.openURL ? "openURL" : null;
            if (func && typeof nMod[func] === "function") {
                unpatches.push(
                    instead(func, nMod, (args, orig) => {
                        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
                        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                            handleUrl(url, orig, args);
                        } else {
                            return orig(...args);
                        }
                    })
                );
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
