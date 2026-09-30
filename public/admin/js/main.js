import { mountAuthBar } from "./auth.js";
import { renderListView } from "./listView.js";
import { renderEditorView } from "./editorView.js";

const authContainer = document.getElementById("auth-bar");
const listContainer = document.getElementById("view-list");
const editorContainer = document.getElementById("view-editor");

mountAuthBar(authContainer);

function showList() {
    editorContainer.hidden = true;
    listContainer.hidden = false;
    renderListView(listContainer, { onSelect: showEditor, onNew: () => showEditor(null) });
}

function showEditor(config) {
    listContainer.hidden = true;
    editorContainer.hidden = false;
    renderEditorView(editorContainer, config, { onBack: showList, onSaved: showList });
}

showList();
