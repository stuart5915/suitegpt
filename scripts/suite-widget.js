// SUITE Widget for Scriptable
// Displays your tasks and groceries on your iPhone home screen
//
// SETUP:
// 1. Install Scriptable from the App Store
// 2. Create a new script and paste this code
// 3. Run once to configure your Telegram ID
// 4. Add widget to home screen (long press > Edit Home Screen > + > Scriptable)
// 5. Select this script when configuring the widget

const SUPABASE_URL = "https://rdsmdywbdiskxknluiym.supabase.co";
const API_ENDPOINT = SUPABASE_URL + "/functions/v1/widget-get-lists";
const TOGGLE_ENDPOINT = SUPABASE_URL + "/functions/v1/widget-toggle-item";

// =============================================
// CONFIGURATION
// =============================================
const CONFIG_KEY = "suite_widget_config";

async function getConfig() {
    const stored = Keychain.contains(CONFIG_KEY) ? Keychain.get(CONFIG_KEY) : null;
    return stored ? JSON.parse(stored) : null;
}

async function saveConfig(config) {
    Keychain.set(CONFIG_KEY, JSON.stringify(config));
}

async function setupWidget() {
    const alert = new Alert();
    alert.title = "SUITE Widget Setup";
    alert.message = "Enter your Telegram ID to connect your lists.\n\nYou can find this at getsuite.app/profile";
    alert.addTextField("Telegram ID", "");
    alert.addAction("Save");
    alert.addCancelAction("Cancel");

    const result = await alert.present();
    if (result === -1) return null;

    const telegramId = alert.textFieldValue(0);
    if (!telegramId) {
        const errorAlert = new Alert();
        errorAlert.title = "Error";
        errorAlert.message = "Please enter a valid Telegram ID";
        errorAlert.addAction("OK");
        await errorAlert.present();
        return null;
    }

    const config = { telegram_id: telegramId };
    await saveConfig(config);
    return config;
}

// =============================================
// DATA FETCHING
// =============================================
async function fetchLists(telegramId) {
    try {
        const req = new Request(API_ENDPOINT);
        req.method = "POST";
        req.headers = { "Content-Type": "application/json" };
        req.body = JSON.stringify({ telegram_id: telegramId });

        const response = await req.loadJSON();

        if (response.error) {
            console.error("API Error:", response.error);
            return null;
        }

        return response.lists || [];
    } catch (e) {
        console.error("Fetch error:", e);
        return null;
    }
}

async function toggleItem(itemId, telegramId) {
    try {
        const req = new Request(TOGGLE_ENDPOINT);
        req.method = "POST";
        req.headers = { "Content-Type": "application/json" };
        req.body = JSON.stringify({
            item_id: itemId,
            action: "toggle",
            telegram_id: telegramId
        });

        const response = await req.loadJSON();
        return response.success;
    } catch (e) {
        console.error("Toggle error:", e);
        return false;
    }
}

// =============================================
// WIDGET BUILDING
// =============================================
function createWidget(lists, widgetFamily) {
    const widget = new ListWidget();

    // Background gradient
    const gradient = new LinearGradient();
    gradient.locations = [0, 1];
    gradient.colors = [
        new Color("#1a1a2e"),
        new Color("#16213e")
    ];
    widget.backgroundGradient = gradient;

    // Padding
    widget.setPadding(16, 16, 16, 16);

    // Header
    const header = widget.addStack();
    header.layoutHorizontally();
    header.centerAlignContent();

    const logo = header.addText("SUITE");
    logo.font = Font.boldSystemFont(14);
    logo.textColor = new Color("#ff9500");

    header.addSpacer();

    const refreshIcon = header.addText("⟳");
    refreshIcon.font = Font.systemFont(12);
    refreshIcon.textColor = new Color("#888");

    widget.addSpacer(8);

    if (!lists || lists.length === 0) {
        const emptyText = widget.addText("No lists yet");
        emptyText.font = Font.systemFont(14);
        emptyText.textColor = new Color("#888");
        emptyText.centerAlignText();
        return widget;
    }

    // Determine layout based on widget size
    const isSmall = widgetFamily === "small";
    const isMedium = widgetFamily === "medium";
    const isLarge = widgetFamily === "large";

    // Find tasks and groceries lists
    const tasksList = lists.find(l => l.type === "tasks");
    const groceriesList = lists.find(l => l.type === "groceries");

    if (isSmall) {
        // Small widget: show one list
        const primaryList = tasksList || groceriesList || lists[0];
        addListSection(widget, primaryList, 4);
    } else if (isMedium) {
        // Medium widget: show both lists side by side
        const row = widget.addStack();
        row.layoutHorizontally();

        if (tasksList) {
            const tasksCol = row.addStack();
            tasksCol.layoutVertically();
            addListSection(tasksCol, tasksList, 3);
        }

        if (tasksList && groceriesList) {
            row.addSpacer(16);
        }

        if (groceriesList) {
            const groceriesCol = row.addStack();
            groceriesCol.layoutVertically();
            addListSection(groceriesCol, groceriesList, 3);
        }
    } else {
        // Large widget: show more items
        if (tasksList) {
            addListSection(widget, tasksList, 5);
            widget.addSpacer(12);
        }

        if (groceriesList) {
            addListSection(widget, groceriesList, 5);
        }
    }

    return widget;
}

function addListSection(container, list, maxItems) {
    // List header
    const headerStack = container.addStack();
    headerStack.layoutHorizontally();
    headerStack.centerAlignContent();

    const icon = headerStack.addText(list.icon || "📝");
    icon.font = Font.systemFont(12);

    headerStack.addSpacer(4);

    const title = headerStack.addText(list.name);
    title.font = Font.semiboldSystemFont(12);
    title.textColor = Color.white();

    headerStack.addSpacer();

    // Show count of incomplete items
    const incompleteCount = list.items.filter(i => !i.is_completed).length;
    if (incompleteCount > 0) {
        const badge = headerStack.addText(incompleteCount.toString());
        badge.font = Font.boldSystemFont(10);
        badge.textColor = new Color("#ff9500");
    }

    container.addSpacer(6);

    // Items (show incomplete first)
    const sortedItems = [...list.items].sort((a, b) => {
        if (a.is_completed === b.is_completed) return 0;
        return a.is_completed ? 1 : -1;
    });

    const itemsToShow = sortedItems.slice(0, maxItems);

    for (const item of itemsToShow) {
        addItemRow(container, item);
        container.addSpacer(3);
    }

    // Show "and X more" if there are more items
    const remaining = list.items.length - itemsToShow.length;
    if (remaining > 0) {
        const moreText = container.addText(`+${remaining} more`);
        moreText.font = Font.italicSystemFont(10);
        moreText.textColor = new Color("#666");
    }
}

function addItemRow(container, item) {
    const row = container.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();

    // Checkbox
    const checkbox = row.addText(item.is_completed ? "☑" : "☐");
    checkbox.font = Font.systemFont(12);
    checkbox.textColor = item.is_completed ? new Color("#4caf50") : new Color("#888");

    row.addSpacer(6);

    // Item text
    const text = row.addText(item.content);
    text.font = Font.systemFont(11);
    text.textColor = item.is_completed ? new Color("#666") : Color.white();
    text.lineLimit = 1;

    // Shared indicator
    if (item.shared_by) {
        row.addSpacer(4);
        const sharedIcon = row.addText("👥");
        sharedIcon.font = Font.systemFont(8);
    }
}

// =============================================
// MAIN
// =============================================
async function main() {
    // Get or setup config
    let config = await getConfig();

    if (!config) {
        // Running in app - show setup
        config = await setupWidget();
        if (!config) {
            Script.complete();
            return;
        }
    }

    // Check for URL scheme action (tapping on widget)
    const args = args || {};
    if (args.queryParameters && args.queryParameters.action === "toggle") {
        const itemId = args.queryParameters.item_id;
        if (itemId) {
            await toggleItem(itemId, config.telegram_id);
        }
    }

    // Fetch lists
    const lists = await fetchLists(config.telegram_id);

    // Determine widget family
    let widgetFamily = "medium";
    if (config.widgetFamily) {
        widgetFamily = config.widgetFamily;
    } else if (args && args.widgetParameter) {
        widgetFamily = args.widgetParameter;
    }

    // Create widget
    const widget = createWidget(lists, widgetFamily);

    // Set refresh interval (every 15 minutes)
    widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

    // Set widget URL for opening the app
    widget.url = "https://getsuite.app/lists";

    // Display
    if (config.widgetFamily) {
        Script.setWidget(widget);
    } else {
        // Preview in app
        if (widgetFamily === "small") {
            widget.presentSmall();
        } else if (widgetFamily === "large") {
            widget.presentLarge();
        } else {
            widget.presentMedium();
        }
    }

    Script.complete();
}

// Run
await main();
