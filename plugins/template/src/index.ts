import { findByProps, findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

const unpatches: (() => boolean)[] = [];

export default {
    onLoad: () => {
        const ComponentButton = findByName("ComponentButton") || findByProps("ActionComponent");

        if (ComponentButton) {
            unpatches.push(
                after("default", ComponentButton, (args, res) => {
                    const props = args[0];
                    const url = props?.component?.url || props?.url;

                    if (url && res?.props) {
                        const originalOnLongPress = res.props.onLongPress;

                        res.props.onLongPress = (event: any) => {
                            clipboard.setString(url);
                            showToast("Copied link to clipboard!", getAssetIDByName("toast_copy_link"));
                            if (originalOnLongPress) originalOnLongPress(event);
                        };
                    }

                    return res;
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
