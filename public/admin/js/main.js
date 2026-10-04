import { mountAuthBar } from "./auth.js";
import { renderListView } from "./listView.js";
import { renderEditorView } from "./editorView.js";
import { renderGuideView } from "./guideView.js";
import { icon } from "./icons.js";

const authContainer = document.getElementById("auth-bar");
const listContainer = document.getElementById("view-list");
const editorContainer = document.getElementById("view-editor");
const guideContainer = document.getElementById("view-guide");
const navTabs = document.querySelectorAll(".nav-tab");

document.getElementById("brand-icon").innerHTML = icon("globe", 20);
mountAuthBar(authContainer);

function setActiveTab(name) {
    navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.nav === name));
}

function showList() {
    setActiveTab("websites");
    guideContainer.hidden = true;
    editorContainer.hidden = true;
    listContainer.hidden = false;
    renderListView(listContainer, { onSelect: showEditor, onNew: () => showEditor(null) });
}

function showEditor(config) {
    setActiveTab("websites");
    guideContainer.hidden = true;
    listContainer.hidden = true;
    editorContainer.hidden = false;
    renderEditorView(editorContainer, config, { onBack: showList, onSaved: showList });
}

function showGuide() {
    setActiveTab("guide");
    listContainer.hidden = true;
    editorContainer.hidden = true;
    guideContainer.hidden = false;
    if (!guideContainer.dataset.rendered) {
        renderGuideView(guideContainer);
        guideContainer.dataset.rendered = "true";
    }
}

navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        if (tab.dataset.nav === "guide") showGuide();
        else showList();
    });
});

showList();
