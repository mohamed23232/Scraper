import { icon } from "./icons.js";
import { escapeHtml } from "./utils.js";

/** Returns a Promise<boolean> — resolves true if the user confirms, false otherwise (Cancel, backdrop click, or Escape). */
export function confirmDialog({ title, message, confirmLabel = "Delete", danger = true }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal" role="alertdialog" aria-modal="true">
                <div class="icon-circle">${icon("alertTriangle", 22)}</div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
                <div class="modal-actions">
                    <button type="button" data-action="cancel">Cancel</button>
                    <button type="button" class="${danger ? "btn-danger" : "btn-primary"}" data-action="confirm">${escapeHtml(confirmLabel)}</button>
                </div>
            </div>
        `;

        function close(result) {
            document.removeEventListener("keydown", onKeyDown);
            overlay.remove();
            resolve(result);
        }

        function onKeyDown(event) {
            if (event.key === "Escape") close(false);
        }

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) close(false);
        });
        overlay.querySelector("[data-action='cancel']").addEventListener("click", () => close(false));
        overlay.querySelector("[data-action='confirm']").addEventListener("click", () => close(true));
        document.addEventListener("keydown", onKeyDown);

        document.body.appendChild(overlay);
        overlay.querySelector("[data-action='confirm']").focus();
    });
}
