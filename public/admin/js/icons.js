/** Small hand-rolled inline SVG icon set (stroke-based, inherits color via currentColor). No icon-font/CDN dependency. */

function svg(size, inner) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export const icons = {
    globe: (s = 18) => svg(s, `<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 2.6 4.2 5.8 4.2 9s-1.4 6.4-4.2 9c-2.8-2.6-4.2-5.8-4.2-9s1.4-6.4 4.2-9z"/>`),
    key: (s = 14) => svg(s, `<circle cx="8" cy="12" r="4"/><path d="M11 9.5 19 1.5M19 1.5l2.5 2.5M19 1.5 16.5 4"/>`),
    plus: (s = 16) => svg(s, `<path d="M12 5v14M5 12h14"/>`),
    trash: (s = 16) => svg(s, `<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>`),
    pencil: (s = 16) => svg(s, `<path d="M4 20l1-4 11-11 3 3-11 11-4 1z"/>`),
    play: (s = 15) => svg(s, `<path d="M6 4l14 8-14 8V4z"/>`),
    save: (s = 15) => svg(s, `<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/>`),
    arrowLeft: (s = 16) => svg(s, `<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>`),
    chevron: (s = 14) => svg(s, `<path d="M9 6l6 6-6 6"/>`),
    alertTriangle: (s = 18) => svg(s, `<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>`),
    alertCircle: (s = 24) => svg(s, `<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>`),
    checkCircle: (s = 18) => svg(s, `<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>`),
    x: (s = 14) => svg(s, `<path d="M6 6l12 12M18 6L6 18"/>`),
    inbox: (s = 32) => svg(s, `<path d="M4 12h4l2 3h4l2-3h4"/><path d="M4 12l1-7h14l1 7"/><path d="M4 12v6h16v-6"/>`),
    sliders: (s = 16) => svg(s, `<path d="M4 7h10M17 7h3"/><circle cx="14" cy="7" r="2"/><path d="M4 12h3M10 12h10"/><circle cx="7" cy="12" r="2"/><path d="M4 17h10M17 17h3"/><circle cx="14" cy="17" r="2"/>`)
};

export function icon(name, size) {
    const fn = icons[name];
    return fn ? fn(size) : "";
}
