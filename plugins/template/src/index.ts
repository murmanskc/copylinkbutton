import { findByProps, findByPropsAll } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const unpatches: (() => boolean)[] = [];

export default {
    onLoad: () => {
        // 1. Resolve React Native's core Alert module
        const RNAlert = findByProps("alert", "prompt");

        const showLinkOptions = (targetUrl: string, openCallback: () => void) => {
            if (RNAlert && typeof RNAlert.alert === "function") {
                RNAlert.alert(
                    "Link Options",
                    targetUrl,
                    [
                        {
                            text: "Copy Link",
                            onPress: () => {
                                clipboard.setString(targetUrl);
                                showToast("Link copied to clipboard!", getAssetIDByName("toast_copy_link"));
                            }
                        },
                        {
                            text: "Open in Browser",
                            onPress: () => openCallback()
                        },
                        {
                            text: "Cancel",
                            style: "cancel"
                        }
                    ]
                );
            } else {
                // Fallback: Copy directly and prevent browser
                clipboard.setString(targetUrl);
                showToast("Link copied to clipboard!", getAssetIDByName("toast_copy_link"));
            }
        };

        // 2. Intercept EVERY module in Discord that has openURL or openDeeplink
        const urlModules = [
            ...(findByPropsAll("openURL") || []),
            ...(findByPropsAll("openDeeplink") || [])
        ];
        const uniqueModules = [...new Set(urlModules)];

        for (const mod of uniqueModules) {
            if (typeof mod?.openURL === "function") {
                unpatches.push(
                    instead("openURL", mod, (args, orig) => {
                        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
                        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                            showLinkOptions(url, () => orig(...args));
                        } else {
                            return orig(...args);
                        }
                    })
                );
            }
        }

        // 3. Intercept NativeModules (this is what stops the in-app browser!)
        const NativeModules = findByProps("NativeModules")?.NativeModules || {};
        const nativeBrowserModules = [
            NativeModules.DCDInAppBrowser,
            NativeModules.InAppBrowser,
            NativeModules.RNInAppBrowser,
            NativeModules.CustomTabsAndroid,
            NativeModules.CustomTabs,
            NativeModules.LinkingManager
        ].filter(Boolean);

        for (const nativeMod of nativeBrowserModules) {
            const funcName = nativeMod.open ? "open" : nativeMod.openURL ? "openURL" : null;
            if (funcName && typeof nativeMod[funcName] === "function") {
                unpatches.push(
                    instead(funcName, nativeMod, (args, orig) => {
                        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
                        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                            showLinkOptions(url, () => orig(...args));
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
