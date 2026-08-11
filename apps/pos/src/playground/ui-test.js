import {

    Button, Input, Select, Textarea,
    Checkbox, Switch, Alert, Toast,
    Modal, Badge, Avatar,
    Table, Pagination, EmptyState, Skeleton,
    Tabs, Dropdown, Breadcrumb,
    Container, Stack, Divider

} from "@smart/ui/components";


const app =
    document.getElementById("app");


app.style.padding = "24px";
app.style.display = "flex";
app.style.flexDirection = "column";
app.style.gap = "24px";


// ──────────────────────────────────────────────
// Section: Form Inputs (Phase 2A)
// ──────────────────────────────────────────────

const formSection =
    document.createElement("h2");


formSection.innerText =
    "Form Inputs";

formSection.style.fontFamily = "Inter, sans-serif";

app.appendChild(formSection);


// Input
app.appendChild(
    Input({
        label: "Username",
        placeholder: "Enter username",
        onChange: (e) =>
            console.log("Input:", e.target.value)
    })
);


// Select
app.appendChild(
    Select({
        label: "Role",
        placeholder: "Choose role",
        options: [
            { value: "admin", label: "Administrator" },
            { value: "operator", label: "Operator" },
            { value: "viewer", label: "Viewer" }
        ],
        onChange: (e) =>
            console.log("Select:", e.target.value)
    })
);


// Textarea
app.appendChild(
    Textarea({
        label: "Description",
        placeholder: "Write description here...",
        rows: 3
    })
);


// Checkbox + Switch row
const row =
    document.createElement("div");


row.style.display = "flex";
row.style.gap = "32px";
row.style.alignItems = "center";


row.appendChild(
    Checkbox({
        label: "Agree to terms",
        onChange: (e) =>
            console.log("Checkbox:", e.target.checked)
    })
);


row.appendChild(
    Switch({
        label: "Enable notifications",
        onChange: (e) =>
            console.log("Switch:", e.target.checked)
    })
);


app.appendChild(row);


// ──────────────────────────────────────────────
// Section: Data Components (Phase 2B)
// ──────────────────────────────────────────────

const dataSection =
    document.createElement("h2");


dataSection.innerText =
    "Data Components";

dataSection.style.fontFamily = "Inter, sans-serif";
dataSection.style.marginTop = "16px";

app.appendChild(dataSection);


// Table
app.appendChild(
    Table({
        columns: [
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "email", label: "Email" },
            {
                key: "status",
                label: "Status",
                render: (val) =>
                    val === "active"
                        ? "<span style='color:#16a34a'>● Active</span>"
                        : "<span style='color:#dc2626'>● Inactive</span>"
            }
        ],
        rows: [
            { name: "Alice Johnson", role: "Admin", email: "alice@test.com", status: "active" },
            { name: "Bob Smith", role: "Editor", email: "bob@test.com", status: "active" },
            { name: "Charlie Brown", role: "Viewer", email: "charlie@test.com", status: "inactive" }
        ],
        striped: true,
        hoverable: true
    })
);


// Pagination
app.appendChild(
    Pagination({
        current: 1,
        total: 150,
        onChange: (page) =>
            console.log("Page:", page)
    })
);


// Skeleton demo
const skeletonLabel =
    document.createElement("p");


skeletonLabel.innerText =
    "Skeleton Loading (text):";

skeletonLabel.style.fontFamily = "Inter, sans-serif";
skeletonLabel.style.fontSize = "14px";
skeletonLabel.style.color = "#475569";

app.appendChild(skeletonLabel);


app.appendChild(
    Skeleton({ variant: "text", count: 3 })
);


app.appendChild(
    Skeleton({ variant: "title" })
);


app.appendChild(
    Skeleton({ variant: "avatar" })
);


app.appendChild(
    Skeleton({ variant: "card" })
);


// EmptyState
app.appendChild(
    EmptyState({
        icon: "📂",
        title: "No documents found",
        description: "You haven't uploaded any documents yet. Upload your first document to get started.",
        actionText: "Upload Document",
        onAction: () =>
            console.log("Upload clicked")
    })
);


// ──────────────────────────────────────────────
// Section: Navigation Components (Phase 2B)
// ──────────────────────────────────────────────

const navSection =
    document.createElement("h2");


navSection.innerText =
    "Navigation Components";

navSection.style.fontFamily = "Inter, sans-serif";
navSection.style.marginTop = "16px";

app.appendChild(navSection);


// Tabs
let currentTab = "overview";

function renderTabs() {

    const oldTabs =
        document.querySelector(".smart-tabs");


    if (oldTabs) {
        oldTabs.remove();
    }


    const newTabs =
        Tabs({
            tabs: [
                { id: "overview", label: "Overview" },
                { id: "details", label: "Details" },
                { id: "settings", label: "Settings" }
            ],
            active: currentTab,
            onChange: (id) => {
                currentTab = id;
                console.log("Tab:", id);
                renderTabs();
            }
        });


    app.insertBefore(
        newTabs,
        app.children[
            Array.from(app.children)
                .indexOf(navSection) + 1
        ]
    );

}


renderTabs();


// Dropdown
app.appendChild(
    Dropdown({
        label: "Actions ▾",
        items: [
            { label: "Edit", value: "edit", onClick: (v) => console.log("Action:", v) },
            { label: "Duplicate", value: "duplicate", onClick: (v) => console.log("Action:", v) },
            { divider: true },
            { label: "Delete", value: "delete", disabled: true, onClick: (v) => console.log("Action:", v) }
        ],
        placement: "bottom-left"
    })
);


// Breadcrumb
app.appendChild(
    Breadcrumb({
        items: [
            { label: "Home", href: "/" },
            { label: "Documents" },
            { label: "Reports" },
            { label: "Current Report" }
        ]
    })
);


// ──────────────────────────────────────────────
// Section: Layout Components (Phase 2B)
// ──────────────────────────────────────────────

const layoutSection =
    document.createElement("h2");


layoutSection.innerText =
    "Layout Components";

layoutSection.style.fontFamily = "Inter, sans-serif";
layoutSection.style.marginTop = "16px";

app.appendChild(layoutSection);


// Stack (horizontal)
const stackLabel =
    document.createElement("p");


stackLabel.innerText =
    "Stack (horizontal, gap sm):";

stackLabel.style.fontFamily = "Inter, sans-serif";
stackLabel.style.fontSize = "14px";
stackLabel.style.color = "#475569";

app.appendChild(stackLabel);


app.appendChild(
    Stack({
        direction: "horizontal",
        gap: "sm",
        children: [
            Button({ text: "Save", type: "primary" }),
            Button({ text: "Cancel", type: "secondary" }),
            Button({ text: "Delete", type: "danger" })
        ]
    })
);


// Container demo
const containerLabel =
    document.createElement("p");


containerLabel.innerText =
    "Container (size sm, with border):";

containerLabel.style.fontFamily = "Inter, sans-serif";
containerLabel.style.fontSize = "14px";
containerLabel.style.color = "#475569";

app.appendChild(containerLabel);


const demoContainer =
    Container({
        size: "sm",
        children: "<div style='border:1px dashed #e2e8f0;padding:24px;border-radius:6px;font-family:Inter,sans-serif;color:#64748b;text-align:center'>This container has a max-width of 640px</div>"
    });


app.appendChild(demoContainer);


// Divider with label
app.appendChild(
    Divider({ label: "Section Break", labelPosition: "center" })
);


// ──────────────────────────────────────────────
// Section: Feedback Components (Phase 2A)
// ──────────────────────────────────────────────

const feedbackSection =
    document.createElement("h2");


feedbackSection.innerText =
    "Feedback Components";

feedbackSection.style.fontFamily = "Inter, sans-serif";
feedbackSection.style.marginTop = "16px";

app.appendChild(feedbackSection);


// Alert variants
const alertRow =
    document.createElement("div");


alertRow.style.display = "flex";
alertRow.style.flexDirection = "column";
alertRow.style.gap = "8px";


alertRow.appendChild(
    Alert({
        message: "Info: System is running smoothly",
        variant: "info"
    })
);


alertRow.appendChild(
    Alert({
        message: "Success: Data saved successfully",
        variant: "success"
    })
);


alertRow.appendChild(
    Alert({
        message: "Warning: Storage almost full",
        variant: "warning",
        dismissible: true,
        onDismiss: () =>
            console.log("Alert dismissed")
    })
);


alertRow.appendChild(
    Alert({
        message: "Danger: Connection lost",
        variant: "danger"
    })
);


app.appendChild(alertRow);


// Modal trigger button
let modalOpen = false;

const modalToggle =
    Button({
        text: "Open Modal",
        type: "primary",
        onClick: () => {
            modalOpen = !modalOpen;
            document.body.appendChild(
                Modal({
                    open: modalOpen,
                    title: "Confirm Action",
                    content: "<p>Are you sure you want to proceed?</p>",
                    footer: "<button style='padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer'>Confirm</button> <button style='padding:8px 16px;background:#e2e8f0;color:#1e293b;border:none;border-radius:6px;cursor:pointer'>Cancel</button>",
                    onClose: () => {
                        modalOpen = false;
                        document.body.removeChild(
                            document.querySelector(".smart-modal-overlay")
                        );
                    }
                })
            );
        }
    });


app.appendChild(modalToggle);


// Toast trigger
const toastBtn =
    Button({
        text: "Show Toast",
        type: "secondary",
        onClick: () => {
            const toast =
                Toast({
                    message: "Changes saved",
                    variant: "success",
                    duration: 3000,
                    onDismiss: () => {
                        document.body.removeChild(
                            document.querySelector(".smart-toast")
                        );
                    }
                });

            toast.style.position = "fixed";
            toast.style.top = "24px";
            toast.style.right = "24px";
            toast.style.zIndex = "9999";

            document.body.appendChild(toast);
        }
    });


app.appendChild(toastBtn);


// ──────────────────────────────────────────────
// Section: Display Components (Phase 2A)
// ──────────────────────────────────────────────

const displaySection =
    document.createElement("h2");


displaySection.innerText =
    "Display Components";

displaySection.style.fontFamily = "Inter, sans-serif";
displaySection.style.marginTop = "16px";

app.appendChild(displaySection);


// Badges
const badgeRow =
    document.createElement("div");


badgeRow.style.display = "flex";
badgeRow.style.gap = "12px";
badgeRow.style.alignItems = "center";


badgeRow.appendChild(
    Badge({ text: "Active", variant: "success" })
);


badgeRow.appendChild(
    Badge({ text: "Pending", variant: "warning" })
);


badgeRow.appendChild(
    Badge({ text: "Error", variant: "danger" })
);


badgeRow.appendChild(
    Badge({ text: "Info", variant: "primary" })
);


badgeRow.appendChild(
    Badge({ text: "Messages", variant: "default", count: 5 })
);


badgeRow.appendChild(
    Badge({ text: "Notifications", variant: "danger", count: 99 })
);


app.appendChild(badgeRow);


// Avatars
const avatarRow =
    document.createElement("div");


avatarRow.style.display = "flex";
avatarRow.style.gap = "16px";
avatarRow.style.alignItems = "center";


avatarRow.appendChild(
    Avatar({ name: "John Doe", size: "sm" })
);


avatarRow.appendChild(
    Avatar({ name: "Jane Smith", size: "md" })
);


avatarRow.appendChild(
    Avatar({ name: "Admin User", size: "lg" })
);


avatarRow.appendChild(
    Avatar({ name: "CEO", size: "xl" })
);


avatarRow.appendChild(
    Avatar({
        src: "https://i.pravatar.cc/72",
        name: "User Avatar",
        size: "md"
    })
);


app.appendChild(avatarRow);


// Original Button example
app.appendChild(
    Button({
        text: "Simpan (Primary)",
        type: "primary"
    })
);
