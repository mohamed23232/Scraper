import { mountAuthBar } from "./auth.js";
import { renderListView } from "./listView.js";
import { renderEditorView } from "./editorView.js";
import { renderGuideView } from "./guideView.js";
import { renderConnectView } from "./connectView.js";
import { icon } from "./icons.js";

const authContainer = document.getElementById("auth-bar");
const listContainer = document.getElementById("view-list");
const editorContainer = document.getElementById("view-editor");
const connectContainer = document.getElementById("view-connect");
const guideContainer = document.getElementById("view-guide");
const navTabs = document.querySelectorAll(".nav-tab");

document.getElementById("brand-icon").innerHTML = icon("globe", 20);
mountAuthBar(authContainer);

function setActiveTab(name) {
    navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.nav === name));
}

function hideAll() {
    listContainer.hidden = true;
    editorContainer.hidden = true;
    connectContainer.hidden = true;
    guideContainer.hidden = true;
}

function showList() {
    hideAll();
    setActiveTab("websites");
    listContainer.hidden = false;
    renderListView(listContainer, { onSelect: showEditor, onNew: () => showEditor(null) });
}

function showEditor(config) {
    hideAll();
    setActiveTab("websites");
    editorContainer.hidden = false;
    renderEditorView(editorContainer, config, { onBack: showList, onSaved: showList });
}

function showConnect() {
    hideAll();
    setActiveTab("connect");
    connectContainer.hidden = false;
    renderConnectView(connectContainer); // re-fetches the website list fresh every time, deliberately not cached
}

function showGuide() {
    hideAll();
    setActiveTab("guide");
    guideContainer.hidden = false;
    if (!guideContainer.dataset.rendered) {
        renderGuideView(guideContainer);
        guideContainer.dataset.rendered = "true";
    }
}

navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        if (tab.dataset.nav === "connect") showConnect();
        else if (tab.dataset.nav === "guide") showGuide();
        else showList();
    });
});

showList();
