/**
 * CardList — SMART UI reusable mobile card list component.
 *
 * Provides shared CSS classes and helper functions for rendering
 * consistent mobile card views across all master data pages.
 *
 * Usage:
 *   import { CardList, attachCardEvents } from "@smart/ui";
 *
 *   const list = CardList(state.items, (item) => `
 *       <div class="sm-card-header-row">
 *           <div class="sm-card-name">${esc(item.nama)}</div>
 *       </div>
 *       <div class="sm-card-footer-row">
 *           <span class="sm-card-code">${esc(item.kode)}</span>
 *           <div class="sm-card-actions">
 *               <button class="sm-card-btn sm-card-btn-edit" data-edit="${item.id}">✏️ Edit</button>
 *               <button class="sm-card-btn sm-card-btn-delete" data-delete="${item.id}">🗑️ Hapus</button>
 *           </div>
 *       </div>
 *   `);
 *   container.appendChild(list);
 *   attachCardEvents(container, onEdit, onDelete);
 *
 * @module @smart/ui/components/card-list
 */

import "./card-list.css";

/**
 * Create a card list DOM element.
 *
 * @param {Array<object>} items - Array of data items
 * @param {function(object): string} renderContent - Function that returns HTML for each card's inner content
 * @returns {HTMLElement} The card list element
 */
export function CardList(items, renderContent) {
    const list = document.createElement("div");
    list.className = "sm-card-list";

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "sm-card";
        card.innerHTML = renderContent(item);
        list.appendChild(card);
    });

    return list;
}

/**
 * Attach edit/delete event listeners to a card list container.
 *
 * @param {HTMLElement} container - Container with [data-edit] and [data-delete] buttons
 * @param {function(string): void} onEdit - Edit callback (receives item id)
 * @param {function(string): void} onDelete - Delete callback (receives item id)
 */
export function attachCardEvents(container, onEdit, onDelete) {
    container.querySelectorAll("[data-edit]").forEach(btn => {
        btn.addEventListener("click", () => onEdit?.(String(btn.dataset.edit)));
    });
    container.querySelectorAll("[data-delete]").forEach(btn => {
        btn.addEventListener("click", () => onDelete?.(String(btn.dataset.delete)));
    });
}
