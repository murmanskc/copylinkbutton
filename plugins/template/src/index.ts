import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const unpatches: (() => boolean)[] = [];

// Helper to recursively find all link buttons in a message's components
function extractButtonLinks(components: any[]): { label: string; url: string }[] {
    const links: { label: string; url: string }[] = [];
    if (!Array.isArray(components)) return links;

    for (const row of components) {
        const subComponents = row.components || [row];
        for (const comp of subComponents) {
            if (comp.url && typeof comp.url === "string") {
                links.push({
                    label: comp.label || "Link",
                    url: comp.url
                });
            }
        }
    }
    return links;
}

export default {
    onLoad: () => {
        // Module responsible for building the message context menu / action sheet
        const ActionSheetMod =
            findByProps("useMessageActions") ||
            findByProps("getMessageActions") ||
            findByProps("renderMessageActionSheet");

        // UI components for ActionSheet rows
        const ActionSheet = findByProps("ActionSheetRow", "ActionSheet");
        const ActionSheetRow = ActionSheet?.ActionSheetRow;

        if (ActionSheetMod) {
            // Find the action generator function
            const targetFunc = ActionSheetMod.useMessageActions
                ? "useMessageActions"
                : ActionSheetMod.getMessageActions
                ? "getMessageActions"
                : "default";

            unpatches.push(
                after(targetFunc, ActionSheetMod, (args, res) => {
                    const message = args[0]?.message || args[0];
                    if (!message?.components || message.components.length === 0) return res;

                    const buttonLinks = extractButtonLinks(message.components);
                    if (buttonLinks.length === 0) return res;

                    // If res is an array of action sheet items/components
                    if (Array.isArray(res)) {
                        for (const btn of buttonLinks) {
                            res.push({
                                text: `Copy Link: ${btn.label}`,
                                icon: getAssetIDByName("ic_message_copy") || getAssetIDByName("copy"),
                                onPress: () => {
                                    clipboard.setString(btn.url);
                                    showToast(`Copied "${btn.label}" link!`, getAssetIDByName("toast_copy_link"));
                                }
                            });
                        }
                    } else if (res?.props?.children && ActionSheetRow) {
                        // React tree structure fallback
                        const children = Array.isArray(res.props.children)
                            ? res.props.children
                            : [res.props.children];

                        for (const btn of buttonLinks) {
                            children.push(
                                ActionSheetRow({
                                    label: `Copy Link: ${btn.label}`,
                                    icon: getAssetIDByName("ic_message_copy"),
                                    onPress: () => {
                                        clipboard.setString(btn.url);
                                        showToast(`Copied "${btn.label}" link!`, getAssetIDByName("toast_copy_link"));
                                    }
                                })
                            );
                        }
                    }

                    return res;
                })
            );
        }

        // Secondary fallback: Intercept in-app browser modules directly
        const InAppBrowser =
            findByProps("openInAppBrowser") ||
            findByProps("openBrowser") ||
            findByProps("openURLWithInAppBrowser");

        if (InAppBrowser) {
            const funcName = InAppBrowser.openInAppBrowser
                ? "openInAppBrowser"
                : InAppBrowser.openBrowser
                ? "openBrowser"
                : "openURLWithInAppBrowser";

            unpatches.push(
                after(funcName, InAppBrowser, (args) => {
                    const rawUrl = args[0];
                    if (rawUrl && typeof rawUrl === "string") {
                        clipboard.setString(rawUrl);
                        showToast("Link automatically copied to clipboard!", getAssetIDByName("toast_copy_link"));
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
