/**
 * SearchableSelect — Dropdown with live search/filter.
 *
 * Mengganti <select> biasa menjadi combobox dengan input pencarian.
 * Cocok untuk dropdown dengan banyak opsi (provinsi, kabupaten, dll).
 *
 * @module @smart/ui/components/searchable-select
 */

/**
 * Create a searchable select from an existing <select> element.
 * The original select is hidden and its value is synced automatically.
 *
 * @param {HTMLSelectElement} selectEl - Original <select> element to enhance
 * @param {object} [options]
 * @param {string} [options.placeholder] - Placeholder text for the search input
 * @param {Function} [options.onChange] - Called with (value, text, selectedOption) on selection
 * @param {boolean} [options.disabled] - Initially disabled
 * @returns {{ updateOptions: Function, setValue: Function, getValue: Function, destroy: Function, setDisabled: Function }}
 */
export function SearchableSelect(selectEl, options = {}) {
    if (!selectEl) return null;

    const {
        placeholder = "Ketik untuk mencari...",
        onChange = null,
        disabled = false
    } = options;

    // ── State ──
    let isOpen = false;
    let filteredOptions = [];
    let allOptions = [];
    let highlightIndex = -1;
    let _disabled = disabled;

    // ── Cache original styles ──
    const origDisplay = selectEl.style.display;
    selectEl.style.display = "none";

    // ── Build DOM ──
    const container = document.createElement("div");
    container.className = "ss-container";

    const inputWrapper = document.createElement("div");
    inputWrapper.className = "ss-input-wrapper";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "ss-input";
    input.placeholder = placeholder;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.disabled = _disabled;

    const arrow = document.createElement("span");
    arrow.className = "ss-arrow";
    arrow.innerHTML = "▾";
    arrow.style.cssText = "position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:0.7rem;color:#94a3b8;transition:transform 0.2s;";

    const dropdown = document.createElement("div");
    dropdown.className = "ss-dropdown";
    dropdown.style.cssText = "position:absolute;top:100%;left:0;right:0;z-index:1000;background:#fff;border:1px solid #d1d5db;border-radius:0 0 8px 8px;max-height:200px;overflow-y:auto;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.1);";

    const noResults = document.createElement("div");
    noResults.className = "ss-no-results";
    noResults.textContent = "Tidak ditemukan";
    noResults.style.cssText = "padding:10px 12px;color:#94a3b8;font-size:0.85rem;text-align:center;display:none;";

    dropdown.appendChild(noResults);
    inputWrapper.appendChild(input);
    inputWrapper.appendChild(arrow);
    container.appendChild(inputWrapper);
    container.appendChild(dropdown);

    // Insert after the select element
    selectEl.parentNode.insertBefore(container, selectEl.nextSibling);

    // ── Add CSS once ──
    if (!document.getElementById("ss-styles")) {
        const style = document.createElement("style");
        style.id = "ss-styles";
        style.textContent = `
            .ss-container { position:relative; width:100%; }
            .ss-input-wrapper { position:relative; }
            .ss-input {
                width:100%; padding:9px 30px 9px 12px;
                border:1.5px solid #d1d5db; border-radius:8px;
                font-size:0.88rem; outline:none; transition:border-color 0.2s, box-shadow 0.2s;
                box-sizing:border-box; background:#f9fafb; color:#1e293b; cursor:pointer;
            }
            .ss-input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.12); background:#fff; }
            .ss-input::placeholder { color:#94a3b8; }
            .ss-input.ss-open { border-radius:8px 8px 0 0; }
            .ss-input:disabled { opacity:0.6; cursor:not-allowed; background:#f1f5f9; }
            .ss-dropdown .ss-option {
                padding:8px 12px; cursor:pointer; font-size:0.85rem;
                color:#1e293b; transition:background 0.1s;
                border-bottom:1px solid #f1f5f9;
            }
            .ss-dropdown .ss-option:last-child { border-bottom:none; }
            .ss-dropdown .ss-option:hover,
            .ss-dropdown .ss-option.ss-highlighted { background:#eef2ff; color:#4f46e5; }
            .ss-dropdown .ss-option.ss-selected { background:#eef2ff; font-weight:600; color:#4f46e5; }
            .ss-dropdown .ss-option .ss-option-code { font-size:0.75rem; color:#94a3b8; margin-left:4px; }
        `;
        document.head.appendChild(style);
    }

    // ── Sync options from select ──
    function syncOptions() {
        allOptions = [];
        const fragment = document.createDocumentFragment();

        for (const opt of selectEl.options) {
            if (opt.value === "") continue; // skip placeholder
            allOptions.push({
                value: opt.value,
                text: opt.textContent || opt.text,
                selected: opt.selected
            });
        }

        filteredOptions = [...allOptions];
        renderDropdown();

        // Set input value from selected option
        const selected = allOptions.find(o => o.selected);
        if (selected) {
            input.value = selected.text;
        } else {
            input.value = "";
        }
    }

    // ── Render dropdown ──
    function renderDropdown() {
        // Remove all option items (keep noResults)
        while (dropdown.children.length > 1) {
            dropdown.removeChild(dropdown.lastChild);
        }

        if (filteredOptions.length === 0) {
            noResults.style.display = "block";
            return;
        }
        noResults.style.display = "none";

        const fragment = document.createDocumentFragment();
        filteredOptions.forEach((opt, idx) => {
            const div = document.createElement("div");
            div.className = "ss-option";
            if (opt.selected) div.classList.add("ss-selected");
            if (idx === highlightIndex) div.classList.add("ss-highlighted");
            div.dataset.value = opt.value;
            div.dataset.text = opt.text;
            div.textContent = opt.text;
            fragment.appendChild(div);
        });
        dropdown.appendChild(fragment);
    }

    // ── Open / Close ──
    function open() {
        if (_disabled) return;
        if (isOpen) return;
        isOpen = true;
        dropdown.style.display = "block";
        input.classList.add("ss-open");
        arrow.style.transform = "translateY(-50%) rotate(180deg)";
        // Filter based on current input
        filterOptions(input.value);
    }

    function close(restoreInput = true) {
        if (!isOpen) return;
        isOpen = false;
        dropdown.style.display = "none";
        input.classList.remove("ss-open");
        arrow.style.transform = "translateY(-50%) rotate(0deg)";
        highlightIndex = -1;
        // Restore input to selected value
        if (restoreInput) {
            const selected = allOptions.find(o => o.selected);
            input.value = selected ? selected.text : "";
        }
    }

    // ── Filter options ──
    function filterOptions(query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            filteredOptions = [...allOptions];
        } else {
            filteredOptions = allOptions.filter(o =>
                o.text.toLowerCase().includes(q)
            );
        }
        highlightIndex = -1;
        renderDropdown();
    }

    // ── Select option ──
    function selectOption(idx) {
        if (idx < 0 || idx >= filteredOptions.length) return;
        const opt = filteredOptions[idx];
        if (!opt) return;

        // Deselect all
        allOptions.forEach(o => o.selected = false);
        opt.selected = true;

        // Sync hidden select
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));

        // Update input
        input.value = opt.text;

        // Close
        close(false);

        // Callback
        if (typeof onChange === "function") {
            onChange(opt.value, opt.text, opt);
        }
    }

    // ── Navigate highlight ──
    function highlightNext() {
        if (filteredOptions.length === 0) return;
        highlightIndex = (highlightIndex + 1) % filteredOptions.length;
        renderDropdown();
        scrollToHighlight();
    }

    function highlightPrev() {
        if (filteredOptions.length === 0) return;
        highlightIndex = (highlightIndex - 1 + filteredOptions.length) % filteredOptions.length;
        renderDropdown();
        scrollToHighlight();
    }

    function scrollToHighlight() {
        const items = dropdown.querySelectorAll(".ss-option");
        if (items[highlightIndex]) {
            items[highlightIndex].scrollIntoView({ block: "nearest" });
        }
    }

    // ── Event Listeners ──

    // Input focus → open dropdown
    input.addEventListener("focus", () => {
        open();
    });

    // Input typing → filter
    input.addEventListener("input", () => {
        if (!isOpen) open();
        filterOptions(input.value);
        // If typing, set highlight to first match
        if (filteredOptions.length > 0) {
            highlightIndex = 0;
            renderDropdown();
        }
    });

    // Click on input → toggle
    input.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isOpen) {
            close();
        } else {
            open();
        }
    });

    // Keyboard navigation
    input.addEventListener("keydown", (e) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                if (!isOpen) { open(); return; }
                highlightNext();
                break;
            case "ArrowUp":
                e.preventDefault();
                if (!isOpen) { open(); return; }
                highlightPrev();
                break;
            case "Enter":
                e.preventDefault();
                if (isOpen && highlightIndex >= 0) {
                    selectOption(highlightIndex);
                } else if (isOpen) {
                    // Select first option
                    if (filteredOptions.length > 0) {
                        selectOption(0);
                    }
                }
                break;
            case "Escape":
                e.preventDefault();
                close();
                break;
            case "Tab":
                close();
                break;
        }
    });

    // Click on dropdown option
    dropdown.addEventListener("mousedown", (e) => {
        const option = e.target.closest(".ss-option");
        if (!option) return;
        e.preventDefault(); // prevent input blur
        const idx = Array.from(dropdown.querySelectorAll(".ss-option")).indexOf(option);
        if (idx >= 0) selectOption(idx);
    });

    // Click outside → close
    const _handleOutsideClick = (e) => {
        if (!container.contains(e.target)) {
            close();
        }
    };
    document.addEventListener("click", _handleOutsideClick);

    // ── Public API ──

    /** Update options from the original select element */
    function updateOptions() {
        syncOptions();
    }

    /** Set value programmatically */
    function setValue(value) {
        const opt = allOptions.find(o => o.value === value);
        if (opt) {
            selectOption(filteredOptions.indexOf(opt));
        } else {
            selectEl.value = value;
            input.value = value;
        }
    }

    /** Get current value */
    function getValue() {
        return selectEl.value;
    }

    /** Enable/disable */
    function setDisabled(state) {
        _disabled = state;
        input.disabled = state;
    }

    /** Destroy and restore original select */
    function destroy() {
        document.removeEventListener("click", _handleOutsideClick);
        container.remove();
        selectEl.style.display = origDisplay;
    }

    // ── Init ──
    syncOptions();

    return { updateOptions, setValue, getValue, destroy, setDisabled };
}
