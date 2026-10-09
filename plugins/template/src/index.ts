import { findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const unpatches: (() => boolean)[] = [];

export default {
    onLoad: () => {
        // 1. Module that handles "Visit Site" (React Native Linking)
        const Linking = findByProps("openURL", "canOpenURL");

        // 2. Module that handles Discord's internal link routing
        const DiscordURL = findByProps("openDeeplink") || findByProps("openURL");

        // 3. React Native native Alert dialog
        const alertModule = findByProps("alert");
        const Alert = alertModule?.alert ? alertModule : null;

        const handleIntercept = (targetUrl: string, orig: Function, args: any[]) => {
            if (!targetUrl || typeof targetUrl !== "string") {
                return orig(...args);
            }

            if (Alert) {
                Alert.alert(
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
                            onPress: () => orig(...args)
                        },
                        {
                            text: "Cancel",
                            style: "cancel"
                        }
                    ]
                );
            } else {
                // If Alert is unavailable, copy directly and prevent browser from opening
                clipboard.setString(targetUrl);
                showToast("Link copied to clipboard!", getAssetIDByName("toast_copy_link"));
            }
        };

        // Patch Linking (triggers when you tap "Visit Site")
        if (Linking && Linking.openURL) {
            unpatches.push(
                instead("openURL", Linking, (args, orig) => {
                    handleIntercept(args[0], orig, args);
                })
            );
        }

        // Patch Discord's internal router
        if (DiscordURL && DiscordURL.openURL && DiscordURL !== Linking) {
            unpatches.push(
                instead("openURL", DiscordURL, (args, orig) => {
                    handleIntercept(args[0], orig, args);
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
