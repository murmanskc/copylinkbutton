import { findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";
import { clipboard, url as urlUtil } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const unpatches: (() => boolean)[] = [];

export default {
    onLoad: () => {
        // Resolve Discord's URL handler and native Alert module
        const urlModule = urlUtil || findByProps("openURL");
        const alertModule = findByProps("alert");
        const Alert = alertModule?.Alert || alertModule;

        if (urlModule && urlModule.openURL) {
            unpatches.push(
                instead("openURL", urlModule, (args, orig) => {
                    const targetUrl = args[0];

                    if (!targetUrl || typeof targetUrl !== "string") {
                        return orig(...args);
                    }

                    // If Alert dialog is available, prompt with Copy / Open
                    if (Alert && Alert.alert) {
                        Alert.alert(
                            "Link Action",
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
                                    text: "Open",
                                    onPress: () => orig(...args)
                                },
                                {
                                    text: "Cancel",
                                    style: "cancel"
                                }
                            ]
                        );
                    } else {
                        // Fallback: copy directly and show toast
                        clipboard.setString(targetUrl);
                        showToast("Link copied to clipboard!", getAssetIDByName("toast_copy_link"));
                    }
                })
            );
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
